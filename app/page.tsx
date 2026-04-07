"use client";

import { useState, useEffect } from "react";
import {
  LogOut, User as UserIcon, Zap, Shield, BookOpen,
  Database, Globe, ArrowRight, Terminal
} from "lucide-react";
import AuthModal   from "@/components/Authmodal";
import ChatPanel   from "@/components/ChatPanel";
import UploadPanel from "@/components/UploadPanel";
import { TokenStorage, getMe, logout, ENABLE_RAG_UPLOAD } from "@/lib/api";
import type { User, TokenResponse } from "@/lib/api";

type View = "landing" | "chat" | "upload";

export default function Home() {
  const [user,       setUser]       = useState<User | null>(null);
  const [authOpen,   setAuthOpen]   = useState(false);
  const [checking,   setChecking]   = useState(true);
  const [view,       setView]       = useState<View>("landing");
  const [panelClose, setPanelClose] = useState(false);

  useEffect(() => {
    const saved = TokenStorage.getUser();
    const token = TokenStorage.get();
    if (saved && token) {
      setUser(saved);
      getMe().then(setUser).catch(() => { TokenStorage.clear(); setUser(null); }).finally(() => setChecking(false));
    } else { setChecking(false); }
  }, []);

  const onAuthSuccess = (data: TokenResponse) => {
    setUser(data.user); setAuthOpen(false); setView("chat");
  };

  const onLogout = async () => {
    setPanelClose(true);
    setTimeout(async () => {
      await logout(); setUser(null); setView("landing"); setPanelClose(false);
    }, 240);
  };

  const openChat = () => {
    if (!user) { setAuthOpen(true); return; }
    setView("chat");
  };

  const switchView = (v: View) => {
    if (view === v) return;
    setPanelClose(true);
    setTimeout(() => { setView(v); setPanelClose(false); }, 240);
  };

  if (checking) return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="flex items-center gap-3" style={{ color: "var(--ink3)", fontSize: 13 }}>
        <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid var(--teal)", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
        Starting…
      </div>
    </div>
  );

  const showPanel = view !== "landing";

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>

      {/* ── Background mesh ─────────────────────────────────────────────── */}
      {/* Hidden on mobile to save paint/battery */}
      <div className="fixed inset-0 pointer-events-none hidden sm:block" style={{ zIndex: 0 }}>
        <div style={{
          position: "absolute", top: "15%", left: "20%",
          width: 600, height: 600, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,212,170,0.04) 0%, transparent 70%)",
        }} />
        <div style={{
          position: "absolute", bottom: "10%", right: "15%",
          width: 500, height: 500, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.04) 0%, transparent 70%)",
        }} />
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "linear-gradient(rgba(30,45,61,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(30,45,61,0.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
      </div>

      {/* ── Side panel (chat / upload) ──────────────────────────────────── */}
      {showPanel && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 fade-in"
            style={{ background: "rgba(8,12,16,0.7)", backdropFilter: "blur(6px)" }}
            onClick={() => switchView("landing")}
          />
          {/* Panel — full-width on mobile via .side-panel CSS class */}
          <aside
            className={`fixed left-0 top-0 h-full z-50 flex flex-col side-panel ${panelClose ? "panel-close" : "panel-open"}`}
            style={{
              background: "var(--surface)",
              borderRight: "1px solid var(--border2)",
              boxShadow: "24px 0 64px rgba(0,0,0,0.7)",
            }}
          >
            {view === "chat"   && <ChatPanel   userId={user?.email ?? "guest"} onShowUpload={() => switchView("upload")} onClose={() => switchView("landing")} />}
            {view === "upload" && <UploadPanel onClose={() => switchView("chat")} />}
          </aside>
        </>
      )}

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main className="relative z-10 flex flex-col min-h-screen w-full px-4 sm:px-6 py-6 sm:py-8">

        {/* ── Navbar ──────────────────────────────────────────────────── */}
        <nav className="flex items-center justify-between max-w-5xl mx-auto w-full">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div
              className="flex items-center justify-center rounded-lg flex-shrink-0"
              style={{ width: 32, height: 32, background: "linear-gradient(135deg, rgba(0,212,170,0.2), rgba(59,130,246,0.2))", border: "1px solid rgba(0,212,170,0.3)" }}
            >
              <Terminal size={14} style={{ color: "var(--teal)" }} />
            </div>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--ink)", letterSpacing: "-0.3px" }}>
              Nexus<span style={{ color: "var(--teal)" }}>AI</span>
            </span>
          </div>

          {/* Auth area */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                {/* User pill — visible sm+ */}
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg"
                  style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
                  <div className="flex items-center justify-center rounded-full"
                    style={{ width: 22, height: 22, background: "var(--teal-dim)", border: "1px solid rgba(0,212,170,0.3)" }}>
                    {user.avatar
                      ? <img src={user.avatar} className="w-full h-full rounded-full object-cover" alt="" />
                      : <UserIcon size={11} style={{ color: "var(--teal)" }} />
                    }
                  </div>
                  <span style={{ fontSize: 12, color: "var(--ink2)", fontFamily: "var(--font-display)" }}>
                    {user.name || user.email}
                  </span>
                </div>
                {/* Logout button — always visible, min 44px touch target */}
                <button
                  onClick={onLogout}
                  className="flex items-center justify-center rounded-lg transition-all hover:scale-105"
                  style={{ width: 44, height: 44, background: "var(--surface)", border: "1px solid var(--border2)", color: "var(--ink3)" }}
                  title="Sign out"
                >
                  <LogOut size={14} />
                </button>
              </>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className="px-4 rounded-lg text-sm font-semibold transition-all hover:scale-105"
                style={{
                  height: 44,
                  background: "var(--teal)", color: "#000", border: "none",
                  fontFamily: "var(--font-display)",
                }}
              >
                Sign In
              </button>
            )}
          </div>
        </nav>

        {/* ── Hero ────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-center text-center max-w-3xl mx-auto w-full py-10 sm:py-16">

          {/* Status pill */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs mb-6 sm:mb-8 fade-up"
            style={{ background: "rgba(0,212,170,0.08)", border: "1px solid rgba(0,212,170,0.2)", color: "var(--teal)" }}
          >
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--teal)", boxShadow: "0 0 6px var(--teal)", flexShrink: 0 }} />
            <span className="hidden xs:inline">RAG · Agentic Tools · Real-time Streaming</span>
            <span className="xs:hidden">Agentic AI · RAG</span>
          </div>

          {/* Heading — fluid type with clamp */}
          <h1 className="fade-up" style={{
            fontFamily: "var(--font-display)", fontWeight: 700,
            fontSize: "clamp(28px, 7vw, 64px)", lineHeight: 1.1,
            letterSpacing: "-1px", color: "var(--ink)", marginBottom: 16,
            animationDelay: "0.05s",
          }}>
            Document intelligence<br />
            <span className="shimmer-text">meets agentic AI</span>
          </h1>

          {/* Sub-copy — fluid, wraps gracefully */}
          <p className="fade-up px-2" style={{
            fontSize: "clamp(13px, 2.5vw, 17px)", color: "var(--ink3)", lineHeight: 1.7,
            maxWidth: 520, marginBottom: 28, animationDelay: "0.1s",
          }}>
            {user
              ? `Welcome back, ${user.name || "there"}. Your documents are ready to query.`
              : "Upload your documents, ask questions, and let the AI search, reason, and answer using your own knowledge base."
            }
          </p>

          {/* CTA buttons — stack on very small screens */}
          <div className="flex flex-col xs:flex-row flex-wrap items-center justify-center gap-3 fade-up w-full px-4 xs:px-0" style={{ animationDelay: "0.15s" }}>
            <button
              onClick={openChat}
              className="flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all hover:scale-105 w-full xs:w-auto"
              style={{
                fontFamily: "var(--font-display)",
                background: "linear-gradient(135deg, var(--teal), var(--blue))",
                color: "#000", border: "none",
                boxShadow: "0 4px 28px rgba(0,212,170,0.3)",
                padding: "14px 24px",
                minHeight: 48,
              }}
            >
              {user ? "Open Chat" : "Get Started"} <ArrowRight size={15} />
            </button>

            {user && ENABLE_RAG_UPLOAD && (
              <button
                onClick={() => { if (!user) { setAuthOpen(true); return; } switchView("upload"); }}
                className="flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all hover:scale-105 w-full xs:w-auto"
                style={{
                  fontFamily: "var(--font-display)",
                  background: "var(--surface)",
                  color: "var(--ink2)",
                  border: "1px solid var(--border2)",
                  padding: "14px 20px",
                  minHeight: 48,
                }}
              >
                <Database size={14} style={{ color: "var(--teal)" }} /> Upload Docs
              </button>
            )}
          </div>

          {/* Feature grid — 2-col on mobile, 4-col on sm+ */}
          <div className="feature-grid mt-12 sm:mt-16 max-w-2xl fade-up" style={{ animationDelay: "0.2s" }}>
            {[
              { icon: <BookOpen size={16} />, title: "RAG Search",   desc: "Answers from your docs" },
              { icon: <Zap      size={16} />, title: "10 Tools",     desc: "Weather, crypto, FX…" },
              { icon: <Shield   size={16} />, title: "Per-user RAG", desc: "Isolated knowledge base" },
              { icon: <Globe    size={16} />, title: "Live stream",  desc: "Token-by-token output" },
            ].map(f => (
              <div key={f.title} className="flex flex-col gap-2 p-3 sm:p-4 rounded-xl text-left"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div style={{ color: "var(--teal)" }}>{f.icon}</div>
                <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "clamp(11px, 2vw, 13px)", color: "var(--ink)" }}>{f.title}</p>
                <p style={{ fontSize: "clamp(10px, 1.8vw, 11px)", color: "var(--ink3)" }}>{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Env flag notice */}
          {!ENABLE_RAG_UPLOAD && (
            <div className="mt-8 px-4 py-2.5 rounded-lg flex items-start sm:items-center gap-2 fade-up text-left sm:text-center"
              style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", animationDelay: "0.25s" }}>
              <Database size={12} style={{ color: "var(--amber)", flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: 11, color: "var(--amber)" }}>
                Document upload is disabled. Set{" "}
                <code style={{ background: "rgba(245,158,11,0.12)", padding: "1px 5px", borderRadius: 4 }}>
                  NEXT_PUBLIC_ENABLE_RAG_UPLOAD=true
                </code>{" "}
                to enable.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="text-center py-2" style={{ fontSize: 11, color: "var(--ink3)" }}>
          Nexus AI · RAG + Agentic · Built with FastAPI + Next.js
        </footer>
      </main>

      {/* Auth modal */}
      {authOpen && <AuthModal onSuccess={onAuthSuccess} onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
