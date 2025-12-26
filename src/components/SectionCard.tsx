import type { ReactNode } from "react";

export function SectionCard(props: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h2 className="mb-3 text-base font-semibold">{props.title}</h2>
      {props.children}
    </section>
  );
}
