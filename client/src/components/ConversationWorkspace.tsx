import { useIsMobile } from "@/hooks/use-mobile";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { AccountAvatar } from "./AccountAvatar";
import { ServiceErrorNotice } from "./ServiceErrorNotice";
import { conversationApi, conversationPeople } from "@/lib/dashboard-api";
import { useEffect, useRef, useState, type FormEvent, type MutableRefObject } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Send,
  ArrowLeft,
  BookOpenCheck,
  MessageCircle,
  Search,
  Trash2, MoreHorizontal, Maximize2, Download, X,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
type Person = {
  id: number;
  name: string;
  role?: string;
  avatarUrl?: string;
  unread: number;
  lastMessage?:string;
  lastMessageAt?:string;
};
type Message = {
  id: number;
  sender_id: number;
  subject: string;
  body: string;
  created_at: string;
  read_at?: string | null;
};

export function ConversationWorkspace({
  initialAI = false,
  focusId,
  initialRecipientId,
  onBack,
  drafts, onClose, onExpand, expanded = false,
}: { initialAI?: boolean; focusId?: number; initialRecipientId?: number; onBack?: () => void; drafts?: MutableRefObject<Record<string, {text: string; requestKey: string}>>; onClose?: () => void; onExpand?: () => void; expanded?: boolean } = {}) {
  const isMobile = useIsMobile();
  const { user } = useAuth(),
    { t, i18n } = useTranslation(),
    tr = (k: string) => t("dashboardUpdate." + k),
    client = useQueryClient();
  const [selected, setSelected] = useState<number | null>(null),
    [search, setSearch] = useState(""),
    [ai, setAi] = useState(initialAI),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<Error | null>(null),
    [key, setKey] = useState<string>(() => crypto.randomUUID()),
    [older, setOlder] = useState<Message[]>([]),
    [hasOlder, setHasOlder] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false), [messageSearch, setMessageSearch] = useState(""), [exporting, setExporting] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const bottom = useRef<HTMLDivElement>(null),
    autoSelected = useRef(false);
  const openedRecipient = useRef<number>();
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
  const draftId = ai ? 'assistant' : selected ? String(selected) : '';
  useEffect(() => {
    const draft = drafts?.current[draftId];
    setText(draft?.text || '');
    setKey(draft?.requestKey || crypto.randomUUID());
    setOlder([]);
    setHasOlder(true);
    setError(null);
  }, [draftId, drafts]);
  const messages = Array.from(
    new Map(
      [...older, ...(chat.data?.messages || [])].map((m) => [m.id, m]),
    ).values(),
  ).sort((a, b) => a.id - b.id);
  const other = people.data?.find((p) => p.id === selected);
  useEffect(() => {
    if (!initialAI && initialRecipientId && openedRecipient.current !== initialRecipientId && people.data?.some(p => p.id === initialRecipientId)) {
      openedRecipient.current = initialRecipientId;
      setSelected(initialRecipientId);
    }
  }, [initialAI, initialRecipientId, people.data]);
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
    if (ai || !selected || !other?.unread || document.hidden || !chat.isSuccess || chat.isFetching || !chat.data.messages.length) return;
    void conversationApi("/conversations/" + selected + "/read", "POST", { throughId: chat.data.messages.at(-1)!.id })
      .then(() =>
        client.invalidateQueries({ queryKey: ["conversations", user?.id] }),
      )
      .catch(() => {});
  }, [selected, other?.unread, chat.data, chat.isSuccess, chat.isFetching, ai, client]);
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
    setError(null);
    if (id !== selected || ai) { setText(""); setKey(crypto.randomUUID()); }
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !text.trim()) return;
    setBusy(true);
    setError(null);
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
        if (typeof result?.text !== "string" || !result.text.trim()) throw Error("api_response_invalid");
        setAnswers([...input, { role: "model", text: result.text }]);
      } else {
        const result = await conversationApi("/conversations/" + selected, "POST", {
          body: text.trim(),
          requestKey: key,
        });
        if (!Number.isInteger(result?.id) || result.id <= 0) throw Error("api_response_invalid");
        // Render the server-confirmed row immediately; a failed refresh must not turn a saved message into a send error.
        if (result.body === text.trim() && result.sender_id === user?.id && result.recipient_id === selected) {
          client.setQueryData<{messages: Message[];hasMore:boolean}>(["conversation", user?.id, selected], previous => previous ? { ...previous, messages: [...previous.messages.filter(m => m.id !== result.id), result].sort((a,b) => a.id-b.id) } : previous);
        }
        void Promise.all([
          client.invalidateQueries({
            queryKey: ["conversation", user?.id, selected],
          }),
          client.invalidateQueries({ queryKey: ["conversations", user?.id] }),
        ]).catch(() => {});
        setKey(crypto.randomUUID());
      }
      if (drafts) delete drafts.current[draftId];
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e : new Error("failed"));
    } finally {
      setBusy(false);
    }
  }
  async function downloadTranscript() {
    if (!selected || exporting) return;
    setExporting(true); setError(null);
    try {
      const stored = new Map<number, Message>();
      let before: number | undefined;
      for (let page = 0; ; page++) {
        if (page >= 100) throw Error("service_unavailable");
        const result = await conversationApi("/conversations/" + selected + (before ? "?before=" + before : ""));
        if (!Array.isArray(result.messages) || typeof result.hasMore !== "boolean") throw Error("api_response_invalid");
        for (const m of result.messages) stored.set(m.id, m);
        if (!result.hasMore) break;
        const next = result.messages[0]?.id;
        if (!next || (before && next >= before)) throw Error("api_response_invalid");
        before = next;
      }
      const lines = Array.from(stored.values()).sort((a,b) => a.id-b.id).map(m => `[${new Date(m.created_at).toISOString()}] ${m.sender_id === user?.id ? user.name : other?.name || ""}\n${m.body}\n`);
      const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a"); link.href = url; link.download = `salsabela-conversation-${selected}.txt`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e instanceof Error ? e : new Error("failed")); }
    finally { setExporting(false); }
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
    } catch (e) {
      setError(e instanceof Error ? e : new Error("failed"));
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
          disabled={busy}
          className={"conversation-ai" + (ai ? " is-active" : "")}
          onClick={() => {
            setAi(true);
            setError(null);
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
          {people.isSuccess && !!people.data?.length && !people.data.some(p => p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())) && <p role="status">{t('reviewFix.noMatches')}</p>}
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
                  disabled={busy}
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
                    <small>{person.lastMessage || tr("activeChat")}</small>
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
                disabled={busy}
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
              {!ai && <Dropdown.Root dir={i18n.dir()} open={toolsOpen} onOpenChange={setToolsOpen}><Dropdown.Trigger asChild><button type="button" className="conversation-more" aria-label={t("communication.chatTools")}><MoreHorizontal size={20} /></button></Dropdown.Trigger><Dropdown.Portal><Dropdown.Content className="conversation-menu" align="end" sideOffset={8} onEscapeKeyDown={event => { event.preventDefault(); event.stopPropagation(); setToolsOpen(false); }}>
                {!isMobile && onExpand && <Dropdown.Item data-testid="conversation-expand" onSelect={onExpand}><Maximize2 size={16}/>{t("communication." + (expanded ? "restoreChat" : "expandChat"))}</Dropdown.Item>}
                <Dropdown.Item data-testid="conversation-search-action" onSelect={() => setSearchOpen(v => !v)}><Search size={16}/>{t("communication.searchMessages")}</Dropdown.Item>
                <Dropdown.Item data-testid="conversation-download" disabled={exporting} onSelect={() => void downloadTranscript()}><Download size={16}/>{t("communication.downloadTranscript")}</Dropdown.Item>
              </Dropdown.Content></Dropdown.Portal></Dropdown.Root>}
              {onClose && <button type="button" className="conversation-close" onClick={onClose} aria-label={t("p4.close")}><X size={19}/></button>}
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
            {searchOpen && !ai && <label className="conversation-message-search"><Search size={17}/><span className="sr-only">{t("communication.searchMessages")}</span><input type="search" name="conversationSearch" value={messageSearch} onChange={e => setMessageSearch(e.target.value)} placeholder={t("communication.searchMessages")} autoFocus/><button type="button" onClick={() => {setSearchOpen(false);setMessageSearch("");}} aria-label={t("p4.close")}><X size={16}/></button></label>}
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
                    {messages.filter(message => !messageSearch || message.body.toLocaleLowerCase().includes(messageSearch.toLocaleLowerCase())).map((message) => (
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
                        {message.sender_id === user?.id && <small className="chat-receipt">{t(message.read_at ? 'reviewFix.read' : 'reviewFix.sent')}</small>}
                      </article>
                    ))}
                  </>
                )}
                <div ref={bottom} />
              </div>
            </div>
            {error && <ServiceErrorNotice error={error} ai={ai} />}
            <form className="conversation-compose" onSubmit={submit}>
              <textarea name="message"
                aria-label={tr("message")}
                placeholder={tr("message")}
                value={text}
                onChange={(e) => {
                  const requestKey = crypto.randomUUID();
                  setText(e.target.value); setKey(requestKey);
                  if (drafts && draftId) drafts.current[draftId] = {text: e.target.value, requestKey};
                }}
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
