import type { SessionUser } from "@/lib/session";

export function Header(props: { user: SessionUser; companyName: string }) {
  const { user, companyName } = props;

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="h-8 w-8" />
          <span className="text-lg font-semibold">{companyName}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">
            {user.name}（{user.email}）
          </span>
          <form action="/api/logout" method="post">
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              ログアウト
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
