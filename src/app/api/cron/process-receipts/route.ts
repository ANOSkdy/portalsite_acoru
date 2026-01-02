import { NextResponse } from "next/server";
import { decideDebitAccount, findAccountRuleMatch } from "@/lib/accountRules";
import { env, ensureEnv, getEnvErrorMessage } from "@/lib/env";
import { analyzeReceipt } from "@/lib/gemini";
import {
  downloadFile,
  listUnprocessedFiles,
  moveFileToProcessed,
  isSupportedFile,
} from "@/lib/googleDrive";
import {
  insertExpenseLedger,
  insertProcessingError,
  isDriveFileProcessed,
} from "@/lib/db";
import { acquireCronLock, releaseCronLock } from "@/lib/locks";

export const runtime = "nodejs";

const DEFAULT_INVOICE_CATEGORY = "課税仕入";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
      const files = await listUnprocessedFiles(env.MAX_FILES_PER_RUN);

      for (const file of files) {
        summary.total += 1;

      try {
        if (!isSupportedFile(file)) {
          summary.skippedUnsupported += 1;
          continue;
        }

        if (file.size && file.size > env.MAX_FILE_BYTES) {
          summary.errors += 1;
          await insertProcessingError({
            drive_file_id: file.id,
            drive_file_name: file.name,
            error_message: `ファイルサイズ ${file.size} bytes が上限 ${env.MAX_FILE_BYTES} を超えています。`,
          });
          continue;
        }

        if (await isDriveFileProcessed(file.id)) {
          await moveFileToProcessed(file.id, file.parents);
          summary.skippedExisting += 1;
          summary.movedToProcessed += 1;
          continue;
        }

        const dataBuffer = await downloadFile(file.id);
        const { parsed, raw } = await analyzeReceipt({ buffer: dataBuffer, mimeType: file.mimeType, fileName: file.name });

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
          drive_file_id: file.id,
          drive_file_name: file.name,
          drive_file_mime_type: file.mimeType,
          gemini_response: geminiResponse,
        });

        await moveFileToProcessed(file.id, file.parents);
        summary.processed += 1;
        summary.movedToProcessed += 1;

        await sleep(2000);
      } catch (error) {
        summary.errors += 1;
        await insertProcessingError({
          drive_file_id: file.id,
          drive_file_name: file.name,
          error_message: error instanceof Error ? error.message : "Unknown error",
          stack_trace: error instanceof Error ? error.stack : undefined,
        });
        console.error("Processing error", { file, error });
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
