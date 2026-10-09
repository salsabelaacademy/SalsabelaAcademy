import {conversationApi} from "@/lib/dashboard-api";
import type { ReactNode } from "react";
export type Row = Record<string, any>;
export const api = conversationApi;
export function Panel({ title, children }: { title: string; children: ReactNode }) { return <section className="academy-integration-card space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><h2 className="text-xl font-semibold">{title}</h2>{children}</section>; }
