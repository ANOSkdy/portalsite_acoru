import { neon } from "@neondatabase/serverless";
import { env } from "./env";

type NeonClient = ReturnType<typeof neon>;

let sqlClient: NeonClient | null = null;

function normalizeRows<T>(result: any): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result && Array.isArray((result as any).rows)) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

function getClient() {
  if (!sqlClient) {
    sqlClient = neon(env.DATABASE_URL);
  }
  return sqlClient;
}

export function getSqlClient() {
  return getClient();
}

export type ExpenseLedgerInsert = {
  transaction_date: string;
  debit_account: string;
  debit_vendor: string;
  debit_amount: number;
  debit_tax: number;
  debit_invoice_category: string;
  credit_account: string;
  credit_vendor: string;
  credit_amount: number;
  credit_tax: number;
  credit_invoice_category: string;
  description: string;
  memo: string;
  drive_file_id: string;
  drive_file_name: string;
  drive_file_mime_type: string;
  gemini_response: unknown;
};

export type ExpenseLedgerRow = ExpenseLedgerInsert & {
  id: number;
  created_at?: string;
};

export type ReceiptProcessingErrorInsert = {
  drive_file_id: string;
  drive_file_name?: string;
  error_message: string;
  stack_trace?: string;
};

export async function isDriveFileProcessed(driveFileId: string) {
  const sql = getClient();
  const rows = await sql`select 1 from expense_ledger where drive_file_id = ${driveFileId} limit 1`;
  const arr = normalizeRows(rows);
  return arr.length > 0;
}

export async function insertExpenseLedger(entry: ExpenseLedgerInsert) {
  const sql = getClient();
  const geminiJson = entry.gemini_response === undefined ? null : JSON.stringify(entry.gemini_response);

  const rows = await sql<ExpenseLedgerRow>`
    insert into expense_ledger (
      transaction_date,
      debit_account,
      debit_vendor,
      debit_amount,
      debit_tax,
      debit_invoice_category,
      credit_account,
      credit_vendor,
      credit_amount,
      credit_tax,
      credit_invoice_category,
      description,
      memo,
      drive_file_id,
      drive_file_name,
      drive_file_mime_type,
      gemini_response
    ) values (
      ${entry.transaction_date},
      ${entry.debit_account},
      ${entry.debit_vendor},
      ${entry.debit_amount},
      ${entry.debit_tax},
      ${entry.debit_invoice_category},
      ${entry.credit_account},
      ${entry.credit_vendor},
      ${entry.credit_amount},
      ${entry.credit_tax},
      ${entry.credit_invoice_category},
      ${entry.description},
      ${entry.memo},
      ${entry.drive_file_id},
      ${entry.drive_file_name},
      ${entry.drive_file_mime_type},
      ${geminiJson}
    )
    returning *
  `;

  const arr = normalizeRows<ExpenseLedgerRow>(rows);
  return arr[0];
}

export async function insertProcessingError(entry: ReceiptProcessingErrorInsert) {
  const sql = getClient();
  await sql`
    insert into receipt_processing_errors (
      drive_file_id,
      drive_file_name,
      error_message,
      stack_trace
    ) values (
      ${entry.drive_file_id},
      ${entry.drive_file_name ?? null},
      ${entry.error_message},
      ${entry.stack_trace ?? null}
    )
  `;
}
