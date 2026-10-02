import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, Sparkles } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { motion, AnimatePresence } from "framer-motion";

type Message = { from: "bot" | "user"; text: string };
type HistoryItem = { role: "user" | "model"; text: string };

const quickQuestions = {
  en: [
    "What courses do you offer?",
    "Is there a free trial?",
    "What are the prices?",
    "How do I enroll?",
  ],
  ar: [
    "ما الكورسات المتاحة؟",
    "هل يوجد حصة مجانية؟",
    "ما هي الأسعار؟",
    "كيف أسجل؟",
  ],
};

const greetings = {
  en: "Hello! 👋 I'm Salsabela Academy's AI assistant, Ask me anything about our courses, pricing, or enrollment!",
  ar: "السلام عليكم! 👋 أنا المساعد الذكي لأكاديمية سلسبيلا، اسألني عن أي شيء يخص كورساتنا أو الأسعار أو التسجيل!",
};

export function AIChatbot() {
  const { isRTL } = useLanguage();
  const lang = isRTL ? "ar" : "en";
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ from: "bot", text: greetings[lang] }]);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;
    const userMsg: Message = { from: "user", text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history,
          language: lang,
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Failed");

      const botReply = data.reply as string;
      setMessages(prev => [...prev, { from: "bot", text: botReply }]);
      setHistory(prev => [
        ...prev,
        { role: "user", text },
        { role: "model", text: botReply },
      ]);
    } catch {
      const fallback = isRTL
        ? "عذراً، حدث خطأ. يرجى التواصل معنا مباشرة عبر واتساب."
        : "Sorry, something went wrong. Please contact us directly via WhatsApp.";
      setMessages(prev => [...prev, { from: "bot", text: fallback }]);
    } finally {
      setIsTyping(false);
    }
  };

  const side = isRTL ? "right-6" : "left-6";

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ duration: 0.2 }}
            className={`fixed bottom-24 ${side} z-50 w-[360px] max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden`}
            dir={isRTL ? "rtl" : "ltr"}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-primary to-emerald-600 px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-white font-bold text-sm">
                    {isRTL ? "المساعد الذكي" : "AI Assistant"}
                  </p>
                  <Sparkles className="w-3 h-3 text-yellow-300" />
                </div>

              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-white/70 hover:text-white transition-colors flex-shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-80 min-h-40">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-2 ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                  {m.from === "bot" && (
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      m.from === "user"
                        ? "bg-primary text-white rounded-br-sm"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-2 justify-start">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1.5 items-center">
                    {[0, 1, 2].map(i => (
                      <span
                        key={i}
                        className="w-2 h-2 bg-primary/60 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Quick questions */}
            {messages.length <= 1 && (
              <div className="px-4 pb-2">
                <p className="text-xs text-slate-400 mb-2 font-medium">
                  {isRTL ? "أسئلة سريعة:" : "Quick questions:"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {quickQuestions[lang].map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      className="text-xs bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 px-3 py-1.5 rounded-full transition-colors font-medium"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input area */}
            <div className="px-3 py-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex gap-2 items-end">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
                  placeholder={isRTL ? "اكتب سؤالك..." : "Type your question..."}
                  disabled={isTyping}
                  className="flex-1 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 outline-none focus:border-primary dark:text-slate-200 placeholder:text-slate-400 disabled:opacity-50 transition-colors"
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={isTyping || !input.trim()}
                  className="bg-primary text-white p-2.5 rounded-xl hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                  aria-label="Send"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle button */}
      <motion.button
        onClick={() => setOpen(v => !v)}
        aria-label="Open AI Assistant"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className={`fixed bottom-6 ${side} z-50 w-14 h-14 bg-gradient-to-br from-primary to-emerald-600 text-white rounded-full shadow-2xl shadow-primary/40 flex items-center justify-center`}
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X className="w-6 h-6" />
            </motion.span>
          ) : (
            <motion.span key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <MessageCircle className="w-6 h-6" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </>
  );
}
