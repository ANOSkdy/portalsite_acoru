'use client';

import { useState } from "react";

type UploadResult = {
  id: string;
  name: string;
  mimeType: string;
};

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

    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));

    setSubmitting(true);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "アップロードに失敗しました。");
        return;
      }
      setResults(data.files ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "アップロード中にエラーが発生しました。");
    } finally {
      setSubmitting(false);
    }
  };

  const maxMb = Math.round((maxBytes / (1024 * 1024)) * 10) / 10;

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
          最大サイズ: {maxMb}MB / ファイル。複数選択可能です。
        </p>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {submitting ? "アップロード中..." : "Driveへアップロード"}
      </button>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {results.length ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold">アップロード済み</p>
          <ul className="space-y-2 text-sm">
            {results.map((file) => (
              <li key={file.id} className="rounded-md border border-slate-200 px-3 py-2">
                <div className="font-medium">{file.name}</div>
                <div className="text-xs text-slate-500 break-all">ID: {file.id}</div>
                <div className="text-xs text-slate-500">{file.mimeType}</div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </form>
  );
}
