import { lazy, Suspense, useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  MessageCircle,
  X,
  Home,
  BookOpenCheck,
  ArrowUpRight,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { conversationApi, conversationPeople } from "@/lib/dashboard-api";
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
  useEffect(() => {
    const open = (e: Event) => {
      const id = (e as CustomEvent).detail;
      if (typeof id === "number") {
        setFocus(id);
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
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <Dialog.Trigger asChild>
        <button
          className="dashboard-chat-launcher"
          aria-label={t("dashboardUpdate.conversations")}
        >
          <MessageCircle size={25} />
          {count > 0 && <b>{count > 99 ? "99+" : count}</b>}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Content
          className="academy-messenger"
          dir={i18n.language.startsWith("ar") ? "rtl" : "ltr"}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <div
            className={
              "messenger-brand " +
              (view === "home" ? "messenger-brand-home" : "")
            }
          >
            <img
              src="/logo-icon.png"
              width={48}
              height={48}
              alt={t("p4.brand")}
            />
            <Dialog.Close aria-label={t("p4.close")}>
              <X size={20} />
            </Dialog.Close>
            <Dialog.Title>
              {view === "home"
                ? tr("welcome")
                : view === "assistant"
                  ? t("dashboardUpdate.assistant")
                  : t("dashboardUpdate.conversations")}
            </Dialog.Title>
            <Dialog.Description>
              {view === "home"
                ? tr(user?.role === "admin" ? "adminHint" : "studentHint")
                : t("dashboardUpdate.conversationIntro")}
            </Dialog.Description>
          </div>
          {view === "home" ? (
            <div className="messenger-home">
              <button
                className="messenger-home-card"
                onClick={() => setView("messages")}
              >
                <MessageCircle />
                <span>
                  <strong>{tr("send")}</strong>
                  <small>
                    {count > 0 ? tr("unread", { count } as any) : tr("direct")}
                  </small>
                </span>
                <ArrowUpRight />
              </button>
              <button
                className="messenger-home-card"
                onClick={() => setView("assistant")}
              >
                <BookOpenCheck />
                <span>
                  <strong>{t("dashboardUpdate.assistant")}</strong>
                  <small>{tr("aiHint")}</small>
                </span>
                <ArrowUpRight />
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
                onBack={
                  view === "assistant" ? () => setView("home") : undefined
                }
              />
            </Suspense>
          )}
          <nav className="messenger-tabs" aria-label={tr("navigation")}>
            {(
              [
                ["home", Home],
                ["messages", MessageCircle],
                ["assistant", BookOpenCheck],
              ] as const
            ).map(([key, Icon]) => (
              <button
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
                {key === "messages" && count > 0 && <b>{count}</b>}
              </button>
            ))}
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
