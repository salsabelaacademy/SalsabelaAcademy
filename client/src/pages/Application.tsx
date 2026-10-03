import { PageBackdrop } from '@/components/PageBackdrop';
import {useCourses} from '@/hooks/use-courses';
import { getCountries, getCountryCallingCode, isSupportedCountry, validateCountryPhone, type CountryCode } from '@shared/phone';
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/hooks/use-language";
import { PublicShell } from "@/components/PublicShell";
import TurnstileWidget, {
  useTurnstileConfig,
} from "@/components/TurnstileWidget";

export default function Application({
  contact = false,
}: {
  contact?: boolean;
}) {
  const { t } = useTranslation(),
    { language } = useLanguage();
  const tr = (k: string) => t("p4." + k);
  const [form, setForm] = useState<Record<string, string>>({
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    preferredLanguage: language,
    requestedProgram: '',
  });
  const [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false),
    [error, setError] = useState(""),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [token, setToken] = useState(""),
    [reset, setReset] = useState(0);
  const config = useTurnstileConfig();
  const {data:courses=[]}=useCourses();
  const regionNames = new Intl.DisplayNames([language], {type: 'region'});
  const countries = getCountries().map(code => [code, regionNames.of(code) || code]).sort((a,b) => a[1].localeCompare(b[1], language));
  useEffect(()=>{const selected=new URLSearchParams(window.location.search).get('course');const c=courses.find(c=>String(c.id)===selected||c.title===selected);if(c)setForm(f=>f.requestedProgram?f:{...f,requestedProgram:c.title});},[courses]);
  const fields = contact
    ? ["name", "email", "subject", "message"]
    : [
        "name",
        "email",
        "country",
        "phone",
        "timezone",
        "preferredLanguage",
        "requestedProgram",
        "ageGroup",
        "currentExperience",
        "learningGoals",
        "availability",
      ];
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const next: Record<string, string> = {};
    for (const k of fields) if (!form[k]?.trim()) next[k] = "fieldRequired";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = "invalidEmail";
    const validatedPhone = !contact ? validateCountryPhone(form.country || '', form.phone || '') : null;
    if (!contact && form.country && !isSupportedCountry(form.country)) next.country = 'invalidCountry';
    if (!contact && form.phone && !validatedPhone) next.phone = 'invalidCountryPhone';
    if (!contact && form.timezone) {
      try {
        new Intl.DateTimeFormat("en", { timeZone: form.timezone });
      } catch {
        next.timezone = "invalidTimezone";
      }
    }
    setErrors(next);
    if (Object.keys(next).length) {
      document.getElementById("field-" + Object.keys(next)[0])?.focus();
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await fetch(contact ? "/api/contact" : "/api/applications", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          ...(!contact && validatedPhone ? validatedPhone : {}),
          locale: language,
          turnstileToken: token,
        }),
      });
      if (!r.ok) {
        const response = await r.json().catch(() => ({}));
        if (response.fieldErrors) {
          setErrors(response.fieldErrors);
          document.getElementById('field-' + Object.keys(response.fieldErrors)[0])?.focus();
          return;
        }
        throw new Error(
          r.status === 409
            ? "duplicate"
            : r.status === 429
              ? "limited"
              : r.status === 403
                ? "security"
                : "failed",
        );
      }
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
      setToken("");
      setReset((v) => v + 1);
    }
  }
  return (
    <PublicShell>
      <section className="academy-apply-intro academy-hero-surface"><PageBackdrop variant={contact?'contact':'apply'} /><div className="container-wide"><p className="p4-eyebrow">{tr("brand")}</p>
        <h1>{tr(contact ? "contact" : "applicationTitle")}</h1>
        <p>{tr(contact ? "contactIntro" : "applicationIntro")}</p></div></section>
      <section className={contact ? "p4-section restore-contact-page" : "p4-section p4-form-page"}>
        {!contact && !sent && <p className="academy-application-note">{t("admission.applicationNote")}</p>}
        <div className={contact ? "restore-contact-layout" : ""}>
        {contact && <aside className="restore-contact-aside"><h2>{t("restore.contactHelp")}</h2><p>{t("restore.contactHelpBody")}</p>
          <Link href="/apply" className="p4-text-link">
            {tr("unified")}
          </Link>
        </aside>}
        {sent ? (
          <div role="status" className="p4-card">
            {tr(contact ? "contactReceived" : "received")}
            {!contact && <div className="academy-application-note"><h2>{t("admission.nextTitle")}</h2><p>{t("admission.nextBody")}</p></div>}
          </div>
        ) : (
          <form noValidate onSubmit={submit} className="restore-form-panel p4-form-grid">
            {fields.map((k) => {
              const options =
                k === "country" ? countries : k === "preferredLanguage"
                  ? [
                      ["en", tr("english")],
                      ["ar", tr("arabic")],
                    ]
                  : k === "ageGroup"
                    ? ["child", "teenager", "adult"].map((v) => [v, tr(v)])
                    : k === "requestedProgram"
                      ? courses.map(c => [c.title, language==='ar' ? c.titleAr || c.title : c.title])
                      : null;
              const props = {
                id: "field-" + k,
                "aria-label": tr(k),
                name: k,
                value: form[k] || "",
                required: true,
                "aria-invalid": !!errors[k],
                "aria-describedby": errors[k] ? "error-" + k : k === 'phone' ? 'phone-hint' : undefined,
                onChange: (e: any) => { setForm({ ...form, [k]: e.target.value }); setErrors(previous => {const next = {...previous}; delete next[k]; if (k === 'country') { delete next.phone; if (form.phone && e.target.value && !validateCountryPhone(e.target.value, form.phone)) next.phone = 'invalidCountryPhone'; } return next;}); },
              };
              return (
                <label
                  key={k}
                  className={
                    ["message", "learningGoals", "availability"].includes(k)
                      ? "p4-full"
                      : ""
                  }
                >
                  {tr(k)}
                  {options ? (
                    <select {...props} autoComplete={k === 'country' ? 'country' : undefined}>
                      <option value="">{tr("choose")}</option>
                      {options.map(([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                  ) : ["message", "learningGoals", "availability"].includes(
                      k,
                    ) ? (
                    <textarea {...props} maxLength={5000} rows={4} />
                  ) : (
                    <input
                      {...props}
                      type={
                        k === "email" ? "email" : k === "phone" ? "tel" : "text"
                      }
                      maxLength={k === "currentExperience" ? 5000 : 200}
                      disabled={k === 'phone' && !form.country}
                      placeholder={k === 'phone' && isSupportedCountry(form.country || '') ? '+' + getCountryCallingCode(form.country as CountryCode) + ' …' : undefined}
                      onBlur={k === 'phone' ? () => { if(form.phone) setErrors(e => ({...e, phone: validateCountryPhone(form.country || '', form.phone) ? '' : 'invalidCountryPhone'})); } : undefined}
                      autoComplete={
                        k === "name"
                          ? "name"
                          : k === "email"
                            ? "email"
                            : k === "phone"
                              ? "tel"
                              : undefined
                      }
                      dir={
                        ["email", "phone", "timezone"].includes(k)
                          ? "ltr"
                          : undefined
                      }
                    />
                  )}
                  {k === 'phone' && <span id="phone-hint" className="text-sm text-slate-600 dark:text-slate-300">{tr('countryPhoneHint')}{isSupportedCountry(form.country || '') && <bdi> (+{getCountryCallingCode(form.country as CountryCode)})</bdi>}</span>}
                  {errors[k] && (
                    <span className="p4-error" id={"error-" + k}>
                      {tr(errors[k])}
                    </span>
                  )}
                </label>
              );
            })}
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
                {tr(error)}
              </p>
            )}
            <button
              className="p4-button p4-full"
              disabled={
                busy ||
                !(config?.developmentBypass || (config?.enabled && token))
              }
            >
              {tr(busy ? "sending" : contact ? "send" : "submit")}
            </button>
          </form>
        )}
        </div>
      </section>
    </PublicShell>
  );
}
