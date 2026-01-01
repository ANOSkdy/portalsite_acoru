import { z } from "zod";

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
    GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email(),
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().min(1),
    GDRIVE_UNPROCESSED_FOLDER_ID: z.string().min(1),
    GDRIVE_PROCESSED_FOLDER_ID: z.string().min(1),
    CRON_SECRET: z.string().min(1),
    DEFAULT_CREDIT_ACCOUNT: z.string().default("普通預金"),
    MAX_FILES_PER_RUN: numberFromEnv("MAX_FILES_PER_RUN", 50),
    MAX_FILE_BYTES: numberFromEnv("MAX_FILE_BYTES", 10_485_760),
    TAX_FALLBACK_RATE: optionalRate,
  })
  .transform((value) => ({
    ...value,
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: value.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }));

export const env = envSchema.parse(process.env);

export const ALLOWED_MIME_TYPES = ["image/jpeg", "application/pdf"];
export const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "pdf"];
