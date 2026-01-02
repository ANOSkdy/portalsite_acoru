import { NextResponse } from "next/server";
import { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES, env, ensureEnv, getEnvErrorMessage } from "@/lib/env";
import { uploadToUnprocessedFolder } from "@/lib/googleDrive";

export const runtime = "nodejs";

function isFileEntry(value: FormDataEntryValue): value is File {
  return typeof value === "object" && value !== null && "arrayBuffer" in value;
}

export async function POST(request: Request) {
  try {
    ensureEnv();
    const formData = await request.formData();
    const fileEntries = formData.getAll("files").filter(isFileEntry);
    const fallback = formData.get("file");
    if (fallback && isFileEntry(fallback)) fileEntries.push(fallback);

    if (!fileEntries.length) {
      return NextResponse.json({ ok: false, error: "ファイルが指定されていません。" }, { status: 400 });
    }

    const uploads = [];
    for (const file of fileEntries) {
      const mime = (file.type || "").toLowerCase();
      const ext = (file.name || "").split(".").pop()?.toLowerCase() ?? "";

      if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_MIME_TYPES.includes(mime)) {
        return NextResponse.json(
          { ok: false, error: `${file.name} は許可されていない形式です。jpg/jpeg/pdf のみ。` },
          { status: 400 }
        );
      }

      if (file.size > env.MAX_FILE_BYTES) {
        return NextResponse.json(
          { ok: false, error: `${file.name} が最大サイズ(${env.MAX_FILE_BYTES} bytes)を超えています。` },
          { status: 400 }
        );
      }

      const saved = await uploadToUnprocessedFolder(file);
      uploads.push(saved);
    }

    return NextResponse.json({ ok: true, files: uploads });
  } catch (error) {
    console.error("Upload error", error);
    const envError = getEnvErrorMessage();
    const message =
      envError && error instanceof Error && error.message.includes("Missing or invalid env values")
        ? `環境変数が不足しています: ${envError}`
        : "アップロードに失敗しました。";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
