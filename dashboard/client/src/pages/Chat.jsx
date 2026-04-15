import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import axios from "axios";
import {
  Send, Bot, User, Square, Plus, Trash2,
  MessageSquare, Loader2, CheckCircle2, XCircle,
  Cpu, Sparkles,
} from "lucide-react";
import { Button }   from "@/components/ui/button";
import { Card }     from "@/components/ui/card";
import { Badge }    from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectGroup, SelectItem,
  SelectLabel, SelectSeparator, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ─── persistence ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "cs_chat_history";

const makeChat = () => ({
  id:       Date.now(),
  title:    null, // resolved to t("chat_new") at render time
  messages: [],
  created:  new Date().toISOString(),
});

function loadChats() {
  try {
    const raw    = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch { /* ignore */ }
  return [makeChat()];
}

const saveChats = (chats) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(chats)); } catch { /* ignore */ }
};

const deriveTitle = (text) => {
  const clean = text.trim().replace(/\n+/g, " ");
  return clean.length > 36 ? clean.slice(0, 36) + "…" : clean;
};

// ─── markdown ────────────────────────────────────────────────────────────────

const MdMessage = ({ content }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      p:    ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
      code: ({ inline, className, children }) =>
        inline
          ? <code className="bg-slate-950 text-brand-300 rounded px-1.5 py-0.5 text-[0.82em] font-mono border border-slate-700">{children}</code>
          : <pre className="bg-slate-950 border border-slate-700/70 rounded-xl p-4 my-3 overflow-x-auto">
              <code className={cn("text-sm font-mono text-slate-200", className)}>{children}</code>
            </pre>,
      ul:         ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1 text-slate-300">{children}</ul>,
      ol:         ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1 text-slate-300">{children}</ol>,
      li:         ({ children }) => <li className="leading-relaxed">{children}</li>,
      strong:     ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
      em:         ({ children }) => <em className="italic text-slate-300">{children}</em>,
      blockquote: ({ children }) => (
        <blockquote className="border-l-2 border-brand-500 pl-4 my-2 text-slate-400 italic">{children}</blockquote>
      ),
      h1: ({ children }) => <h1 className="text-xl font-bold mt-3 mb-2 text-white">{children}</h1>,
      h2: ({ children }) => <h2 className="text-lg font-bold mt-3 mb-2 text-white">{children}</h2>,
      h3: ({ children }) => <h3 className="text-base font-semibold mt-2 mb-1 text-white">{children}</h3>,
      a:  ({ href, children }) => (
        <a href={href} target="_blank" rel="noopener noreferrer"
           className="text-brand-400 underline underline-offset-2 hover:text-brand-300 transition-colors">{children}</a>
      ),
      table: ({ children }) => (
        <div className="overflow-x-auto my-3 rounded-xl border border-slate-700">
          <table className="min-w-full text-sm">{children}</table>
        </div>
      ),
      thead: ({ children }) => <thead className="bg-slate-800/80">{children}</thead>,
      th:    ({ children }) => <th className="px-4 py-2.5 text-left font-semibold text-slate-200 border-b border-slate-700">{children}</th>,
      td:    ({ children }) => <td className="px-4 py-2.5 border-b border-slate-800/60 text-slate-300">{children}</td>,
      hr:    () => <hr className="border-slate-700 my-4" />,
    }}
  >
    {content}
  </ReactMarkdown>
);

// ─── typing dots ──────────────────────────────────────────────────────────────

const TypingDots = () => (
  <span className="inline-flex items-center gap-1 py-0.5">
    {[0, 1, 2].map(i => (
      <span key={i} className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce"
            style={{ animationDelay: `${i * 0.18}s` }} />
    ))}
  </span>
);

// ─── empty state ──────────────────────────────────────────────────────────────

const EmptyState = ({ t }) => (
  <div className="flex-1 flex flex-col items-center justify-center gap-6 select-none pointer-events-none px-6">
    <div className="w-20 h-20 rounded-3xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
      <Sparkles size={36} className="text-brand-400 opacity-70" />
    </div>
    <div className="text-center space-y-2">
      <p className="text-lg font-semibold text-slate-300">{t("chat_empty_heading")}</p>
      <p className="text-sm text-slate-500">
        {t("chat_empty_hint")} ·{" "}
        <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-xs font-mono">Enter</kbd>
        {" "}{t("chat_enter_to_send")} ·{" "}
        <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-xs font-mono">Shift+Enter</kbd>
        {" "}{t("chat_shift_enter")}
      </p>
    </div>
  </div>
);

// ─── main ─────────────────────────────────────────────────────────────────────

export default function Chat({ token, arabicModel = "qwen2.5:72b", englishModel = "llama3.3:70b" }) {
  const { t } = useTranslation();

  const [chats,         setChats]         = useState(loadChats);
  const [activeChatId,  setActiveChatId]  = useState(() => loadChats()[0].id);
  const [models,        setModels]        = useState([]);
  const [selectedModel, setSelectedModel] = useState("auto");
  const [input,         setInput]         = useState("");
  const [isStreaming,   setIsStreaming]   = useState(false);
  const [status,        setStatus]        = useState("idle"); // idle | thinking | streaming | error

  const bottomRef   = useRef(null);
  const abortRef    = useRef(null);
  const textareaRef = useRef(null);

  const activeChat = chats.find(c => c.id === activeChatId) ?? chats[0];
  const messages   = activeChat?.messages ?? [];

  // Smart Routing requires both routing models present in Ollama
  const modelNames            = models.map(m => m.name);
  const smartRoutingAvailable = modelNames.includes(arabicModel) && modelNames.includes(englishModel);

  // load models — fall back to first available if smart routing models are missing
  useEffect(() => {
    axios.get("/api/models", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        const loaded = r.data.models || [];
        setModels(loaded);
        const names    = loaded.map(m => m.name);
        const canRoute = names.includes(arabicModel) && names.includes(englishModel);
        if (!canRoute && selectedModel === "auto" && loaded.length > 0)
          setSelectedModel(loaded[0].name);
      })
      .catch(() => {});
  }, [token]);

  // scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // persist
  useEffect(() => { saveChats(chats); }, [chats]);

  // reset status when switching chats
  useEffect(() => { setStatus("idle"); }, [activeChatId]);

  // auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  }, [input]);

  // ── chat mutations ──
  const patchChat = useCallback((id, fn) => {
    setChats(prev => prev.map(c => c.id === id ? fn(c) : c));
  }, []);

  const newChat = () => {
    const c = makeChat();
    setChats(prev => [c, ...prev]);
    setActiveChatId(c.id);
    setInput("");
  };

  const deleteChat = (id, e) => {
    e.stopPropagation();
    setChats(prev => {
      const next = prev.filter(c => c.id !== id);
      if (!next.length) {
        const fresh = makeChat();
        setActiveChatId(fresh.id);
        return [fresh];
      }
      if (id === activeChatId) setActiveChatId(next[0].id);
      return next;
    });
  };

  // ── send ──
  const send = async () => {
    if (!input.trim() || isStreaming) return;

    const snap    = activeChatId;
    const userMsg = { role: "user", content: input.trim() };
    const isFirst = messages.length === 0;
    const ctx     = [...messages, userMsg];

    patchChat(snap, c => ({
      ...c,
      title:    isFirst ? deriveTitle(userMsg.content) : c.title,
      messages: [...ctx, { role: "assistant", content: "" }],
    }));
    setInput("");
    setIsStreaming(true);
    setStatus("thinking");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          model:    selectedModel,
          messages: ctx.map(m => ({ role: m.role, content: m.content })),
          stream:   true,
        }),
        signal: controller.signal,
      });

      if (!res.body) throw new Error("No stream");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";
      let buf   = "";
      let first = true;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.message?.content) {
              if (first) { setStatus("streaming"); first = false; }
              reply += parsed.message.content;
              patchChat(snap, c => {
                const arr = [...c.messages];
                arr[arr.length - 1] = { ...arr[arr.length - 1], content: reply };
                return { ...c, messages: arr };
              });
            }
          } catch { /* skip partial */ }
        }
      }
      setStatus("idle");
    } catch (err) {
      if (err.name === "AbortError") {
        // remove the empty assistant placeholder left by the abort
        patchChat(snap, c => {
          const last = c.messages[c.messages.length - 1];
          if (last?.role === "assistant" && last.content === "")
            return { ...c, messages: c.messages.slice(0, -1) };
          return c;
        });
        setStatus("idle");
      } else {
        setStatus("error");
        patchChat(snap, c => {
          const arr = [...c.messages];
          if (arr[arr.length - 1]?.content === "")
            arr[arr.length - 1] = { ...arr[arr.length - 1], content: t("chat_error_unreachable") };
          return { ...c, messages: arr };
        });
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const stop  = () => { abortRef.current?.abort(); setStatus("idle"); };
  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !isStreaming) { e.preventDefault(); send(); }
  };

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full w-full gap-0 overflow-hidden border-t border-slate-700/40 bg-slate-900/40 backdrop-blur-md animate-fade-in">

      {/* ══════════════════ LEFT — history rail ══════════════════ */}
      <aside className="w-56 shrink-0 flex flex-col border-r border-slate-700/40 bg-slate-950/30">
        <div className="p-3 border-b border-slate-700/40">
          <Button onClick={newChat} variant="outline" size="sm"
            className="w-full gap-2 border-slate-700 hover:border-brand-500/50 hover:bg-brand-500/10 hover:text-brand-300 transition-all">
            <Plus size={14} /> {t("chat_new")}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          <p className="px-2 pt-1 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">
            {t("chat_history")}
          </p>
          {chats.map(chat => (
            <button
              key={chat.id}
              onClick={() => setActiveChatId(chat.id)}
              className={cn(
                "group w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-all",
                chat.id === activeChatId
                  ? "bg-brand-500/15 border border-brand-500/25 text-brand-200"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent"
              )}
            >
              <MessageSquare size={13} className="shrink-0 opacity-50" />
              <span className="flex-1 truncate text-xs">{chat.title ?? t("chat_new")}</span>
              <span
                role="button"
                onClick={(e) => deleteChat(chat.id, e)}
                className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all shrink-0"
              >
                <Trash2 size={12} />
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* ══════════════════ CENTER — messages ══════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* top bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/40 bg-slate-950/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand-500/15 border border-brand-500/25 flex items-center justify-center">
              <Bot size={15} className="text-brand-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200 leading-none">
                {activeChat?.title ?? t("chat_new")}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {t("chat_local_ai")} · {selectedModel === "auto" ? t("chat_smart_routing") : selectedModel}
              </p>
            </div>
          </div>

          {/* status badges */}
          <div className="flex items-center gap-2">
            {status === "thinking" && (
              <Badge variant="outline" className="gap-1.5 text-amber-400 border-amber-500/30 bg-amber-500/10 animate-pulse text-[11px]">
                <Loader2 size={10} className="animate-spin" /> {t("chat_status_thinking")}
              </Badge>
            )}
            {status === "streaming" && (
              <Badge variant="outline" className="gap-1.5 text-brand-400 border-brand-500/30 bg-brand-500/10 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse inline-block" /> {t("chat_status_generating")}
              </Badge>
            )}
            {status === "error" && (
              <Badge variant="outline" className="gap-1.5 text-red-400 border-red-500/30 bg-red-500/10 text-[11px]">
                <XCircle size={10} /> {t("chat_status_error")}
              </Badge>
            )}
            {status === "idle" && messages.length > 0 && (
              <Badge variant="outline" className="gap-1.5 text-green-400 border-green-500/30 bg-green-500/10 text-[11px]">
                <CheckCircle2 size={10} /> {t("chat_status_ready")}
              </Badge>
            )}
          </div>
        </div>

        {/* messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {messages.length === 0
            ? <EmptyState t={t} />
            : messages.map((msg, i) => {
                const isUser  = msg.role === "user";
                const isEmpty = msg.content === "";
                const isLast  = i === messages.length - 1;

                return (
                  <div key={i} className={cn("flex gap-3", isUser && "flex-row-reverse")}>
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                      isUser
                        ? "bg-gradient-to-br from-brand-500 to-indigo-500 shadow-lg shadow-brand-500/20"
                        : "bg-slate-800 border border-slate-700"
                    )}>
                      {isUser ? <User size={14} className="text-white" /> : <Bot size={14} className="text-brand-400" />}
                    </div>

                    <div className={cn(
                      "max-w-[78%] rounded-2xl px-4 py-3 text-sm shadow-md",
                      isUser
                        ? "bg-gradient-to-br from-brand-600 to-brand-700 text-white rounded-tr-sm"
                        : "bg-slate-800/70 border border-slate-700/50 text-slate-200 rounded-tl-sm backdrop-blur-sm"
                    )}>
                      {isUser
                        ? <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        : isEmpty && isLast && isStreaming
                          ? <TypingDots />
                          : <MdMessage content={msg.content} />
                      }
                    </div>
                  </div>
                );
              })
          }
          <div ref={bottomRef} />
        </div>

        {/* input bar */}
        <div className="px-4 pb-4 pt-3 border-t border-slate-700/40 bg-slate-950/20 shrink-0">
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              disabled={isStreaming}
              placeholder={`${t("ask_placeholder")}  ·  Shift+Enter ${t("chat_shift_enter")}`}
              className="flex-1 min-h-[44px] max-h-[180px] py-3 px-4 rounded-2xl border-slate-700/60 bg-slate-950/60 text-sm resize-none overflow-hidden leading-relaxed focus:ring-brand-500/50 focus:border-brand-500/60"
            />
            {isStreaming
              ? <Button size="icon" variant="destructive" onClick={stop}
                  className="h-11 w-11 rounded-2xl shrink-0 shadow-lg">
                  <Square size={15} fill="currentColor" />
                </Button>
              : <Button size="icon" onClick={send} disabled={!input.trim()}
                  className="h-11 w-11 rounded-2xl shrink-0 bg-gradient-to-br from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 shadow-lg shadow-brand-500/25 disabled:shadow-none transition-all">
                  <Send size={15} />
                </Button>
            }
          </div>
          <p className="text-center mt-2.5 text-[10px] text-slate-600">
            {t("chat_disclaimer")}
          </p>
        </div>
      </div>

      {/* ══════════════════ RIGHT — config panel ══════════════════ */}
      <aside className="w-52 shrink-0 flex flex-col border-l border-slate-700/40 bg-slate-950/30">
        <div className="p-4 border-b border-slate-700/40">
          <div className="flex items-center gap-2">
            <Cpu size={14} className="text-brand-400" />
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{t("chat_panel_model")}</p>
          </div>
        </div>

        <div className="flex-1 p-4 space-y-5 overflow-y-auto">

          {/* model selector */}
          <div className="space-y-2">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {t("chat_active_model")}
            </label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-full text-xs h-9">
                <SelectValue placeholder={t("chat_model_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>{t("chat_routing_label")}</SelectLabel>
                  <SelectItem value="auto" disabled={!smartRoutingAvailable}>
                    {smartRoutingAvailable ? t("chat_routing_auto") : t("chat_routing_missing")}
                  </SelectItem>
                </SelectGroup>
                {models.length > 0 && (
                  <>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>{t("chat_models_label")}</SelectLabel>
                      {models.map(m => (
                        <SelectItem key={m.name} value={m.name}>{m.name}</SelectItem>
                      ))}
                    </SelectGroup>
                  </>
                )}
              </SelectContent>
            </Select>
            {smartRoutingAvailable
              ? <p className="text-[10px] text-slate-600 leading-relaxed">{t("chat_routing_hint")}</p>
              : <p className="text-[10px] text-amber-600 leading-relaxed">
                  {t("chat_routing_warn", { arabic: arabicModel, english: englishModel })}
                </p>
            }
          </div>

          <div className="border-t border-slate-800" />

          {/* session info */}
          <div className="space-y-2">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {t("chat_session_label")}
            </label>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">{t("chat_session_messages")}</span>
                <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400 px-2 py-0">
                  {messages.length}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">{t("chat_session_storage")}</span>
                <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400 px-2 py-0">
                  {t("chat_session_local")}
                </Badge>
              </div>
            </div>
            <p className="text-[10px] text-slate-600 leading-relaxed">{t("chat_session_hint")}</p>
          </div>

          <div className="border-t border-slate-800" />

          {/* actions */}
          <div className="space-y-2">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {t("chat_actions_label")}
            </label>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs border-slate-700 text-slate-400 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400 transition-all"
              onClick={() => patchChat(activeChatId, c => ({ ...c, messages: [], title: null }))}
            >
              <Trash2 size={12} className="mr-2" /> {t("chat_clear_messages")}
            </Button>
          </div>

        </div>
      </aside>

    </div>
  );
}
