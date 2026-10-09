import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bell, CheckCheck, Mail, CalendarDays } from "lucide-react";
import { conversationApi } from "@/lib/dashboard-api";
export function NotificationFeed({
  items,
  date,
  onDone,
}: {
  items: any[];
  date: (value: string) => string;
  onDone: () => void;
}) {
  const { t } = useTranslation(),
    tr = (k: string) => t("dashboardUpdate." + k);
  const [unreadOnly, setUnreadOnly] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const unread = items.filter((n) => !n.read_at);
  async function read(id?: number) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await conversationApi(
        id ? "/notifications/" + id + "/read" : "/notifications/read-all",
        "PATCH",
      );
      onDone();
    } catch {
      setError("failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="notification-center">
      <header className="notification-center-header">
        <span className="notification-symbol">
          <Bell size={28} />
        </span>
        <div>
          <h2>{t("p4.notifications")}</h2>
          <p>{tr("notificationIntro")}</p>
        </div>
        <button
          className="p4-button"
          disabled={busy || !unread.length}
          onClick={() => read()}
        >
          <CheckCheck size={18} />
          {tr("allRead")}
        </button>
      </header>
      <div className="notification-tabs">
        <button aria-pressed={!unreadOnly} onClick={() => setUnreadOnly(false)}>
          {tr("all")} <b>{items.length}</b>
        </button>
        <button aria-pressed={unreadOnly} onClick={() => setUnreadOnly(true)}>
          {tr("unread")} <b>{unread.length}</b>
        </button>
      </div>
      {error && <p role="alert">{tr(error)}</p>}
      <div className="notification-feed">
        {items
          .filter((n) => !unreadOnly || !n.read_at)
          .map((n) => {
            const Icon = n.title.includes("message")
              ? Mail
              : n.title.includes("lesson")
                ? CalendarDays
                : Bell;
            return (
              <article
                className={
                  "notification-card" + (!n.read_at ? " notification-new" : "")
                }
                key={n.id}
                data-search-target={"notification:" + n.id}
              >
                <span className="notification-card-icon">
                  <Icon size={21} />
                </span>
                <div>
                  <header>
                    <h3>
                      {n.title.startsWith("notify_")
                        ? t("p4." + n.title)
                        : n.title}
                    </h3>
                    {!n.read_at && (
                      <span
                        className="notification-dot"
                        aria-label={tr("unread")}
                      />
                    )}
                  </header>
                  <p>{n.body}</p>
                  <time dateTime={n.created_at}>{date(n.created_at)}</time>
                </div>
                {!n.read_at && (
                  <button
                    className="notification-read"
                    disabled={busy}
                    onClick={() => read(n.id)}
                    aria-label={t("p4.markRead")}
                  >
                    <CheckCheck size={20} />
                  </button>
                )}
              </article>
            );
          })}
        {(!items.length || (unreadOnly && !unread.length)) && (
          <div className="notification-empty">
            <CheckCheck size={40} />
            <h3>{tr("emptyNotifications")}</h3>
          </div>
        )}
      </div>
    </section>
  );
}
