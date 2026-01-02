import { decideDebitAccount, findAccountRuleMatch } from "@/lib/accountRules";
import { insertExpenseLedger, insertProcessingError, isBlobPathProcessed } from "@/lib/db";
import { env, ensureEnv, getEnvErrorMessage } from "@/lib/env";
import { analyzeReceipt } from "@/lib/gemini";
import { acquireCronLock, releaseCronLock } from "@/lib/locks";
import { copy, del, list } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_INVOICE_CATEGORY = "課税仕入";
const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function inferMimeType(pathname: string) {
  const ext = pathname.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[ext];
}

function extractOriginalName(pathname: string, metadata?: Record<string, string>) {
  const fromMeta = metadata?.originalName;
  if (fromMeta) return fromMeta;
  return pathname.split("/").pop() ?? pathname;
}

async function moveToProcessed(pathname: string, url: string) {
  const targetPath = pathname.replace(/^unprocessed\//, "processed/");
  await copy(url, targetPath);
  await del(url);
  return targetPath;
}

export async function GET(request: Request) {
  try {
    ensureEnv();
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const locked = await acquireCronLock();
    if (!locked) {
      return NextResponse.json({ ok: false, error: "Locked" }, { status: 423 });
    }

    const summary = {
      total: 0,
      processed: 0,
      movedToProcessed: 0,
      skippedExisting: 0,
      skippedUnsupported: 0,
      errors: 0,
    };

    try {
      const { blobs } = await list({ prefix: "unprocessed/", limit: env.MAX_FILES_PER_RUN });

      for (const blob of blobs) {
        summary.total += 1;

        const originalName = extractOriginalName(blob.pathname, (blob as any).metadata);
        try {
          const mimeType = inferMimeType(blob.pathname);
          if (!mimeType) {
            summary.skippedUnsupported += 1;
            continue;
          }

          if (blob.size && blob.size > env.MAX_FILE_BYTES) {
            summary.errors += 1;
            await insertProcessingError({
              drive_file_id: blob.pathname,
              drive_file_name: originalName,
              error_message: `ファイルサイズ ${blob.size} bytes が上限 ${env.MAX_FILE_BYTES} を超えています。`,
            });
            continue;
          }

          if (await isBlobPathProcessed(blob.pathname)) {
            await moveToProcessed(blob.pathname, blob.url);
            summary.skippedExisting += 1;
            summary.movedToProcessed += 1;
            continue;
          }

          const downloadUrl = (blob as any).downloadUrl ?? blob.url;
          const res = await fetch(downloadUrl);
          if (!res.ok) {
            throw new Error(`Blob download failed: ${res.status} ${res.statusText}`);
          }
          const arrayBuffer = await res.arrayBuffer();
          const dataBuffer = Buffer.from(arrayBuffer);

          const { parsed, raw } = await analyzeReceipt({
            buffer: dataBuffer,
            mimeType,
            fileName: originalName,
          });

          const normalizedAmount = Math.round(Number(parsed.amount ?? 0));
          const normalizedTax = Math.round(Number(parsed.tax ?? 0));
          const finalTax =
            normalizedTax === 0 && typeof env.TAX_FALLBACK_RATE === "number"
              ? Math.round(normalizedAmount * env.TAX_FALLBACK_RATE)
              : normalizedTax;

          const ruleMatch = findAccountRuleMatch({
            vendor: parsed.vendor,
            description: parsed.description,
            memo: parsed.memo,
            items_summary: parsed.items_summary,
            items: parsed.items,
            suggested_debit_account: parsed.suggested_debit_account,
          });

          const debitAccount = decideDebitAccount({
            vendor: parsed.vendor,
            description: parsed.description,
            memo: parsed.memo,
            items_summary: parsed.items_summary,
            items: parsed.items,
            suggested_debit_account: parsed.suggested_debit_account,
          });

          const geminiResponse = {
            model: raw,
            rule_match: ruleMatch,
            decided_debit_account: debitAccount,
          };

          await insertExpenseLedger({
            transaction_date: parsed.transaction_date,
            debit_account: debitAccount,
            debit_vendor: parsed.vendor,
            debit_amount: normalizedAmount,
            debit_tax: finalTax,
            debit_invoice_category: DEFAULT_INVOICE_CATEGORY,
            credit_account: env.DEFAULT_CREDIT_ACCOUNT,
            credit_vendor: "",
            credit_amount: normalizedAmount,
            credit_tax: 0,
            credit_invoice_category: DEFAULT_INVOICE_CATEGORY,
            description: parsed.description,
            memo: parsed.memo,
            drive_file_id: blob.pathname,
            drive_file_name: originalName,
            drive_file_mime_type: mimeType,
            gemini_response: geminiResponse,
          });

          await moveToProcessed(blob.pathname, blob.url);
          summary.processed += 1;
          summary.movedToProcessed += 1;

          await sleep(2000);
        } catch (error) {
          summary.errors += 1;
          await insertProcessingError({
            drive_file_id: blob.pathname,
            drive_file_name: originalName,
            error_message: error instanceof Error ? error.message : "Unknown error",
            stack_trace: error instanceof Error ? error.stack : undefined,
          });
          console.error("Processing error", { blob, error });
        }
      }

      return NextResponse.json({ ok: true, summary });
    } finally {
      await releaseCronLock();
    }
  } catch (error) {
    const envError = getEnvErrorMessage();
    const message =
      envError && error instanceof Error && error.message.includes("Missing or invalid env values")
        ? `環境変数が不足しています: ${envError}`
        : "Internal error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
