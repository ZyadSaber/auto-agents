import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { Send, Bot, User, Settings2, MessageSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function Chat({ token }) {
  const { t } = useTranslation();
  const [models,         setModels]         = useState([]);
  const [selectedModel,  setSelectedModel]  = useState("auto");
  const [messages,       setMessages]       = useState([]);
  const [input,          setInput]          = useState("");
  const [isStreaming,    setIsStreaming]     = useState(false);
  const messagesEndRef    = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    axios.get("/api/models", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setModels(res.data.models || []))
      .catch(console.error);
  }, [token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const userMsg = { role: "user", content: input };
    const contextMessages = [...messages, userMsg];
    setMessages(contextMessages);
    setInput("");
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          model: selectedModel || "auto",
          messages: contextMessages.map((m) => ({ role: m.role, content: m.content })),
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.body) throw new Error("No response body");
      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.message?.content) {
                assistantMessage += parsed.message.content;
                setMessages((prev) => {
                  const arr = [...prev];
                  arr[arr.length - 1] = { ...arr[arr.length - 1], content: assistantMessage };
                  return arr;
                });
              }
            } catch { /* skip partial */ }
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setMessages((prev) => {
          const arr = [...prev];
          if (arr[arr.length - 1].content === "")
            arr[arr.length - 1].content = "⚠️ Connection Error: Could not reach Ollama API.";
          return arr;
        });
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => abortControllerRef.current?.abort();

  return (
    <div className="flex flex-col md:flex-row h-full w-full gap-6 animate-fade-in">

      {/* ── Sidebar ── */}
      <aside className="w-full md:w-72 shrink-0">
        <Card className="h-full flex flex-col p-5">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-700/50">
            <Settings2 size={18} className="text-brand-400" />
            <h3 className="font-semibold">{t("chat_title")}</h3>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Language Model</label>
            <div className="relative">
              <select
                className="w-full bg-slate-950/50 border border-slate-700 text-slate-100 rounded-xl py-2.5 pl-4 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                <option value="auto">✨ Smart Routing (Auto)</option>
                {models.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
              </select>
              <Bot size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
            <p className="text-xs text-slate-500 px-1">Auto selects the best model per language.</p>
          </div>

          <div className="mt-auto pt-6">
            <div className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-4 flex items-start gap-3">
              <MessageSquare size={16} className="text-brand-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-brand-300 font-medium">Session Active</p>
                <p className="text-xs text-brand-400/70 mt-1">Chat history lives in memory only.</p>
              </div>
            </div>
          </div>
        </Card>
      </aside>

      {/* ── Chat area ── */}
      <section className="grow flex flex-col glass rounded-2xl relative overflow-hidden">
        {/* Messages */}
        <div className="grow overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-40 select-none">
              <Bot size={48} className="text-slate-600 mb-4" />
              <p className="text-lg text-slate-400 font-medium">{t("start_conversation")}</p>
            </div>
          ) : messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-[slideUp_0.3s_ease-out]`}>
              <div className={`flex max-w-[85%] md:max-w-[75%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"} items-end`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mx-2
                  ${msg.role === "user"
                    ? "bg-gradient-to-tr from-brand-600 to-indigo-400"
                    : "bg-slate-800 border border-slate-700"}`}>
                  {msg.role === "user"
                    ? <User size={14} className="text-white" />
                    : <Bot size={14} className="text-brand-400" />}
                </div>
                <div className={`px-4 py-3 rounded-2xl shadow-lg ${
                  msg.role === "user"
                    ? "bg-brand-600 text-white rounded-br-sm rtl:rounded-bl-sm rtl:rounded-br-2xl"
                    : "bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 text-slate-200 rounded-bl-sm rtl:rounded-br-sm rtl:rounded-bl-2xl"
                }`}>
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} className="h-4" />
        </div>

        {/* Input */}
        <div className="p-4 md:p-5 bg-slate-900/40 backdrop-blur-md border-t border-slate-800 shrink-0">
          <div className="relative flex items-center max-w-4xl mx-auto">
            <input
              type="text"
              className="w-full bg-slate-950/60 backdrop-blur-md border border-slate-700/60 rounded-full py-4 pl-6 pr-14 rtl:pr-6 rtl:pl-14 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/80 transition-all"
              placeholder={t("ask_placeholder")}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isStreaming && handleSend()}
              disabled={isStreaming}
            />
            {isStreaming ? (
              <Button size="icon" variant="destructive"
                className="absolute right-2 rtl:right-auto rtl:left-2 rounded-full w-10 h-10"
                onClick={handleStop}>
                <Square size={16} fill="currentColor" />
              </Button>
            ) : (
              <Button size="icon"
                className="absolute right-2 rtl:right-auto rtl:left-2 rounded-full w-10 h-10"
                onClick={handleSend} disabled={!input.trim()}>
                <Send size={16} className="rtl:rotate-180" />
              </Button>
            )}
          </div>
          <p className="text-center mt-2 text-[10px] text-slate-500">
            AI can make mistakes. Verify important information.
          </p>
        </div>
      </section>
    </div>
  );
}

export default Chat;
