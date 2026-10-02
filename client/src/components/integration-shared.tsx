import type { ReactNode } from "react";
export type Row = Record<string, any>;
export async function api(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`/api${path}`, { method, credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.code || "invalid_input");
  return data;
}
export function Panel({ title, children }: { title: string; children: ReactNode }) { return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><h2 className="text-xl font-semibold">{title}</h2>{children}</section>; }
