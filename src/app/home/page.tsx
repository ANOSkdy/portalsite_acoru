import { requireSessionUser } from "@/lib/auth";
import { getPortalContent } from "@/lib/portal";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { SectionCard } from "@/components/SectionCard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireSessionUser();
  const content = await getPortalContent(user);

  return (
    <div className="min-h-dvh">
      <Header user={user} companyName={content.companyName} />

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <Hero companyName={content.companyName} message={content.heroMessage} videoSrc={content.heroVideoSrc} />

        <div className="grid gap-6">
          <SectionCard title="社内周知">
            <ul className="space-y-3">
              {content.announcements.length ? (
                content.announcements.map((a) => (
                  <li key={a.id} className="rounded-md border border-slate-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{a.title}</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{a.body}</p>
                      </div>
                      {a.isPinned ? (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                          重要
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))
              ) : (
                <li className="text-sm text-slate-500">現在、周知はありません。</li>
              )}
            </ul>
          </SectionCard>

          <SectionCard title="通知">
            <ul className="space-y-2">
              {content.notifications.length ? (
                content.notifications.map((n) => (
                  <li key={n.id} className="rounded-md border border-slate-200 bg-white p-3">
                    <p className="font-medium">{n.title}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{n.body}</p>
                  </li>
                ))
              ) : (
                <li className="text-sm text-slate-500">現在、通知はありません。</li>
              )}
            </ul>
          </SectionCard>
        </div>

        <div className="grid gap-6">
          <SectionCard title="リンク集">
            <ul className="space-y-2">
              {content.links.length ? (
                content.links.map((l) => (
                  <li key={l.id}>
                    <a
                      href={l.url}
                      className="block rounded-md border border-slate-200 bg-white p-3 hover:bg-slate-50"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{l.name}</p>
                          {l.description ? (
                            <p className="mt-1 text-sm text-slate-600">{l.description}</p>
                          ) : null}
                        </div>
                        <span className="text-slate-400">↗</span>
                      </div>
                    </a>
                  </li>
                ))
              ) : (
                <li className="text-sm text-slate-500">リンクが未登録です（後ほど追加してください）。</li>
              )}
            </ul>
          </SectionCard>

          <SectionCard title="連絡先 / よくあるお問い合わせ">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">連絡先</h3>
                <ul className="mt-2 space-y-2">
                  {content.contacts.length ? (
                    content.contacts.map((c) => (
                      <li key={c.id} className="rounded-md border border-slate-200 bg-white p-3">
                        <p className="font-medium">{c.department}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          {c.name ? `${c.name} / ` : ""}
                          {c.email ? (
                            <a className="underline" href={`mailto:${c.email}`}>{c.email}</a>
                          ) : null}
                          {c.phone ? ` / ${c.phone}` : ""}
                        </p>
                        {c.notes ? <p className="mt-1 text-xs text-slate-500">{c.notes}</p> : null}
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-slate-500">連絡先が未登録です。</li>
                  )}
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-700">FAQ</h3>
                <ul className="mt-2 space-y-2">
                  {content.faqs.length ? (
                    content.faqs.map((f) => (
                      <li key={f.id} className="rounded-md border border-slate-200 bg-white p-3">
                        <p className="font-medium">{f.question}</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{f.answer}</p>
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-slate-500">FAQが未登録です。</li>
                  )}
                </ul>
              </div>
            </div>
          </SectionCard>
        </div>
      </main>
    </div>
  );
}
