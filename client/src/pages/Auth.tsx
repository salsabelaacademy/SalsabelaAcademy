import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth, getDashboardPath } from "@/hooks/use-auth";
import { PublicShell } from "@/components/PublicShell";
import TurnstileWidget, {
  useTurnstileConfig,
} from "@/components/TurnstileWidget";
export default function AuthPage() {
  const { t } = useTranslation(),
    { user, loading, login } = useAuth();
  const [, navigate] = useLocation();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [token, setToken] = useState(""),
    [reset, setReset] = useState(0);
  const config = useTurnstileConfig();
  const [showPassword,setShowPassword] = useState(false);
  useEffect(() => {
    if (!loading && user)
      navigate(getDashboardPath(user.role), { replace: true });
  }, [loading, user, navigate]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(false);
    const f = new FormData(e.currentTarget);
    try {
      const u = await login(
        String(f.get("email")),
        String(f.get("password")),
        token,
      );
      navigate(getDashboardPath(u.role));
    } catch {
      setError(true);
      setToken("");
      setReset((v) => v + 1);
    } finally {
      setBusy(false);
    }
  }
  return (
    <PublicShell>
      <section className="p4-section academy-auth">
        <div className="academy-auth-intro"><p className="p4-eyebrow">{t("p4.brand")}</p><h1>{t("experience.loginTitle")}</h1><p>{t("experience.loginIntro")}</p></div>
        <div className="academy-auth-grid">
        <aside className="academy-auth-new" aria-labelledby="new-student-title" data-reveal>
          <h2 id="new-student-title">{t("admission.newTitle")}</h2>
          <p>{t("admission.newBody")}</p>
          <ol>{[1,2,3].map(n=><li key={n}>{t("admission.step"+n)}</li>)}</ol>
          <Link href="/apply" className="p4-button">{t("admission.start")}</Link>
        </aside>
        <div className="academy-auth-existing" data-reveal>
        <h2>{t("p4.login")}</h2><p>{t("experience.loginHint")}</p>
        <form onSubmit={submit} className="p4-card p4-form-grid">
          <label className="p4-full">
            {t("p4.email")}
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              dir="ltr"
            />
          </label>
          <label className="p4-full">
            {t("admission.password")}
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
            />
          </label>
          <button type="button" className="p4-text-link p4-full auth-password-toggle" aria-pressed={showPassword} onClick={()=>setShowPassword(v=>!v)}>{t("experience."+(showPassword?"hidePassword":"showPassword"))}</button>
          <div className="p4-full">
            {config?.enabled && config.siteKey ? (
              <TurnstileWidget
                key={reset}
                siteKey={config.siteKey}
                onToken={setToken}
                onError={() => setToken("")}
              />
            ) : (
              !config?.developmentBypass && (
                <p>
                  {t(config ? "accountFlow.securityUnavailable" : "p4.loading")}
                </p>
              )
            )}
          </div>
          {error && (
            <p role="alert" className="p4-error p4-full">
              {t("p4.failed")}
            </p>
          )}
          <button
            className="p4-button p4-full"
            disabled={
              busy || !(config?.developmentBypass || (config?.enabled && token))
            }
          >
            {t(busy ? "p4.sending" : "p4.login")}
          </button>
          <Link className="p4-text-link p4-full" href="/forgot-password">
            {t("accountFlow.forgot")}
          </Link>

        </form>
        <div className="academy-auth-help"><h3>{t("admission.helpTitle")}</h3><p>{t("admission.helpBody")}</p><Link href="/contact" className="p4-text-link">{t("admission.contact")}</Link></div>
        </div></div>
      </section>
    </PublicShell>
  );
}
export function TurnstileState({ configured }: { configured: boolean }) {
  const { t } = useTranslation();
  return (
    <p>{t(configured ? "p4.security" : "accountFlow.securityUnavailable")}</p>
  );
}
