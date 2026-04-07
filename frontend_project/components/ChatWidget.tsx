"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { getChatHistory, ChatMessage, ChatWebSocket } from "@/lib/api";
import {
  Sparkles, X, Send, Bot, User, Zap, Database,
  ChevronRight, Loader2, Clock, MessageSquare
} from "lucide-react";

interface LocalMessage {
  id: string;
  type: "query" | "ai";
  message: string;
  source?: string;
  created_at: string;
  isNew?: boolean;
  isStreaming?: boolean; // 🔹 new: marks a message as actively streaming
}

// 🔹 Add these props to ChatWidget
interface ChatWidgetProps {
  isAuthenticated: boolean;
  userId: string;
  onAuthRequired: () => void;
}



function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 msg-enter">
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: "linear-gradient(135deg, var(--accent), var(--accent2))" }}>
        <Bot size={14} color="white" />
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-bl-sm"
        style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
        <div className="flex gap-1 items-center h-4">
          {[0,1,2].map(i => (
            <div key={i} className="typing-dot w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--accent)", animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StreamingText({ text, isStreaming }: { text: string; isStreaming?: boolean }) {
  const [displayedChars, setDisplayedChars] = useState<string[]>([]);
  const [animatedUpTo, setAnimatedUpTo] = useState(0);
  const prevLengthRef = useRef(0);

  useEffect(() => {
    const chars = text.split("");
    setDisplayedChars(chars);
    const newStart = prevLengthRef.current;
    prevLengthRef.current = chars.length;
    setAnimatedUpTo(newStart);
  }, [text]);

  if (!isStreaming) {
    return <span style={{ whiteSpace: "pre-wrap" }}>{text}</span>;
  }

  return (
    <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {displayedChars.map((char, i) =>
        i >= animatedUpTo ? (
          <span
            key={i}
            className="streaming-char"
            style={{ animationDelay: `${(i - animatedUpTo) * 0.025}s` }}
          >
            {char}
          </span>
        ) : (
          // 🔹 already animated chars — plain span, no class, no re-animation
          <span key={i}>{char}</span>
        )
      )}
      <span className="streaming-cursor" />
    </span>
  );
}


function MessageBubble({ msg }: { msg: LocalMessage }) {
  const isUser = msg.type === "query";

  return (
    <div className={`flex items-end gap-3 msg-enter ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser
          ? "bg-gradient-to-br from-pink-500 to-purple-600"
          : "bg-gradient-to-br from-purple-500 to-cyan-500"
      }`}>
        {isUser ? <User size={14} color="white" /> : <Bot size={14} color="white" />}
      </div>

      <div className={`max-w-[75%] flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isUser ? "rounded-br-sm text-white" : "rounded-bl-sm"
        }`}
          style={isUser
            ? { background: "linear-gradient(135deg, var(--accent), #9c6fff)" }
            : { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }
          }>
          {isUser
            ? msg.message
            : <StreamingText text={msg.message} isStreaming={msg.isStreaming} />
          }
          {/* 🔹 REMOVED old cursor span — StreamingText handles it now */}
        </div>

        <div className="flex items-center gap-2 px-1">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {formatTime(msg.created_at)}
          </span>
          {msg.source && !msg.isStreaming && (
            <span className={`text-xs px-2 py-0.5 rounded-full border ${
              msg.source === "RAG" ? "source-rag" : "source-llm"
            }`}>
              {msg.source === "RAG"
                ? <><Database size={9} className="inline mr-1" />RAG</>
                : <><Zap size={9} className="inline mr-1" />LLM</>
              }
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-6 text-center">
      <div className="relative">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, var(--accent), var(--accent2))", boxShadow: "0 0 40px var(--glow)" }}>
          <Sparkles size={32} color="white" />
        </div>
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: "var(--accent3)" }}>
          <div className="w-2 h-2 rounded-full bg-white" />
        </div>
      </div>
      <div>
        <p className="font-bold text-lg mb-2" style={{ fontFamily: "Syne, sans-serif", color: "var(--text)" }}>
          Ask me anything
        </p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Powered by RAG + LLM. I'll search my knowledge base first, then generate a response.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 w-full">
        {["What can you help me with?", "How does RAG work?", "Tell me something interesting"].map(q => (
          <button key={q} className="text-left px-4 py-2.5 rounded-xl text-xs transition-all hover:scale-[1.02]"
            style={{
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              color: "var(--text-muted)"
            }}
            onClick={() => {
              const ev = new CustomEvent("suggest-prompt", { detail: q });
              window.dispatchEvent(ev);
            }}>
            <ChevronRight size={12} className="inline mr-2" style={{ color: "var(--accent)" }} />
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ChatWidget({ isAuthenticated, userId, onAuthRequired }: ChatWidgetProps)  {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);       // 🔹 true while waiting for first chunk
  const [isStreaming, setIsStreaming] = useState(false);  // 🔹 true while chunks are arriving
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "history">("chat");
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [wsError, setWsError] = useState(false);         // 🔹 show error state

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatWSRef = useRef<ChatWebSocket | null>(null);   // 🔹 persistent WS ref
  const streamingMsgId = useRef<string | null>(null);    // 🔹 track which msg is streaming

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    const handler = (e: Event) => {
      const q = (e as CustomEvent).detail as string;
      setInput(q);
      inputRef.current?.focus();
    };
    window.addEventListener("suggest-prompt", handler);
    return () => window.removeEventListener("suggest-prompt", handler);
  }, []);

  // 🔹 Connect WebSocket when widget opens, disconnect when it closes
  useEffect(() => {
    if (isOpen) {
      const ws = new ChatWebSocket();
      chatWSRef.current = ws;
      setWsError(false);

      ws.connect({
        // 🔹 "processing" status — show typing dots
        onStatusUpdate: () => {
          setIsTyping(true);
        },

        // 🔹 First chunk arrives — create streaming AI message bubble
        onChunk: (chunk, fullAnswer) => {
          setIsTyping(false);    // hide typing dots
          setIsStreaming(true);

          if (!streamingMsgId.current) {
            // create the AI bubble on first chunk
            const id = `stream-${Date.now()}`;
            streamingMsgId.current = id;
            setMessages(prev => [...prev, {
              id,
              type: "ai",
              message: fullAnswer,
              created_at: new Date().toISOString(),
              isNew: true,
              isStreaming: true,
            }]);
          } else {
            // update existing bubble with growing answer
            setMessages(prev => prev.map(m =>
              m.id === streamingMsgId.current
                ? { ...m, message: fullAnswer }
                : m
            ));
          }
        },

        // 🔹 All chunks done — finalize the message with source badge
        onDone: (fullAnswer, source) => {
          setIsStreaming(false);
          setMessages(prev => prev.map(m =>
            m.id === streamingMsgId.current
              ? { ...m, message: fullAnswer, source, isStreaming: false }
              : m
          ));
          streamingMsgId.current = null;
        },

        onError: () => {
          setIsTyping(false);
          setIsStreaming(false);
          setWsError(true);
          streamingMsgId.current = null;
          setMessages(prev => [...prev, {
            id: `err-${Date.now()}`,
            type: "ai",
            message: "⚠️ Connection error. Make sure your FastAPI backend is running.",
            created_at: new Date().toISOString(),
          }]);
        },

        onClose: () => {
          setIsTyping(false);
          setIsStreaming(false);
        },
      }).catch(() => {
        setWsError(true);
      });

      return () => {
        ws.disconnect();
        chatWSRef.current = null;
      };
    }
  }, [isOpen]);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const data = await getChatHistory();
      setHistory(data.chats);
    } catch {
      // silently fail
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const openPanel = () => {
    if (!isAuthenticated) {
      onAuthRequired();   // → triggers AuthModal in page.tsx
      return;
    }
    setIsOpen(true);
    setIsClosing(false);
  };

  const closePanel = () => {
    setIsClosing(true);
    setTimeout(() => { setIsOpen(false); setIsClosing(false); }, 250);
  };

  const handleTabChange = (tab: "chat" | "history") => {
    setActiveTab(tab);
    if (tab === "history") loadHistory();
  };

  // 🔹 handleSend now just fires over WebSocket — no REST call
  const handleSend = () => {
    const text = input.trim();
    if (!text || isTyping || isStreaming) return;

    if (!chatWSRef.current?.isConnected) {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        type: "ai",
        message: "⚠️ WebSocket not connected. Try closing and reopening the chat.",
        created_at: new Date().toISOString(),
      }]);
      return;
    }

    setInput("");

    // Append user message immediately
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      type: "query",
      message: text,
      created_at: new Date().toISOString(),
      isNew: true,
    }]);

    // Send over WebSocket — responses come via callbacks above
    chatWSRef.current.sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isBusy = isTyping || isStreaming;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 transition-opacity duration-300"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          onClick={closePanel}
        />
      )}

      {/* Chat Panel */}
      {(isOpen || isClosing) && (
        <div
          className={`fixed left-0 top-0 h-full z-50 flex flex-col ${isClosing ? "panel-exit" : "panel-enter"}`}
          style={{
            width: "min(420px, 100vw)",
            background: "var(--surface)",
            borderRight: "1px solid var(--border)",
            boxShadow: "20px 0 60px rgba(0,0,0,0.6)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
            style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, var(--accent), var(--accent2))" }}>
                <Sparkles size={16} color="white" />
              </div>
              <div>
                <p className="font-bold text-sm shimmer-text" style={{ fontFamily: "Syne, sans-serif" }}>
                  AI Assistant
                </p>
                <div className="flex items-center gap-1.5">
                  {/* 🔹 dynamic status dot */}
                  <div className={`w-1.5 h-1.5 rounded-full ${wsError ? "bg-red-400" : "bg-green-400"}`}
                    style={{ boxShadow: wsError ? "0 0 6px #f87171" : "0 0 6px #4ade80" }} />
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {isStreaming ? "Typing..." : isTyping ? "Processing..." : wsError ? "Disconnected" : "Online"}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={closePanel}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
              <X size={15} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex px-5 pt-3 gap-1 flex-shrink-0">
            {(["chat", "history"] as const).map(tab => (
              <button key={tab} onClick={() => handleTabChange(tab)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium capitalize transition-all"
                style={activeTab === tab
                  ? { background: "var(--accent)", color: "white" }
                  : { background: "var(--surface2)", color: "var(--text-muted)", border: "1px solid var(--border)" }
                }>
                {tab === "chat" ? <MessageSquare size={12} /> : <Clock size={12} />}
                {tab}
              </button>
            ))}
          </div>

          {/* Body */}
          {activeTab === "chat" ? (
            <>
              <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4 min-h-0">
                {messages.length === 0 ? (
                  <EmptyState />
                ) : (
                  <>
                    {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
                    {/* 🔹 only show typing dots before first chunk arrives */}
                    {isTyping && !isStreaming && <TypingIndicator />}
                    <div ref={bottomRef} />
                  </>
                )}
              </div>

              {/* Input */}
              <div className="px-4 py-4 flex-shrink-0"
                style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
                <div className="flex items-end gap-2 p-2 rounded-2xl"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything..."
                    rows={1}
                    className="flex-1 resize-none bg-transparent text-sm outline-none px-2 py-1.5 max-h-32"
                    style={{
                      color: "var(--text)",
                      fontFamily: "DM Mono, monospace",
                      lineHeight: "1.5",
                    }}
                  />
                  <button onClick={handleSend} disabled={!input.trim() || isBusy}
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:scale-110 disabled:opacity-40 disabled:scale-100"
                    style={{
                      background: input.trim() && !isBusy
                        ? "linear-gradient(135deg, var(--accent), #9c6fff)"
                        : "var(--border)"
                    }}>
                    {isBusy
                      ? <Loader2 size={16} color="white" className="animate-spin" />
                      : <Send size={16} color="white" />
                    }
                  </button>
                </div>
                <p className="text-center text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                  ↵ Enter to send · Shift+Enter for new line
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3 min-h-0">
              {isLoadingHistory ? (
                <div className="flex items-center justify-center h-full gap-3"
                  style={{ color: "var(--text-muted)" }}>
                  <Loader2 size={20} className="animate-spin" style={{ color: "var(--accent)" }} />
                  <span className="text-sm">Loading history...</span>
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <Clock size={32} style={{ color: "var(--text-muted)" }} />
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>No chat history yet</p>
                </div>
              ) : (
                history.map((msg, i) => (
                  <div key={i} className="p-3 rounded-xl msg-enter"
                    style={{
                      background: msg.type === "query" ? "var(--surface2)" : "var(--bg)",
                      border: `1px solid ${msg.type === "query" ? "var(--border)" : "rgba(124,111,255,0.2)"}`,
                      animationDelay: `${i * 0.03}s`
                    }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        msg.type === "query" ? "bg-pink-500" : "bg-purple-600"
                      }`}>
                        {msg.type === "query"
                          ? <User size={10} color="white" />
                          : <Bot size={10} color="white" />
                        }
                      </div>
                      <span className="text-xs font-medium" style={{
                        color: msg.type === "query" ? "#f472b6" : "var(--accent)",
                        fontFamily: "Syne, sans-serif"
                      }}>
                        {msg.type === "query" ? "You" : "AI"}
                      </span>
                      <span className="text-xs ml-auto" style={{ color: "var(--text-muted)" }}>
                        {formatTime(msg.created_at)}
                      </span>
                      {msg.ai_source && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          msg.ai_source === "RAG" ? "source-rag" : "source-llm"
                        }`}>
                          {msg.ai_source}
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text)" }}>
                      {msg.message}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={openPanel}
          className="ai-btn fixed bottom-6 left-6 z-50 w-14 h-14 rounded-2xl flex items-center justify-center transition-all hover:scale-110 hover:rotate-6"
          style={{
            background: "linear-gradient(135deg, var(--accent), var(--accent2))",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
          aria-label="Open AI Chat"
        >
          <Sparkles size={24} color="white" />
        </button>
      )}
    </>
  );
}