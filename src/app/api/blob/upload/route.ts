import { ALLOWED_MIME_TYPES, env, ensureEnv, getEnvErrorMessage } from "@/lib/env";
import { handleUpload } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const clientPayloadSchema = z.object({
  originalName: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    ensureEnv();

    return handleUpload(request, {
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!pathname.startsWith("unprocessed/")) {
          throw new Error("pathname must start with unprocessed/");
        }

        const payload =
          typeof clientPayload === "string"
            ? clientPayload
              ? JSON.parse(clientPayload)
              : {}
            : clientPayload ?? {};
        const parsed = clientPayloadSchema.safeParse(payload);

        return {
          allowedContentTypes: ALLOWED_MIME_TYPES,
          maximumSizeInBytes: env.MAX_FILE_BYTES,
          addRandomSuffix: true,
          tokenPayload: parsed.success ? parsed.data : undefined,
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log("[blob.upload.completed]", {
          pathname: blob.pathname,
          size: blob.size,
          uploadedAt: blob.uploadedAt,
          originalName: (tokenPayload as { originalName?: string } | undefined)?.originalName,
        });
      },
    });
  } catch (error) {
    console.error("Blob upload handler error", error);
    const envError = getEnvErrorMessage();
    const message =
      envError && error instanceof Error && error.message.includes("Missing or invalid env values")
        ? `環境変数が不足しています: ${envError}`
        : error instanceof Error
          ? error.message
          : "アップロードに失敗しました。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
