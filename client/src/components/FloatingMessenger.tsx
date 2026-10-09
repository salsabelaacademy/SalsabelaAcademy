import { lazy, Suspense, useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  X,
  Home,
  BookOpenCheck,
  ArrowRight,
} from "lucide-react";
import { AccountAvatar } from "./AccountAvatar";
import { CommunicationIcon } from "./CommunicationIcon";
import { ServiceErrorNotice } from "./ServiceErrorNotice";
import { useAuth } from "@/hooks/use-auth";
import { conversationPeople } from "@/lib/dashboard-api";
const Workspace = lazy(() =>
  import("./ConversationWorkspace").then((m) => ({
    default: m.ConversationWorkspace,
  })),
);
export function FloatingMessenger({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, i18n } = useTranslation(),
    { user } = useAuth();
  const tr = (key: string, options?: any) =>
    t("messenger." + key, options) as string;
  const [view, setView] = useState<"home" | "messages" | "assistant">("home");
  const [focus, setFocus] = useState<number | undefined>();
  const [recipientId, setRecipientId] = useState<number | undefined>();
  useEffect(() => {
    const open = (e: Event) => {
      const id = (e as CustomEvent).detail;
      if (typeof id === "number") {
        setFocus(id);
        setRecipientId(undefined);
        setView("messages");
      }
    };
    window.addEventListener("academy:open-chat", open);
    return () => window.removeEventListener("academy:open-chat", open);
  }, []);
  const people = useQuery<any[]>({
    queryKey: ["conversations", user?.id],
    queryFn: conversationPeople,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });
  const count = (Array.isArray(people.data) ? people.data : []).reduce(
    (sum, p) => sum + p.unread,
    0,
  );
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="dashboard-chat-launcher"
          aria-label={`${t("dashboardUpdate.conversations")}${count > 0 ? `, ${tr("unread", { count })}` : ""}`}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls="academy-messenger-dialog"
        >
          {open ? <ChevronDown size={25} strokeWidth={2} aria-hidden="true" /> : <CommunicationIcon filled size={26} />}
          {count > 0 && <b aria-hidden="true">{count > 99 ? "99+" : count}</b>}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="communication-overlay" />
        <Dialog.Content
          id="academy-messenger-dialog"
          className="academy-messenger"
          dir={i18n.language.startsWith("ar") ? "rtl" : "ltr"}
        >
          <div
            className={
              "messenger-brand " +
              (view === "home" ? "messenger-brand-home" : "")
            }
          >
            <div className="messenger-brand-topline">
              <img
                src="/logo-icon.png"
                width={42}
                height={42}
                alt={t("p4.brand")}
              />
            </div>
            <Dialog.Close asChild>
              <button type="button" className="messenger-close" aria-label={t("p4.close")}>
                <X size={19} aria-hidden="true" />
              </button>
            </Dialog.Close>
            <Dialog.Title>
              {view === "home"
                ? tr("welcome")
                : view === "assistant"
                  ? t("dashboardUpdate.assistant")
                  : t("dashboardUpdate.conversations")}
            </Dialog.Title>
            <Dialog.Description className="messenger-description">
              {view === "home"
                ? tr(user?.role === "admin" ? "adminHint" : "studentHint")
                : t("dashboardUpdate.conversationIntro")}
            </Dialog.Description>
          </div>
          <div className={"messenger-view messenger-view-" + view} key={view}>
          {view === "home" ? (
            <div className="messenger-home">
              {people.isPending && <p className="messenger-home-status" role="status">{t("p4.loading")}</p>}
              {people.isError && <ServiceErrorNotice error={people.error} retry={() => void people.refetch()} />}
              {people.data?.find((person) => person.lastMessage) && (() => {
                const recent = people.data.find((person) => person.lastMessage)!;
                return (
                  <button
                    type="button"
                    className="messenger-home-card messenger-recent"
                    onClick={() => {
                      setFocus(undefined);
                      setRecipientId(recent.id);
                      setView("messages");
                    }}
                  >
                    <span className="conversation-avatar">
                      {recent.role === "admin" && !recent.avatarUrl ? (
                        <img src="/logo-icon.png" width={44} height={44} alt="" />
                      ) : (
                        <AccountAvatar user={recent} />
                      )}
                    </span>
                    <span className="messenger-recent-copy">
                      <small>{t("communication.recent")}</small>
                      <strong>{recent.name}</strong>
                      <small className="messenger-preview">{recent.lastMessage}</small>
                    </span>
                    <ArrowRight className="messenger-forward" size={18} aria-hidden="true" />
                  </button>
                );
              })()}
              <button
                type="button"
                className="messenger-home-card"
                onClick={() => setView("messages")}
              >
                <span>
                  <strong>{tr("send")}</strong>
                  <small>
                    {count > 0 ? tr("unread", { count } as any) : tr("direct")}
                  </small>
                </span>
                <CommunicationIcon filled size={22} />
              </button>
              <button
                type="button"
                className="messenger-home-card"
                onClick={() => setView("assistant")}
              >
                <span>
                  <strong>{t("dashboardUpdate.assistant")}</strong>
                  <small>{tr("aiHint")}</small>
                </span>
                <BookOpenCheck size={22} strokeWidth={1.8} aria-hidden="true" />
              </button>
              <div className="messenger-home-note">
                <img src="/logo-icon.png" width={40} height={40} alt="" />
                <p>{tr("privacy")}</p>
              </div>
            </div>
          ) : (
            <Suspense fallback={<p role="status">{t("p4.loading")}</p>}>
              <Workspace
                key={view}
                initialAI={view === "assistant"}
                focusId={focus}
                initialRecipientId={recipientId}
                onBack={
                  view === "assistant" ? () => setView("home") : undefined
                }
              />
            </Suspense>
          )}
          </div>
          <nav className="messenger-tabs" aria-label={tr("navigation")}>
            {(
              [
                ["home", Home],
                ["messages", CommunicationIcon],
                ["assistant", BookOpenCheck],
              ] as const
            ).map(([key, Icon]) => (
              <button
                type="button"
                key={key}
                aria-current={view === key ? "page" : undefined}
                onClick={() => setView(key)}
              >
                <Icon size={21} />
                <span>
                  {key === "assistant"
                    ? t("dashboardUpdate.assistant")
                    : tr(key)}
                </span>
                {key === "messages" && count > 0 && <b aria-label={tr("unread", { count })}>{count > 99 ? "99+" : count}</b>}
              </button>
            ))}
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
