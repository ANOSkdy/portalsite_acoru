import { GoogleAI } from "@google/genai";
import { z } from "zod";
import { env } from "./env";

export const receiptExtractionSchema = z.object({
  transaction_date: z.string().min(1),
  vendor: z.string().default(""),
  items_summary: z.string().default(""),
  items: z.array(z.string()).default([]),
  amount: z.number(),
  tax: z.number().default(0),
  suggested_debit_account: z.string().default(""),
  description: z.string().default(""),
  memo: z.string().default(""),
});

export type ReceiptExtraction = z.infer<typeof receiptExtractionSchema>;

const genAI = new GoogleAI({ apiKey: env.GEMINI_API_KEY });

const geminiResponseSchema = {
  type: "object",
  properties: {
    transaction_date: { type: "string", description: "YYYY-MM-DD date format" },
    vendor: { type: "string" },
    items_summary: { type: "string" },
    items: { type: "array", items: { type: "string" } },
    amount: { type: "number" },
    tax: { type: "number" },
    suggested_debit_account: { type: "string" },
    description: { type: "string" },
    memo: { type: "string" },
  },
  required: [
    "transaction_date",
    "vendor",
    "items_summary",
    "items",
    "amount",
    "tax",
    "suggested_debit_account",
    "description",
    "memo",
  ],
} as const;

const basePrompt = `
あなたは日本の経理担当者です。領収書や請求書の画像/PDFを読み取り、指定のJSONスキーマに沿って必ずJSONのみを出力してください。余分な文章やMarkdownは禁止です。
- 日付はYYYY-MM-DD
- amount, tax は整数（円）
- suggested_debit_account は会計の科目名を日本語で提案してください（例: 通信費）
- items は抽出できるときだけ配列で入れてください。なければ空配列。
- memo には注文番号や登録番号など補足を入れ、無ければ空文字
- description は店名＋主要品目の短い摘要
`.trim();

function parseJsonText(text: string) {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(trimmed);
}

async function callGeminiOnce(buffer: Buffer, mimeType: string, retry: boolean) {
  const model = genAI.getGenerativeModel({
    model: env.GEMINI_MODEL,
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const extra = retry
    ? "JSON だけを返してください。キーはスキーマと完全一致させ、型も厳守してください。"
    : "";

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          { text: `${basePrompt}\n${extra}` },
          { inlineData: { data: buffer.toString("base64"), mimeType } },
        ],
      },
    ],
  });

  const text = result.response?.text();
  if (!text) {
    throw new Error("Gemini response is empty");
  }
  return text;
}

export async function analyzeReceipt(params: { buffer: Buffer; mimeType: string; fileName?: string }) {
  const { buffer, mimeType } = params;
  let lastError: unknown;

  for (const attempt of [0, 1]) {
    try {
      const text = await callGeminiOnce(buffer, mimeType, attempt === 1);
      const raw = parseJsonText(text);
      const parsed = receiptExtractionSchema.parse(raw);
      return { parsed, raw };
    } catch (error) {
      lastError = error;
      if (attempt === 1) break;
    }
  }

  throw lastError;
}
