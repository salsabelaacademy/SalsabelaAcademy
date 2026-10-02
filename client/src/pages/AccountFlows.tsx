import { useState, type FormEvent } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import TurnstileWidget, { useTurnstileConfig } from "@/components/TurnstileWidget";

async function post(path: string, body: unknown) {
  const response = await fetch(path, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(response.status === 429 ? "limited" : "failed");
}
export default function AccountFlow({ mode }: { mode: "forgot" | "reset" | "invite" | "verify" | "password" | "resend" }) {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { t } = useTranslation();
  const tr = (key: string) => t(`accountFlow.${key}`);
  const { logout } = useAuth();
  const token = new URLSearchParams(search).get("token") || "";
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false), [challengeKey, setChallengeKey] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState("");
  const config = useTurnstileConfig();
  const needsChallenge = ["forgot", "resend", "reset", "invite"].includes(mode);
  const isRequest = mode === "forgot" || mode === "resend", isSetPassword = ["reset", "invite", "password"].includes(mode);
  const missingToken = ["reset", "invite", "verify"].includes(mode) && !token;
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setMessage(""); setBusy(true);
    try {
      if (isRequest) { await post(mode === "resend" ? "/api/auth/resend-verification" : "/api/auth/forgot-password", { email, turnstileToken, locale: document.documentElement.lang }); setMessage(mode === "resend" ? "verificationSent" : "resetSent"); }
      else if (mode === "verify") { await post("/api/auth/verify-email", { token }); setMessage("verified"); }
      else {
        if (password !== confirm) throw new Error("mismatch");
        const path = mode === "invite" ? "/api/auth/accept-invitation" : mode === "reset" ? "/api/auth/reset-password" : "/api/auth/change-password";
        await post(path, { token, password, turnstileToken, currentPassword: mode === "password" ? email : undefined });
        if (mode === "password") { await logout(); navigate("/login"); } else setMessage("saved");
      }
    } catch (e) { setError(e instanceof Error ? e.message : "failed"); }
    finally { if (needsChallenge) { setTurnstileToken(""); setChallengeKey(k => k + 1); } setBusy(false); }
  }
  return <main className="p4-account flex min-h-screen items-center justify-center bg-slate-50 p-5 dark:bg-slate-950"><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-xl dark:border-slate-800 dark:bg-slate-900">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/login" className="text-sm text-primary">{tr("back")}</Link><LanguageSwitcher /></div>
    <h1 className="mt-7 text-2xl font-bold">{tr(mode)}</h1><p className="mt-2 text-sm text-slate-500">{tr(isRequest ? "privacy" : "hint")}</p>
    {mode === "verify" && <Link href="/resend-verification" className="mt-3 block text-sm underline">{tr("resend")}</Link>}
    <form onSubmit={submit} className="mt-7 space-y-4">
      {isRequest && <label className="grid gap-2">{tr("email")}<Input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>}
      {mode === "password" && <label className="grid gap-2">{tr("current")}<Input type="password" autoComplete="current-password" required value={email} onChange={e => setEmail(e.target.value)} /></label>}
      {isSetPassword && <><label className="grid gap-2">{tr("new")}<Input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} /></label><label className="grid gap-2">{tr("confirm")}<Input type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} /></label></>}
      {needsChallenge && (config?.enabled && config.siteKey ? <TurnstileWidget key={challengeKey} siteKey={config.siteKey} onToken={setTurnstileToken} onError={() => setTurnstileToken("")} /> : <p>{tr(config?.developmentBypass ? "development" : "securityUnavailable")}</p>)}
      {(error || missingToken) && <p role="alert" className="text-sm text-red-600">{tr(missingToken ? "missingToken" : error)}</p>}
      {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{tr(message)}</p>}
      {message === "saved" && <Link href="/login" className="p4-button">{t("admission.signIn")}</Link>}
      <Button type="submit" disabled={busy || missingToken || Boolean(needsChallenge && !(config?.developmentBypass || (config?.enabled && turnstileToken)))} className="w-full">{tr(busy ? "saving" : mode === "verify" ? "verifyButton" : mode === "resend" ? "resend" : isRequest ? "send" : "continue")}</Button>
    </form></section></main>;
}
