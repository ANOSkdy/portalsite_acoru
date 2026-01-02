import { requireSessionUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { getPortalContent } from "@/lib/portal";
import { Header } from "@/components/Header";
import { UploadClient } from "./UploadClient";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const user = await requireSessionUser();
  const portal = await getPortalContent(user);

  return (
    <div className="min-h-dvh">
      <Header user={user} companyName={portal.companyName} />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">領収書アップロード</h1>
          <p className="text-sm text-slate-600">
            JPEG / PDF の領収書を Vercel Blob の「未処理」キューに直接送信します。Gemini が6時間ごとに解析し、Neonへ登録します。
          </p>
        </div>

        <UploadClient maxBytes={env.MAX_FILE_BYTES} />

        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <p className="font-semibold text-slate-700">処理フロー</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>アップロードすると Blob の unprocessed/ 以下に入ります。</li>
            <li>Vercel Cron が6時間ごとに Gemini 解析 → Neon へINSERT。</li>
            <li>処理完了すると Blob の processed/ 以下へ移動します。</li>
          </ol>
        </div>
      </main>
    </div>
  );
}
