import { z, type ZodError } from "zod";

const numberFromEnv = (name: string, fallback: number) =>
  z
    .preprocess(
      (v) => {
        if (typeof v === "string" && v.trim() !== "") return Number(v);
        if (typeof v === "number") return v;
        return fallback;
      },
      z.number().int().positive()
    )
    .describe(name);

const optionalRate = z.preprocess(
  (v) => {
    if (v === undefined || v === null) return undefined;
    if (typeof v === "string" && v.trim() === "") return undefined;
    return Number(v);
  },
  z.number().min(0).max(1).optional()
);

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    GEMINI_API_KEY: z.string().min(1),
    GEMINI_MODEL: z.string().default("gemini-3-flash-preview"),
    CRON_SECRET: z.string().min(1),
    BLOB_READ_WRITE_TOKEN: z.string().min(1),
    DEFAULT_CREDIT_ACCOUNT: z.string().default("普通預金"),
    MAX_FILES_PER_RUN: numberFromEnv("MAX_FILES_PER_RUN", 50),
    MAX_FILE_BYTES: numberFromEnv("MAX_FILE_BYTES", 10_485_760),
    TAX_FALLBACK_RATE: optionalRate,
  });

type Env = z.infer<typeof envSchema>;

const validationResult = envSchema.safeParse(process.env);
export const envValidationError: ZodError<Env> | null = validationResult.success ? null : validationResult.error;

const fallbackEnv: Env = {
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "",
  GEMINI_MODEL: process.env.GEMINI_MODEL ?? "gemini-3-flash-preview",
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN ?? "",
  CRON_SECRET: process.env.CRON_SECRET ?? "",
  DEFAULT_CREDIT_ACCOUNT: process.env.DEFAULT_CREDIT_ACCOUNT ?? "普通預金",
  MAX_FILES_PER_RUN: numberFromEnv("MAX_FILES_PER_RUN", 50).parse(process.env.MAX_FILES_PER_RUN),
  MAX_FILE_BYTES: numberFromEnv("MAX_FILE_BYTES", 10_485_760).parse(process.env.MAX_FILE_BYTES),
  TAX_FALLBACK_RATE: optionalRate.parse(process.env.TAX_FALLBACK_RATE),
};

export const env: Env = validationResult.success ? validationResult.data : fallbackEnv;

export function ensureEnv() {
  if (envValidationError) {
    const missing = envValidationError.issues.map((e) => e.path.join(".")).join(", ");
    throw new Error(`Missing or invalid env values: ${missing || envValidationError.message}`);
  }
}

export function getEnvErrorMessage() {
  if (!envValidationError) return "";
  const missing = envValidationError.issues.map((e) => e.path.join(".")).join(", ");
  return missing || envValidationError.message;
}

export const ALLOWED_MIME_TYPES = ["image/jpeg", "application/pdf"];
export const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "pdf"];
