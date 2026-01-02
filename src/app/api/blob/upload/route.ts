import { ALLOWED_MIME_TYPES, env, ensureEnv, getEnvErrorMessage } from "@/lib/env";
import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const clientPayloadSchema = z.object({
  originalName: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    ensureEnv();

    const response = await handleUpload({
      body: request.body ?? new ReadableStream(),
      request,
      onBeforeGenerateToken: async (pathname, clientPayload, _multipart) => {
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
          tokenPayload: parsed.success ? JSON.stringify(parsed.data) : clientPayload,
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        let originalName: string | undefined;
        if (typeof tokenPayload === "string") {
          try {
            const parsed = clientPayloadSchema.safeParse(JSON.parse(tokenPayload));
            if (parsed.success) originalName = parsed.data.originalName;
          } catch {
            // ignore parse errors
          }
        }

        console.log("[blob.upload.completed]", {
          pathname: blob.pathname,
          size: blob.size,
          uploadedAt: blob.uploadedAt,
          originalName,
        });
      },
    });
    if (response instanceof Response) {
      return response;
    }
    return NextResponse.json(response);
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
