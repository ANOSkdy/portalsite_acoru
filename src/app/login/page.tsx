import { redirect } from "next/navigation";
import { loginAction } from "./actions";
import { getSessionUser } from "@/lib/auth";

export default async function LoginPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await props.searchParams;

  const session = await getSessionUser();
  if (session) redirect("/home");

  const hasError = Boolean(sp?.error);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-10">
      <div className="rounded-xl bg-white p-6 shadow">
        <h1 className="text-xl font-semibold">ログイン</h1>
        <p className="mt-1 text-sm text-slate-600">社内ポータルにサインインします</p>

        {hasError ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            メールアドレスまたはパスワードが正しくありません。
          </div>
        ) : null}

        <form action={loginAction} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium">メールアドレス</label>
            <input
              name="email"
              type="email"
              required
              autoComplete="username"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium">パスワード</label>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
          >
            ログイン
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-slate-500">
        セッションは最大30日保持されます。
      </p>
    </main>
  );
}
