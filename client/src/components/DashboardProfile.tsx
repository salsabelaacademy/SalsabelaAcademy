import { getCountries } from "@shared/phone";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PushPreferences } from "./PushPreferences";
import { AccountAvatar } from "./AccountAvatar";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import {
  ShieldCheck,
  UserRound,
  Camera,
  Mail,
  Globe2,
  MapPin,
  CalendarDays,
  LockKeyhole,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";

export function DashboardProfile({ onSaved }: { onSaved: () => void }) {
  const { user, refreshUser } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();
  const tr = (key: string) => t("p4." + key);
  const detail = (key: string) => t("refinement." + key);
  const regionNames = new Intl.DisplayNames([language], { type: "region" });
  const countries = getCountries()
    .map((code) => ({ code, name: regionNames.of(code) || code }))
    .sort((a, b) => a.name.localeCompare(b.name, language));
  const [account, setAccount] = useState<any>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageMessage, setImageMessage] = useState("");
  async function changeAvatar(file?: File) {
    if (imageBusy) return;
    setImageBusy(true);
    setImageMessage("");
    let bitmap: ImageBitmap | undefined;
    try {
      let encoded: string | undefined;
      if (file) {
        if (
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size > 5 * 1024 * 1024
        )
          throw new Error("avatarInvalid");
        bitmap = await createImageBitmap(file);
        const canvas = document.createElement("canvas");
        canvas.width = 384;
        canvas.height = 384;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("avatarInvalid");
        const side = Math.min(bitmap.width, bitmap.height);
        context.drawImage(
          bitmap,
          (bitmap.width - side) / 2,
          (bitmap.height - side) / 2,
          side,
          side,
          0,
          0,
          384,
          384,
        );
        encoded = canvas.toDataURL("image/webp", 0.82);
        if (encoded.length > 240000) throw new Error("avatarInvalid");
      }
      const response = await fetch("/api/portal/avatar", {
        method: file ? "PUT" : "DELETE",
        credentials: "include",
        ...(file
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ image: encoded }),
            }
          : {}),
      });
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? "limited"
            : response.status === 400
              ? "avatarInvalid"
              : "failed",
        );
      await refreshUser();
      setImageMessage("saved");
    } catch (error) {
      setImageMessage(
        error instanceof Error &&
          ["avatarInvalid", "limited", "failed"].includes(error.message)
          ? error.message
          : "avatarInvalid",
      );
    } finally {
      bitmap?.close();
      setImageBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch("/api/portal/account", {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("failed");
        return r.json();
      })
      .then(setAccount)
      .catch((e) => {
        if (e.name !== "AbortError") setError("failed");
      });
    return () => controller.abort();
  }, [revision]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch("/api/portal/account", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok)
        throw new Error(response.status === 400 ? "profileInvalid" : "failed");
      await refreshUser();
      onSaved();
      setSaved(true);
      setRevision((v) => v + 1);
      if (values.preferredLanguage)
        setLanguage(values.preferredLanguage as "ar" | "en");
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }
  const complete = account
    ? [
        account.name,
        account.phone,
        account.country,
        account.city,
        account.date_of_birth,
        account.bio,
      ].filter(Boolean).length
    : 0;
  return (
    <section className="dash-profile-page profile-studio">
      <header className="profile-studio-hero">
        <button
          type="button"
          className="dash-profile-portrait"
          aria-label={tr("changePhoto")}
          disabled={imageBusy}
          onClick={() => fileInput.current?.click()}
        >
          <AccountAvatar user={user} />
          <span className="profile-camera">
            <Camera size={17} aria-hidden />
          </span>
        </button>
        <div className="profile-hero-copy">
          <span className="profile-eyebrow">{t("finalPolish.account")}</span>
          <h2>{user?.name}</h2>
          <p>
            <Mail size={16} aria-hidden />
            <bdi>{user?.email}</bdi>
          </p>
          <span className="dash-profile-role">
            <ShieldCheck size={16} aria-hidden />
            {tr(user?.role === "admin" ? "adminRole" : "studentRole")}
          </span>
        </div>
        <div className="profile-portrait-actions">
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label={tr("changePhoto")}
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void changeAvatar(file);
            }}
          />
          <button
            className="p4-control"
            disabled={imageBusy}
            onClick={() => fileInput.current?.click()}
          >
            <Camera size={17} aria-hidden />
            {tr(imageBusy ? "sending" : "changePhoto")}
          </button>
          {user?.avatarUrl && (
            <button
              className="p4-text-link"
              disabled={imageBusy}
              onClick={() => void changeAvatar()}
            >
              {tr("removePhoto")}
            </button>
          )}
          <small>{tr("avatarHint")}</small>
          {imageMessage && (
            <p role={imageMessage === "saved" ? "status" : "alert"}>
              {tr(imageMessage)}
            </p>
          )}
        </div>
      </header>
      <div className="profile-studio-layout">
        <aside className="profile-studio-aside">
          <section className="dash-panel profile-health">
            <h3>{t("preferences.profileProgress")}</h3>
            <div
              className="profile-health-ring"
              style={
                {
                  "--profile-progress": `${(complete / 6) * 100}%`,
                } as React.CSSProperties
              }
            >
              <strong>
                {Math.round((complete / 6) * 100)}
                <small>%</small>
              </strong>
            </div>
            <progress
              max={6}
              value={complete}
              aria-label={t("preferences.profileProgress")}
            />
            <p>{t("preferences.profileProgressHint")}</p>
          </section>
          {account && (
            <section className="dash-panel">
              <h3>{t("experience.accountSummary")}</h3>
              <dl className="profile-summary">
                {[
                  ["status", tr("states." + account.status)],
                  [
                    "joined",
                    account.created_at
                      ? new Intl.DateTimeFormat(language, {
                          dateStyle: "medium",
                        }).format(new Date(account.created_at))
                      : "—",
                  ],
                  [
                    "lastLogin",
                    account.last_login_at
                      ? new Intl.DateTimeFormat(language, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(account.last_login_at))
                      : "—",
                  ],
                ].map(([key, value]) => (
                  <div key={key}>
                    <dt>{t("experience." + key)}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
                <div>
                  <dt>{tr("email")}</dt>
                  <dd>
                    {t(
                      "experience." +
                        (account.email_verified_at ? "verified" : "unverified"),
                    )}
                  </dd>
                </div>
              </dl>
            </section>
          )}
          <section className="dash-panel profile-safe">
            <LockKeyhole size={24} aria-hidden />
            <h3>{tr("accountSecurity")}</h3>
            <p>{tr("profileSecurityHint")}</p>
            <Link className="p4-control" href="/account/password">
              {tr("password")}
            </Link>
          </section>
        </aside>
        <div className="profile-studio-main dash-panel">
          <header className="profile-form-heading">
            <h2>{tr("personalDetails")}</h2>
            <p>{t("finalPolish.details")}</p>
          </header>
          {!account && !error && <p role="status">{tr("loading")}</p>}
          {account && (
            <form onSubmit={submit} className="profile-studio-form">
              <fieldset>
                <legend>
                  <UserRound size={18} aria-hidden />
                  {t("finalPolish.personal")}
                </legend>
                <div className="dash-profile-form">
                  <label>
                    {tr("name")}
                    <input
                      name="name"
                      defaultValue={account.name}
                      autoComplete="name"
                      minLength={2}
                      maxLength={200}
                      required
                    />
                  </label>
                  <label>
                    {detail("dob")} <small>{detail("optional")}</small>
                    <input
                      name="dateOfBirth"
                      type="date"
                      defaultValue={account.date_of_birth || ""}
                      min="1900-01-01"
                      max={new Date().toISOString().slice(0, 10)}
                      autoComplete="bday"
                    />
                  </label>
                </div>
              </fieldset>
              <fieldset>
                <legend>
                  <MapPin size={18} aria-hidden />
                  {t("finalPolish.contact")}
                </legend>
                <div className="dash-profile-form">
                  <label>
                    {tr("email")}
                    <input
                      value={account.email}
                      readOnly
                      type="email"
                      aria-describedby="profile-email-hint"
                      dir="ltr"
                    />
                    <small id="profile-email-hint">
                      {tr("profileEmailHint")}
                    </small>
                  </label>
                  <label>
                    {tr("phone")}
                    <input
                      name="phone"
                      type="tel"
                      defaultValue={account.phone || ""}
                      autoComplete="tel"
                      maxLength={30}
                    />
                  </label>
                  <label>
                    {tr("country")}
                    <select
                      name="country"
                      defaultValue={account.country || ""}
                      autoComplete="country"
                    >
                      <option value="">{detail("optional")}</option>
                      {account.country &&
                        !countries.some((c) => c.code === account.country) && (
                          <option value={account.country}>
                            {account.country}
                          </option>
                        )}
                      {countries.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {detail("city")}
                    <input
                      name="city"
                      defaultValue={account.city || ""}
                      autoComplete="address-level2"
                      maxLength={100}
                    />
                  </label>
                </div>
              </fieldset>
              <fieldset>
                <legend>
                  <Globe2 size={18} aria-hidden />
                  {t("finalPolish.learning")}
                </legend>
                <div className="dash-profile-form">
                  <label>
                    {tr("timezone")}
                    <select
                      name="timezone"
                      defaultValue={
                        account.timezone ||
                        Intl.DateTimeFormat().resolvedOptions().timeZone
                      }
                      dir="ltr"
                      required
                    >
                      {Array.from(
                        new Set([
                          account.timezone ||
                            Intl.DateTimeFormat().resolvedOptions().timeZone,
                          ...((Intl as any).supportedValuesOf?.("timeZone") || [
                            "UTC",
                            "Africa/Cairo",
                          ]),
                        ]),
                      ).map((zone) => (
                        <option key={String(zone)} value={String(zone)}>
                          {String(zone)}
                        </option>
                      ))}
                    </select>
                    <small>{tr("timezoneExample")}</small>
                  </label>
                  <label>
                    {tr("preferredLanguage")}
                    <select
                      name="preferredLanguage"
                      defaultValue={
                        account.preferred_language === "ar"
                          ? "ar"
                          : account.preferred_language === "en"
                            ? "en"
                            : language
                      }
                    >
                      <option value="ar">{tr("arabic")}</option>
                      <option value="en">{tr("english")}</option>
                    </select>
                  </label>
                </div>
              </fieldset>
              <fieldset>
                <legend>
                  <CalendarDays size={18} aria-hidden />
                  {t("finalPolish.about")}
                </legend>
                <label>
                  {detail("bio")}
                  <textarea
                    name="bio"
                    defaultValue={account.bio || ""}
                    rows={3}
                    maxLength={1000}
                  />
                  <small>{detail("bioHint")}</small>
                </label>
              </fieldset>
              <footer className="profile-form-footer">
                <p className="dash-profile-privacy">
                  <ShieldCheck size={17} aria-hidden />
                  {detail("profilePrivacy")}
                </p>
                <button className="p4-button" disabled={busy}>
                  {tr(busy ? "sending" : "save")}
                </button>
                {saved && <p role="status">{tr("saved")}</p>}
              </footer>
            </form>
          )}
          {error && <p role="alert">{tr(error)}</p>}
          {!account && error && (
            <button
              className="p4-button"
              onClick={() => setRevision((v) => v + 1)}
            >
              {tr("retry")}
            </button>
          )}
        </div>
      </div>
      <div className="profile-push-preferences">
        <PushPreferences />
      </div>
    </section>
  );
}
