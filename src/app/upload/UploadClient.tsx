'use client';

import { upload } from "@vercel/blob/client";
import { useMemo, useState } from "react";

type UploadStatus = "success" | "error";

type UploadResult = {
  name: string;
  pathname: string;
  status: UploadStatus;
  message?: string;
};

const ALLOWED_MIME_TYPES = ["image/jpeg", "application/pdf"];

function sanitizeFileName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[^\w.-]/g, "_")
    .replace(/_{2,}/g, "_");
}

export function UploadClient(props: { maxBytes: number }) {
  const { maxBytes } = props;
  const [files, setFiles] = useState<FileList | null>(null);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setError(null);
    setResults([]);

    if (!files?.length) {
      setError("ファイルを選択してください。");
      return;
    }

    const selected = Array.from(files);
    const today = new Date().toISOString().slice(0, 10);
    const startedAt = Date.now();
    const nextResults: UploadResult[] = [];

    setSubmitting(true);
    try {
      for (const [index, file] of selected.entries()) {
        const mime = (file.type || "").toLowerCase();
        if (!ALLOWED_MIME_TYPES.includes(mime)) {
          nextResults.push({
            name: file.name,
            pathname: "",
            status: "error",
            message: "jpg/jpeg/pdf のみアップロードできます。",
          });
          continue;
        }

        if (file.size > maxBytes) {
          nextResults.push({
            name: file.name,
            pathname: "",
            status: "error",
            message: `最大サイズ ${Math.round(maxBytes / (1024 * 1024))}MB を超えています。`,
          });
          continue;
        }

        const safeName = sanitizeFileName(file.name);
        const pathname = `unprocessed/${today}/${startedAt + index}-${safeName}`;

        try {
          await upload(pathname, file, {
            access: "public",
            handleUploadUrl: "/api/blob/upload",
            clientPayload: JSON.stringify({ originalName: file.name }),
          });

          nextResults.push({
            name: file.name,
            pathname,
            status: "success",
            message: "アップロード受付完了（未処理キューに登録）",
          });
        } catch (err) {
          nextResults.push({
            name: file.name,
            pathname,
            status: "error",
            message: err instanceof Error ? err.message : "アップロードに失敗しました。",
          });
        }
      }

      setResults(nextResults);
      if (nextResults.every((r) => r.status === "error")) {
        setError("アップロードできませんでした。エラーメッセージをご確認ください。");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "アップロード中にエラーが発生しました。");
    } finally {
      setSubmitting(false);
    }
  };

  const maxMb = useMemo(() => Math.round((maxBytes / (1024 * 1024)) * 10) / 10, [maxBytes]);

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">
          領収書ファイル (.jpg / .jpeg / .pdf)
        </label>
        <input
          type="file"
          name="files"
          accept=".jpg,.jpeg,.pdf"
          multiple
          onChange={(e) => setFiles(e.currentTarget.files)}
          className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <p className="text-xs text-slate-500">
          最大サイズ: {maxMb}MB / ファイル。複数選択可能です。Blob に直接送信するため、URL は表示されません。
        </p>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {submitting ? "アップロード中..." : "Blob へアップロード"}
      </button>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {results.length ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold">アップロード結果</p>
          <ul className="space-y-2 text-sm">
            {results.map((file) => (
              <li
                key={`${file.name}-${file.pathname}`}
                className="rounded-md border border-slate-200 px-3 py-2"
              >
                <div className="font-medium">{file.name}</div>
                <div className="text-xs text-slate-500 break-all">
                  {file.status === "success" ? "受付番号: " : "パス: "}
                  {file.pathname || "-"}
                </div>
                <div
                  className={`text-xs ${
                    file.status === "success" ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {file.message}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </form>
  );
}
