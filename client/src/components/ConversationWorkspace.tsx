import { AccountAvatar } from "./AccountAvatar";
import { ServiceErrorNotice } from "./ServiceErrorNotice";
import { conversationApi, conversationPeople } from "@/lib/dashboard-api";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Send,
  ArrowLeft,
  BookOpenCheck,
  MessageCircle,
  Search,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
type Person = {
  id: number;
  name: string;
  role?: string;
  avatarUrl?: string;
  unread: number;
};
type Message = {
  id: number;
  sender_id: number;
  subject: string;
  body: string;
  created_at: string;
};

export function ConversationWorkspace({
  initialAI = false,
  focusId,
  onBack,
}: { initialAI?: boolean; focusId?: number; onBack?: () => void } = {}) {
  const { user } = useAuth(),
    { t, i18n } = useTranslation(),
    tr = (k: string) => t("dashboardUpdate." + k),
    client = useQueryClient();
  const [selected, setSelected] = useState<number | null>(null),
    [search, setSearch] = useState(""),
    [ai, setAi] = useState(initialAI),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [key, setKey] = useState(() => crypto.randomUUID()),
    [older, setOlder] = useState<Message[]>([]),
    [hasOlder, setHasOlder] = useState(true);
  const bottom = useRef<HTMLDivElement>(null),
    autoSelected = useRef(false);
  const [answers, setAnswers] = useState<
    { role: "user" | "model"; text: string }[]
  >([]);
  const people = useQuery<Person[]>({
    queryKey: ["conversations", user?.id],
    queryFn: conversationPeople,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const chat = useQuery<{ messages: Message[]; hasMore: boolean }>({
    queryKey: ["conversation", user?.id, selected],
    queryFn: async () => {
      const value = await conversationApi("/conversations/" + selected);
      if (!Array.isArray(value?.messages) || typeof value.hasMore !== "boolean")
        throw Error("api_response_invalid");
      return value;
    },
    enabled: Boolean(selected) && !ai,
    refetchInterval: 3000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const config = useQuery<{ configured: boolean }>({
    queryKey: ["assistant-config", user?.id],
    queryFn: async () => {
      const value = await conversationApi("/assistant/config");
      if (typeof value?.configured !== "boolean")
        throw Error("api_response_invalid");
      return value;
    },
    enabled: ai,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const messages = Array.from(
    new Map(
      [...older, ...(chat.data?.messages || [])].map((m) => [m.id, m]),
    ).values(),
  ).sort((a, b) => a.id - b.id);
  const other = people.data?.find((p) => p.id === selected);
  useEffect(() => {
    if (
      !initialAI &&
      user?.role === "student" &&
      people.data?.length === 1 &&
      !autoSelected.current
    ) {
      autoSelected.current = true;
      setSelected(people.data[0].id);
    }
  }, [people.data, selected, user?.role]);
  useEffect(() => {
    if (ai || !selected || !other?.unread || document.hidden) return;
    void conversationApi("/conversations/" + selected + "/read", "POST")
      .then(() =>
        client.invalidateQueries({ queryKey: ["conversations", user?.id] }),
      )
      .catch(() => {});
  }, [selected, other?.unread, chat.data, ai, client]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest", behavior: "auto" });
  }, [chat.data?.messages.at(-1)?.id, answers.length]);
  useEffect(() => {
    const target = new URLSearchParams(location.search).get("focus");
    if (focusId || target?.startsWith("message:")) {
      void conversationApi("/messages")
        .then((items: any[]) => {
          const message = items.find(
            (m) => m.id === (focusId || Number(target?.split(":")[1])),
          );
          if (message)
            setSelected(
              message.senderId === user?.id
                ? message.recipientId
                : message.senderId,
            );
        })
        .catch(() => {});
    }
  }, [user?.id, focusId]);
  const choose = (id: number) => {
    setSelected(id);
    setAi(false);
    setOlder([]);
    setHasOlder(true);
    setError("");
    setText("");
    setKey(crypto.randomUUID());
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !text.trim()) return;
    setBusy(true);
    setError("");
    try {
      if (ai) {
        const input = [
          ...answers,
          { role: "user" as const, text: text.trim() },
        ].slice(-11);
        const result = await conversationApi("/assistant/chat", "POST", {
          language: i18n.language.startsWith("ar") ? "ar" : "en",
          messages: input,
        });
        setAnswers([...input, { role: "model", text: result.text }]);
      } else {
        await conversationApi("/conversations/" + selected, "POST", {
          body: text.trim(),
          requestKey: key,
        });
        await Promise.all([
          client.invalidateQueries({
            queryKey: ["conversation", user?.id, selected],
          }),
          client.invalidateQueries({ queryKey: ["conversations", user?.id] }),
        ]);
        setKey(crypto.randomUUID());
      }
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }
  async function loadOlder() {
    if (busy || !messages.length) return;
    setBusy(true);
    try {
      const result = await conversationApi(
        "/conversations/" + selected + "?before=" + messages[0].id,
      );
      setOlder((previous) => [...result.messages, ...previous]);
      setHasOlder(result.hasMore);
    } catch {
      setError("failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className={
        "conversation-workspace" +
        (selected || ai ? " conversation-selected" : "")
      }
    >
      <aside className="conversation-sidebar">
        <header>
          <h2>{tr("conversations")}</h2>
          <small>{tr("live")}</small>
        </header>
        <button
          className={"conversation-ai" + (ai ? " is-active" : "")}
          onClick={() => {
            setAi(true);
            setError("");
            setText("");
          }}
        >
          <BookOpenCheck size={19} aria-hidden />
          {tr("assistant")}
        </button>
        <label className="conversation-search">
          <Search size={17} aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr("search")}
            aria-label={tr("search")}
          />
        </label>
        <div className="conversation-people">
          {people.isPending ? (
            <p>{t("p4.loading")}</p>
          ) : people.isError ? (
            <ServiceErrorNotice
              error={people.error}
              retry={() => void people.refetch()}
            />
          ) : !people.data?.length ? (
            <p>{tr("noPeople")}</p>
          ) : (
            people.data
              .filter((p) =>
                p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
              )
              .map((person) => (
                <button
                  key={person.id}
                  aria-current={
                    !ai && selected === person.id ? "true" : undefined
                  }
                  onClick={() => choose(person.id)}
                >
                  {person.avatarUrl || person.role === "admin" ? (
                    <img
                      src={person.avatarUrl || "/logo-icon.png"}
                      width={42}
                      height={42}
                      alt=""
                    />
                  ) : (
                    <span className="conversation-avatar">
                      <AccountAvatar
                        user={{
                          name: person.name,
                          avatarUrl: person.avatarUrl || null,
                        }}
                      />
                    </span>
                  )}
                  <span>
                    <strong>{person.name}</strong>
                    <small>{tr("activeChat")}</small>
                  </span>
                  {person.unread > 0 && (
                    <b className="conversation-unread">{person.unread}</b>
                  )}
                </button>
              ))
          )}
        </div>
      </aside>
      <div className="conversation-main">
        {!selected && !ai ? (
          <div className="conversation-empty">
            <MessageCircle size={44} aria-hidden />
            <h3>{tr("chooseChat")}</h3>
            <p>{tr("conversationIntro")}</p>
          </div>
        ) : (
          <>
            <header className="conversation-heading">
              <button
                className="conversation-back"
                onClick={() => {
                  if (onBack) {
                    onBack();
                    return;
                  }
                  setSelected(null);
                  setAi(false);
                }}
                aria-label={tr("back")}
              >
                <ArrowLeft size={20} />
              </button>
              {ai ? (
                <BookOpenCheck size={24} aria-hidden />
              ) : other?.avatarUrl || other?.role === "admin" ? (
                <img
                  src={other?.avatarUrl || "/logo-icon.png"}
                  width={42}
                  height={42}
                  alt=""
                />
              ) : (
                <span className="conversation-avatar">
                  <AccountAvatar
                    user={
                      other
                        ? {
                            name: other.name,
                            avatarUrl: other.avatarUrl || null,
                          }
                        : null
                    }
                  />
                </span>
              )}
              <div>
                <h3>{ai ? tr("assistant") : other?.name}</h3>
                <small>{ai ? tr("aiIntro") : tr("live")}</small>
              </div>
              {ai && (
                <button
                  onClick={() => setAnswers([])}
                  disabled={busy}
                  aria-label={tr("clearChat")}
                >
                  <Trash2 size={18} />
                </button>
              )}
            </header>
            <div
              className="conversation-log"
              role="log"
              aria-live="polite"
              aria-relevant="additions"
            >
              <div>
                {ai ? (
                  <>
                    <p className="conversation-privacy">{tr("aiPrivacy")}</p>
                    {config.isPending ? (
                      <p>{t("p4.loading")}</p>
                    ) : config.isError ? (
                      <ServiceErrorNotice
                        error={config.error}
                        retry={() => void config.refetch()}
                      />
                    ) : (
                      !config.data?.configured && (
                        <div>
                          <p>{tr("notConfigured")}</p>
                          {user?.role === "admin" && (
                            <p>{t("finalPolish.aiSetup")}</p>
                          )}
                        </div>
                      )
                    )}
                    {answers.map((answer, i) => (
                      <article
                        className={
                          "chat-bubble " +
                          (answer.role === "user" ? "chat-own" : "chat-other")
                        }
                        key={i}
                      >
                        <p>{answer.text}</p>
                      </article>
                    ))}
                  </>
                ) : (
                  <>
                    {chat.isPending && <p>{t("p4.loading")}</p>}
                    {chat.isError && (
                      <ServiceErrorNotice
                        error={chat.error}
                        retry={() => void chat.refetch()}
                      />
                    )}
                    {chat.data?.hasMore && hasOlder && (
                      <button
                        className="conversation-older"
                        disabled={busy}
                        onClick={loadOlder}
                      >
                        {tr("older")}
                      </button>
                    )}
                    {messages.map((message) => (
                      <article
                        className={
                          "chat-bubble " +
                          (message.sender_id === user?.id
                            ? "chat-own"
                            : "chat-other")
                        }
                        key={message.id}
                        data-search-target={"message:" + message.id}
                      >
                        <p>{message.body}</p>
                        <time dateTime={message.created_at}>
                          {new Date(message.created_at).toLocaleString(
                            i18n.language,
                            { dateStyle: "short", timeStyle: "short" },
                          )}
                        </time>
                      </article>
                    ))}
                  </>
                )}
                <div ref={bottom} />
              </div>
            </div>
            {error && <ServiceErrorNotice error={new Error(error)} ai={ai} />}
            <form className="conversation-compose" onSubmit={submit}>
              <textarea
                aria-label={tr("message")}
                placeholder={tr("message")}
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={2}
                maxLength={ai ? 2000 : 5000}
                disabled={busy}
                required
              />
              <button
                className="p4-button"
                disabled={
                  busy || !text.trim() || (ai && !config.data?.configured)
                }
                aria-label={tr("send")}
              >
                <Send size={19} />
                <span>{busy ? t("p4.sending") : tr("send")}</span>
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
