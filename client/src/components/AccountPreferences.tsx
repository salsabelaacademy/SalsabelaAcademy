import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/use-auth";
import { Moon, Mail, Monitor, Accessibility, ShieldCheck } from "lucide-react";
import { PushPreferences } from "./PushPreferences";
export function AccountPreferences() {
  const { t } = useTranslation(),
    { user } = useAuth(),
    { isDark, toggleTheme } = useTheme();
  const tr = (key: string) => t("preferences." + key);
  const delivery = useQuery<any>({
    queryKey: ["email-deliveries", user?.id],
    enabled: user?.role === "admin",
    queryFn: async () => {
      const r = await fetch("/api/admin/email-deliveries", {
        credentials: "include",
      });
      if (!r.ok) {
        const value = await r.json().catch(() => ({}));
        throw Error(value.code || "failed");
      }
      return r.json();
    },
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
  });
  const [retryEmpty, setRetryEmpty] = useState(false);
  const [email, setEmail] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [loaded, setLoaded] = useState(false);
  const [compact, setCompact] = useState(() => {
    try {
      return localStorage.getItem("academy-compact") === "true";
    } catch {
      return false;
    }
  });
  const [motion, setMotion] = useState(() => {
    try {
      return localStorage.getItem("academy-reduced-motion") === "true";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/portal/preferences", {
      credentials: "include",
      signal: c.signal,
    })
      .then(async (r) => {
        if (!r.ok) {
          const value = await r.json().catch(() => ({}));
          throw Error(value.code || "failed");
        }
        return r.json();
      })
      .then((v) => {
        setEmail(v.emailUpdates);
        setLoaded(true);
      })
      .catch(() => {
        if (!c.signal.aborted) setError(true);
      });
    return () => c.abort();
  }, [user?.id]);
  useEffect(() => {
    document.documentElement.classList.toggle("academy-compact", compact);
    document.documentElement.classList.toggle("academy-reduced-motion", motion);
    try {
      localStorage.setItem("academy-compact", String(compact));
      localStorage.setItem("academy-reduced-motion", String(motion));
    } catch {}
  }, [compact, motion]);
  async function updateEmail(value: boolean) {
    setBusy(true);
    setError(false);
    try {
      const r = await fetch("/api/portal/preferences", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailUpdates: value }),
      });
      if (!r.ok) {
        const value = await r.json().catch(() => ({}));
        throw Error(value.code || "failed");
      }
      setEmail(value);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="account-preferences">
      <section className="dash-panel">
        <h2>
          <Monitor size={21} />
          {tr("appearance")}
        </h2>
        <p>{tr("deviceHint")}</p>
        <label className="preference-row">
          <span>
            <Moon size={20} />
            <strong>{tr("dark")}</strong>
          </span>
          <input type="checkbox" checked={isDark} onChange={toggleTheme} />
        </label>
        <label className="preference-row">
          <span>
            <Monitor size={20} />
            <strong>{tr("compact")}</strong>
          </span>
          <input
            type="checkbox"
            checked={compact}
            onChange={(e) => setCompact(e.target.checked)}
          />
        </label>
        <label className="preference-row">
          <span>
            <Accessibility size={20} />
            <strong>{tr("motion")}</strong>
          </span>
          <input
            type="checkbox"
            checked={motion}
            onChange={(e) => setMotion(e.target.checked)}
          />
        </label>
      </section>
      <section className="dash-panel">
        <h2>
          <Mail size={21} />
          {tr("updates")}
        </h2>
        <p>{tr("emailHint")}</p>
        <label className="preference-row">
          <span>
            <ShieldCheck size={20} />
            <strong>{tr("email")}</strong>
          </span>
          <input
            type="checkbox"
            checked={email}
            disabled={busy || !loaded}
            onChange={(e) => void updateEmail(e.target.checked)}
          />
        </label>
        {error && <p role="alert">{t("p4.failed")}</p>}
        <p className="dash-muted">{tr("security")}</p>
      </section>
      <PushPreferences />
      {user?.role === "admin" && (
        <section className="dash-panel">
          <h2>{tr("mailStatus")}</h2>
          {delivery.isPending ? (
            <p>{t("p4.loading")}</p>
          ) : delivery.isError ? (
            <div role="alert">
              <p>
                {t(
                  "finalPolish." +
                    ((delivery.error as Error)?.message ===
                    "schema_update_required"
                      ? "schema_update_required"
                      : "failed"),
                )}
              </p>
              <button className="p4-control" onClick={() => delivery.refetch()}>
                {t("finalPolish.connectionRetry")}
              </button>
            </div>
          ) : (
            <>
              <p>
                {tr(
                  delivery.data.configured ? "mailConfigured" : "mailMissing",
                )}
              </p>
              {!delivery.data.configured && (
                <div className="service-setup">
                  <p>{t("finalPolish.emailSetup")}</p>
                  {delivery.data.missing?.length > 0 && (
                    <p>
                      {t("finalPolish.missing")}:{" "}
                      <bdi>{delivery.data.missing.join(", ")}</bdi>
                    </p>
                  )}
                  {delivery.data.invalidOrigin && (
                    <p>{t("finalPolish.invalidOrigin")}</p>
                  )}
                </div>
              )}
              <dl className="profile-summary">
                {["pending", "failed", "sent"].map((key) => (
                  <div key={key}>
                    <dt>{tr(key + "Mail")}</dt>
                    <dd>
                      {(delivery.data.counts?.[key] || 0) +
                        (key === "pending"
                          ? delivery.data.counts?.sending || 0
                          : 0)}
                    </dd>
                  </div>
                ))}
              </dl>
              {retryEmpty && <p role="status">{tr("noRecent")}</p>}
              {delivery.data.counts?.failed > 0 && (
                <button
                  className="p4-button"
                  disabled={busy || !delivery.data.configured}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const r = await fetch(
                        "/api/admin/email-deliveries/retry",
                        { method: "POST", credentials: "include" },
                      );
                      if (!r.ok) {
                        const value = await r.json().catch(() => ({}));
                        throw Error(value.code || "failed");
                      }
                      setRetryEmpty((await r.json()).count === 0);
                      await delivery.refetch();
                    } catch {
                      setError(true);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {tr("retryMail")}
                </button>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
