import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth, getDashboardPath } from "@/hooks/use-auth";
import { DisplayControls } from "@/components/PublicShell";
import TurnstileWidget, {
  useTurnstileConfig,
} from "@/components/TurnstileWidget";
// Optional self-hosted login image: put it in client/public/images/ and set this path.
const LOGIN_BACKGROUND: string | undefined = undefined; // e.g. '/images/login-background.webp'
export default function AuthPage() {
  const { t } = useTranslation(),
    { user, loading, login } = useAuth();
  const [, navigate] = useLocation();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [token, setToken] = useState(""),
    [reset, setReset] = useState(0);
  const config = useTurnstileConfig();
  const [showPassword, setShowPassword] = useState(false);
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
    <main className="login-studio">
      <div className="login-studio-controls">
        <Link href="/">{t("p4.home")}</Link>
        <DisplayControls />
      </div>
      <section className="login-studio-form">
        <div className="academy-auth-existing">
          <Link href="/" className="login-studio-logo">
            <img
              src="/logo-icon.png"
              width={72}
              height={72}
              alt={t("p4.brand")}
            />
          </Link>
          <h1>{t("messenger.signIn")}</h1>
          <p>{t("messenger.signInHint")}</p>
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
              <span className="auth-password-field">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  aria-label={t(
                    "experience." +
                      (showPassword ? "hidePassword" : "showPassword"),
                  )}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </span>
            </label>

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
                    {t(
                      config ? "accountFlow.securityUnavailable" : "p4.loading",
                    )}
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
                busy ||
                !(config?.developmentBypass || (config?.enabled && token))
              }
            >
              {t(busy ? "p4.sending" : "p4.login")}
            </button>
            <Link className="p4-text-link p4-full" href="/forgot-password">
              {t("accountFlow.forgot")}
            </Link>
          </form>
          <div className="login-studio-admission">
            <p>{t("dashboardUpdate.newStudent")}</p>
            <Link href="/apply" className="login-studio-apply">
              {t("admission.start")}
            </Link>
            <p>{t("admission.helpBody")}</p>
            <Link href="/contact" className="p4-text-link">
              {t("admission.contact")}
            </Link>
          </div>
        </div>
      </section>
      {/* Add your own 1600x1200 WebP to client/public/images/login-background.webp,
          then set LOGIN_BACKGROUND above. No external image request is needed. */}
      <aside
        className="login-studio-art"
        style={
          LOGIN_BACKGROUND
            ? {
                backgroundImage: `linear-gradient(0deg,rgba(10,34,43,.55),rgba(10,34,43,.05)),url(${LOGIN_BACKGROUND})`,
              }
            : undefined
        }
      >
        <div className="login-art-orbit" aria-hidden>
          <span />
          <img src="/logo-icon.png" width={220} height={220} alt="" />
          <i />
        </div>
        <div className="login-art-caption">
          <p>{t("messenger.salam")}</p>
          <h2>{t("dashboardUpdate.loginWelcome")}</h2>
          <p>{t("dashboardUpdate.loginBody")}</p>
        </div>
      </aside>
    </main>
  );
}
export function TurnstileState({ configured }: { configured: boolean }) {
  const { t } = useTranslation();
  return (
    <p>{t(configured ? "p4.security" : "accountFlow.securityUnavailable")}</p>
  );
}
