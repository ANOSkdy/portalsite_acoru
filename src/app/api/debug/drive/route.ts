import { NextResponse } from "next/server";
import { env, ensureEnv } from "@/lib/env";
import { DriveOperationError, resolveFolderId } from "@/lib/googleDrive";

export const runtime = "nodejs";

export async function GET(request: Request) {
  ensureEnv();

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: { message: "Unauthorized" } }, { status: 401 });
  }

  try {
    const unprocessedId = await resolveFolderId(env.GDRIVE_UNPROCESSED_FOLDER_ID);
    const processedId = await resolveFolderId(env.GDRIVE_PROCESSED_FOLDER_ID);

    return NextResponse.json({
      ok: true,
      unprocessed: {
        configuredId: env.GDRIVE_UNPROCESSED_FOLDER_ID,
        resolvedId: unprocessedId,
      },
      processed: {
        configuredId: env.GDRIVE_PROCESSED_FOLDER_ID,
        resolvedId: processedId,
      },
    });
  } catch (error) {
    const status = error instanceof DriveOperationError && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: error instanceof DriveOperationError ? error.code ?? "drive_error" : "unknown_error",
          message: error instanceof Error ? error.message : "Drive フォルダの検証に失敗しました。",
          hint: error instanceof DriveOperationError ? error.hint : undefined,
        },
      },
      { status }
    );
  }
}
