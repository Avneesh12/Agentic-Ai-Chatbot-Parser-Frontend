"use client";

import { useState, useEffect } from "react";
import ChatWidget from "@/components/ChatWidget";
import { TokenStorage, getMe, logout } from "@/lib/api";
import type { User, TokenResponse } from "@/lib/api";
import { LogOut, User as UserIcon } from "lucide-react";
import AuthModal from "@/components/Authmodal";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // 🔹 Check auth on mount
  useEffect(() => {
    const savedUser = TokenStorage.getUser();
    const token = TokenStorage.get();

    if (savedUser && token) {
      setUser(savedUser);
      // Verify token is still valid
      getMe()
        .then(setUser)
        .catch(() => {
          TokenStorage.clear();
          setUser(null);
        })
        .finally(() => setCheckingAuth(false));
    } else {
      setCheckingAuth(false);
    }
  }, []);

  // 🔹 Called when floating button is clicked
  const handleChatOpen = () => {
    if (!user) {
      setShowAuth(true);   // not logged in → show auth modal
    }
    // if logged in → ChatWidget handles opening itself
  };

  // 🔹 Called after successful login/register
  const handleAuthSuccess = (data: TokenResponse) => {
    setUser(data.user);
    setShowAuth(false);
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">

      {/* Top right user info */}
      {user && (
        <div className="fixed top-5 right-5 z-40 flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, var(--accent), var(--accent2))" }}>
              {user.avatar
                ? <img src={user.avatar} className="w-6 h-6 rounded-full object-cover" />
                : <UserIcon size={12} color="white" />
              }
            </div>
            <span className="text-xs font-medium" style={{ color: "var(--text)" }}>
              {user.name || user.email}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-110"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text-muted)"
            }}
            title="Logout"
          >
            <LogOut size={15} />
          </button>
        </div>
      )}

      <div className="max-w-2xl text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs mb-8"
          style={{
            background: "rgba(124,111,255,0.1)",
            border: "1px solid rgba(124,111,255,0.3)",
            color: "var(--accent)"
          }}>
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
          RAG + LLM Powered
        </div>

        <h1 className="text-5xl font-extrabold mb-4 leading-tight"
          style={{ fontFamily: "Syne, sans-serif" }}>
          <span className="shimmer-text">AI Chat</span>
          <br />
          <span style={{ color: "var(--text)" }}>Assistant</span>
        </h1>

        <p className="text-base mb-10" style={{ color: "var(--text-muted)" }}>
          Intelligent responses powered by Retrieval-Augmented Generation.
          <br />
          {user
            ? `Welcome back, ${user.name || "there"}! Click the button to start.`
            : "Click the button below to sign in and start chatting."
          }
        </p>

        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: "⚡", label: "Fast", desc: "Local embeddings" },
            { icon: "🧠", label: "Smart", desc: "RAG + LLM fusion" },
            { icon: "🔒", label: "Private", desc: "Your data stays yours" },
          ].map(f => (
            <div key={f.label} className="p-4 rounded-2xl text-center"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="text-2xl mb-2">{f.icon}</div>
              <div className="font-semibold text-sm mb-1"
                style={{ fontFamily: "Syne, sans-serif", color: "var(--text)" }}>
                {f.label}
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 🔹 Auth Modal */}
      {showAuth && (
        <AuthModal
          onSuccess={handleAuthSuccess}
          onClose={() => setShowAuth(false)}
        />
      )}

      {/* 🔹 ChatWidget — only shown when logged in, passes onAuthRequired */}
      <ChatWidget
        isAuthenticated={!!user}
        userId={user?.name || user?.email || "guest"}
        onAuthRequired={() => setShowAuth(true)}
      />
    </main>
  );
}