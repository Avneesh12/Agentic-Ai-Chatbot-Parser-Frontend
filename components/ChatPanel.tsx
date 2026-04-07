"use client";

import {
  useState, useRef, useEffect, useCallback
} from "react";
import {
  Send, Bot, User, Zap, Database, Wrench,
  Loader2, Clock, MessageSquare, X, Hash,
  ChevronRight, CornerDownLeft, Sparkles
} from "lucide-react";
import { getChatHistory, ChatWebSocket, ENABLE_RAG_UPLOAD } from "@/lib/api";
import type { ChatMessage } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface LocalMsg {
  id: string;
  type: "query" | "ai";
  message: string;
  source?: string;
  created_at: string;
  isStreaming?: boolean;
}

interface Props {
  userId: string;
  onShowUpload: () => void;
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

function sourceBadge(source?: string) {
  if (!source) return null;
  const s = source.toUpperCase();
  if (s === "RAG")          return { cls: "badge-rag",  icon: <Database size={9} />, label: "RAG" };
  if (s.startsWith("TOOL")) return { cls: "badge-tool", icon: <Wrench   size={9} />, label: source.replace("TOOL:", "") };
  return                           { cls: "badge-llm",  icon: <Zap      size={9} />, label: "LLM" };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-end gap-2 sm:gap-3 fade-up">
      <div className="flex items-center justify-center rounded-full flex-shrink-0"
        style={{ width: 30, height: 30, background: "var(--teal-dim)", border: "1px solid rgba(0,212,170,0.25)" }}>
        <Bot size={13} style={{ color: "var(--teal)" }} />
      </div>
      <div className="px-3 sm:px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1.5"
        style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
        <span className="dot" /><span className="dot" /><span className="dot" />
      </div>
    </div>
  );
}

function StreamText({ text, streaming }: { text: string; streaming?: boolean }) {
  const prevLen = useRef(0);
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const prev = prevLen.current;
    prevLen.current = text.length;
    setAnimated(prev);
  }, [text]);

  if (!streaming) return <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{text}</span>;

  return (
    <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {text.split("").map((ch, i) =>
        i >= animated
          ? <span key={i} className="streaming-char" style={{ animationDelay: `${(i - animated) * 0.025}s` }}>{ch}</span>
          : <span key={i}>{ch}</span>
      )}
      <span className="cursor-blink" />
    </span>
  );
}

function Bubble({ msg }: { msg: LocalMsg }) {
  const isUser = msg.type === "query";
  const badge  = sourceBadge(msg.source);

  return (
    <div className={`flex items-end gap-2 fade-up ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div className="flex items-center justify-center rounded-full flex-shrink-0"
        style={{
          width: 28, height: 28,
          background: isUser ? "var(--surface3)" : "var(--teal-dim)",
          border: `1px solid ${isUser ? "var(--border2)" : "rgba(0,212,170,0.25)"}`,
        }}>
        {isUser
          ? <User size={11} style={{ color: "var(--ink2)" }} />
          : <Bot  size={11} style={{ color: "var(--teal)" }} />
        }
      </div>

      {/* Bubble + meta */}
      <div className={`flex flex-col gap-1 bubble-max ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`px-3 sm:px-4 py-2.5 sm:py-3 text-sm leading-relaxed rounded-2xl ${isUser ? "rounded-br-sm" : "rounded-bl-sm"}`}
          style={isUser
            ? { background: "var(--surface3)", border: "1px solid var(--border2)", color: "var(--ink)" }
            : { background: "var(--surface2)", border: "1px solid var(--border)",  color: "var(--ink)" }
          }
        >
          {isUser
            ? msg.message
            : <StreamText text={msg.message} streaming={msg.isStreaming} />
          }
        </div>
        <div className={`flex items-center gap-2 px-1 ${isUser ? "flex-row-reverse" : ""}`}>
          <span style={{ fontSize: 10, color: "var(--ink3)" }}>{fmtTime(msg.created_at)}</span>
          {badge && !msg.isStreaming && (
            <span className={`text-xs px-1.5 sm:px-2 py-0.5 rounded-full flex items-center gap-1 ${badge.cls}`}>
              {badge.icon}{badge.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  "What can you help me with?",
  "Search Wikipedia for quantum computing",
  "What's the Bitcoin price in INR?",
  "Convert 100 USD to EUR",
];

function EmptyState({ onSuggest }: { onSuggest: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-3 sm:px-4 text-center">
      <div className="flex items-center justify-center rounded-2xl"
        style={{
          width: 52, height: 52,
          background: "linear-gradient(135deg, rgba(0,212,170,0.15), rgba(59,130,246,0.15))",
          border: "1px solid rgba(0,212,170,0.2)",
          boxShadow: "0 0 32px rgba(0,212,170,0.08)",
        }}>
        <Sparkles size={22} style={{ color: "var(--teal)" }} />
      </div>
      <div>
        <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--ink)", marginBottom: 5 }}>
          Ask me anything
        </p>
        <p style={{ fontSize: 12, color: "var(--ink3)", lineHeight: 1.6 }}>
          I search your documents, use real-time tools,<br />and answer from my own knowledge.
        </p>
      </div>
      {/* Suggestion chips — full width on mobile */}
      <div className="w-full flex flex-col gap-2">
        {SUGGESTIONS.map(q => (
          <button key={q} onClick={() => onSuggest(q)}
            className="flex items-center gap-2 px-3 py-3 rounded-xl text-left text-xs transition-all hover:scale-[1.01] w-full"
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--ink2)", minHeight: "var(--touch-min)" }}>
            <ChevronRight size={11} style={{ color: "var(--teal)", flexShrink: 0 }} />
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function HistoryItem({ msg, idx }: { msg: ChatMessage; idx: number }) {
  const badge = sourceBadge(msg.ai_source);
  return (
    <div className="px-3 py-3 rounded-xl fade-up" style={{
      background: "var(--surface2)", border: "1px solid var(--border)",
      animationDelay: `${idx * 0.04}s`,
    }}>
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex items-center justify-center rounded-full"
          style={{ width: 18, height: 18, background: msg.type === "query" ? "var(--surface3)" : "var(--teal-dim)" }}>
          {msg.type === "query"
            ? <User size={9} style={{ color: "var(--ink3)" }} />
            : <Bot  size={9} style={{ color: "var(--teal)" }} />
          }
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: msg.type === "query" ? "var(--ink2)" : "var(--teal)", fontFamily: "var(--font-display)" }}>
          {msg.type === "query" ? "You" : "AI"}
        </span>
        <span style={{ fontSize: 10, color: "var(--ink3)", marginLeft: "auto" }}>{fmtTime(msg.created_at)}</span>
        {badge && (
          <span className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-1 ${badge.cls}`}>
            {badge.icon}{badge.label}
          </span>
        )}
      </div>
      <p style={{ fontSize: 12, color: "var(--ink)", lineHeight: 1.6, wordBreak: "break-word" }}>{msg.message}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ChatPanel({ userId, onShowUpload, onClose }: Props) {
  const [tab,         setTab]         = useState<"chat" | "history">("chat");
  const [messages,    setMessages]    = useState<LocalMsg[]>([]);
  const [input,       setInput]       = useState("");
  const [isTyping,    setIsTyping]    = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [history,     setHistory]     = useState<ChatMessage[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [wsError,     setWsError]     = useState(false);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLTextAreaElement>(null);
  const wsRef       = useRef<ChatWebSocket | null>(null);
  const streamIdRef = useRef<string | null>(null);

  const scrollBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  useEffect(() => { scrollBottom(); }, [messages, isTyping, scrollBottom]);

  useEffect(() => {
    let cancelled = false;

    const ws = new ChatWebSocket();
    wsRef.current = ws;
    setWsError(false);

    ws.connect({
      onStatusUpdate: () => { if (cancelled) return; setIsTyping(true); },
      onChunk: (_, full) => {
        if (cancelled) return;
        setIsTyping(false); setIsStreaming(true);
        if (!streamIdRef.current) {
          const id = `s-${Date.now()}`;
          streamIdRef.current = id;
          setMessages(prev => [...prev, { id, type: "ai", message: full, created_at: new Date().toISOString(), isStreaming: true }]);
        } else {
          setMessages(prev => prev.map(m => m.id === streamIdRef.current ? { ...m, message: full } : m));
        }
      },
      onDone: (full, source) => {
        if (cancelled) return;
        setIsStreaming(false);
        setMessages(prev => prev.map(m => m.id === streamIdRef.current ? { ...m, message: full, source, isStreaming: false } : m));
        streamIdRef.current = null;
      },
      onError: () => {
        if (cancelled) return;
        setIsTyping(false); setIsStreaming(false); setWsError(true);
        streamIdRef.current = null;
        setMessages(prev => [...prev, { id: `err-${Date.now()}`, type: "ai", message: "Connection error. Make sure your backend is running.", created_at: new Date().toISOString() }]);
      },
      onClose: () => { if (cancelled) return; setIsTyping(false); setIsStreaming(false); },
    }).catch(() => { if (!cancelled) setWsError(true); });

    return () => { cancelled = true; ws.disconnect(); wsRef.current = null; };
  }, []);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try { setHistory((await getChatHistory()).chats); }
    catch { /* silent */ }
    finally { setHistLoading(false); }
  }, []);

  const switchTab = (t: "chat" | "history") => {
    setTab(t);
    if (t === "history") loadHistory();
  };

  const send = () => {
    const text = input.trim();
    if (!text || isTyping || isStreaming) return;
    if (!wsRef.current?.isConnected) {
      setMessages(prev => [...prev, { id: `err-${Date.now()}`, type: "ai", message: "WebSocket not connected. Reopen the chat.", created_at: new Date().toISOString() }]);
      return;
    }
    setInput("");
    setMessages(prev => [...prev, { id: `${Date.now()}`, type: "query", message: text, created_at: new Date().toISOString() }]);
    wsRef.current.sendMessage(text);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const busy = isTyping || isStreaming;

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--surface)" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ width: 34, height: 34, background: "var(--teal-dim)", border: "1px solid rgba(0,212,170,0.25)" }}>
            <Bot size={15} style={{ color: "var(--teal)" }} />
          </div>
          <div className="min-w-0">
            <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>
              Nexus AI
            </p>
            <div className="flex items-center gap-1.5">
              <div className="rounded-full flex-shrink-0" style={{
                width: 6, height: 6,
                background: wsError ? "var(--red)" : "var(--teal)",
                boxShadow: wsError ? "0 0 5px var(--red)" : "0 0 5px var(--teal)",
              }} />
              <span style={{ fontSize: 10, color: "var(--ink3)" }}>
                {isStreaming ? "Typing…" : isTyping ? "Processing…" : wsError ? "Disconnected" : "Online"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {ENABLE_RAG_UPLOAD && (
            <button onClick={onShowUpload}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: "var(--teal-dim)", border: "1px solid rgba(0,212,170,0.25)",
                color: "var(--teal)", fontFamily: "var(--font-display)",
                minHeight: "var(--touch-min)",
              }}>
              <Database size={11} />
              <span className="hidden xs:inline">Upload</span>
            </button>
          )}
          {/* Close — 44x44 touch target */}
          <button onClick={onClose}
            className="flex items-center justify-center rounded-lg transition-colors"
            style={{ width: 44, height: 44, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--ink3)" }}>
            <X size={15} />
          </button>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 px-4 sm:px-5 pt-3 flex-shrink-0">
        {(["chat", "history"] as const).map(t => (
          <button key={t} onClick={() => switchTab(t)}
            className="flex items-center gap-1.5 px-3 rounded-lg text-xs font-medium capitalize transition-all"
            style={{
              fontFamily: "var(--font-display)",
              background: tab === t ? "var(--teal)" : "var(--surface2)",
              color:      tab === t ? "#000"        : "var(--ink3)",
              border:     tab === t ? "none"        : "1px solid var(--border)",
              minHeight: "var(--touch-min)",
              padding: "0 12px",
            }}>
            {t === "chat" ? <MessageSquare size={11} /> : <Clock size={11} />}
            {t}
          </button>
        ))}
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      {tab === "chat" ? (
        <>
          <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 flex flex-col gap-3 min-h-0">
            {messages.length === 0
              ? <EmptyState onSuggest={q => { setInput(q); inputRef.current?.focus(); }} />
              : <>
                  {messages.map(m => <Bubble key={m.id} msg={m} />)}
                  {isTyping && !isStreaming && <TypingDots />}
                  <div ref={bottomRef} />
                </>
            }
          </div>

          {/* Input area — safe-bottom padding for iOS home indicator */}
          <div className="px-3 sm:px-4 pt-3 pb-3 safe-bottom flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex items-end gap-2 p-2 rounded-xl"
              style={{ background: "var(--surface2)", border: "1px solid var(--border2)" }}>
              <textarea
                ref={inputRef} value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="Ask anything…"
                rows={1}
                className="flex-1 resize-none bg-transparent outline-none px-2 py-2"
                style={{
                  color: "var(--ink)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "16px", // prevents iOS zoom
                  lineHeight: 1.5,
                  maxHeight: 120,
                  minHeight: "unset", // override global min-height for textarea
                }}
              />
              {/* Send button — 40x40 min */}
              <button onClick={send} disabled={!input.trim() || busy}
                className="flex items-center justify-center rounded-lg flex-shrink-0 transition-all hover:scale-105 disabled:opacity-40 disabled:scale-100"
                style={{
                  width: 40, height: 40, border: "none",
                  background: input.trim() && !busy ? "var(--teal)" : "var(--surface3)",
                  cursor: input.trim() && !busy ? "pointer" : "not-allowed",
                  minHeight: "unset",
                }}>
                {busy
                  ? <Loader2 size={14} style={{ color: "#000", animation: "spin 1s linear infinite" }} />
                  : <Send    size={14} style={{ color: input.trim() ? "#000" : "var(--ink3)" }} />
                }
              </button>
            </div>
            {/* Hint — hidden on very small screens to save space */}
            <div className="hidden xs:flex items-center justify-center gap-1.5 mt-2" style={{ color: "var(--ink3)", fontSize: 10 }}>
              <CornerDownLeft size={9} /> Enter to send · Shift+Enter for newline
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 flex flex-col gap-2 min-h-0">
          {histLoading ? (
            <div className="flex items-center justify-center h-full gap-2" style={{ color: "var(--ink3)" }}>
              <Loader2 size={16} style={{ animation: "spin 1s linear infinite", color: "var(--teal)" }} />
              <span style={{ fontSize: 13 }}>Loading history…</span>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <Hash size={24} style={{ color: "var(--ink3)" }} />
              <p style={{ fontSize: 13, color: "var(--ink3)" }}>No history yet</p>
            </div>
          ) : (
            history.map((m, i) => <HistoryItem key={i} msg={m} idx={i} />)
          )}
        </div>
      )}
    </div>
  );
}
