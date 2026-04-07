"use client";

import { useState } from "react";
import { X, Mail, Lock, User, Sparkles, Loader2, Eye, EyeOff } from "lucide-react";
import { login, register } from "@/lib/api";
import type { TokenResponse } from "@/lib/api";

interface AuthModalProps {
    onSuccess: (data: TokenResponse) => void;
    onClose: () => void;
}

export default function AuthModal({ onSuccess, onClose }: AuthModalProps) {
    const [mode, setMode] = useState<"login" | "register">("login");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [form, setForm] = useState({ name: "", email: "", password: "" });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
        setError("");
    };

    const handleSubmit = async () => {
        if (!form.email || !form.password) { setError("Please fill in all fields."); return; }
        if (mode === "register" && !form.name) { setError("Please enter your name."); return; }
        setLoading(true);
        setError("");
        try {
            const result = mode === "login"
                ? await login({ email: form.email, password: form.password })
                : await register({ name: form.name, email: form.email, password: form.password });
            onSuccess(result);
        } catch (err: any) {
            setError(err.message || "Something went wrong.");
        } finally {
            setLoading(false);
        }
    };

    const inputStyle: React.CSSProperties = {
        width: "100%",
        boxSizing: "border-box",
        paddingLeft: "42px",
        paddingRight: "16px",
        paddingTop: "13px",
        paddingBottom: "13px",
        background: "#0d0d1a",
        border: "1px solid #2d2d4e",
        borderRadius: "10px",
        color: "white",
        fontSize: "14px",
        outline: "none",
        fontFamily: "DM Mono, monospace",
        transition: "border-color 0.2s",
    };

    return (
        <div
            style={{
                position: "fixed", inset: 0, zIndex: 9999,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(0,0,0,0.8)",
                backdropFilter: "blur(12px)",
                padding: "16px",
            }}
            onClick={onClose}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    width: "100%",
                    maxWidth: "420px",
                    background: "#13131f",
                    border: "1px solid #2d2d4e",
                    borderRadius: "20px",
                    overflow: "hidden",
                    boxShadow: "0 50px 100px rgba(0,0,0,0.9), 0 0 80px rgba(124,111,255,0.12)",
                    animation: "modalIn 0.25s cubic-bezier(0.34,1.56,0.64,1) forwards",
                }}
            >
                {/* Top accent bar */}
                <div style={{
                    height: "3px",
                    background: "linear-gradient(90deg, #7c6fff, #a855f7, #06b6d4)",
                }} />

                <div style={{ padding: "28px 28px 24px" }}>

                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                            <div style={{
                                width: "46px", height: "46px", borderRadius: "13px", flexShrink: 0,
                                background: "linear-gradient(135deg, #7c6fff, #a855f7)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                boxShadow: "0 0 28px rgba(124,111,255,0.45)",
                            }}>
                                <Sparkles size={20} color="white" />
                            </div>
                            <div>
                                <h2 style={{
                                    margin: 0, fontSize: "19px", fontWeight: 700, color: "white",
                                    fontFamily: "Syne, sans-serif", letterSpacing: "-0.3px",
                                }}>
                                    {mode === "login" ? "Welcome back" : "Create account"}
                                </h2>
                                <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#6b7280" }}>
                                    {mode === "login" ? "Sign in to your AI assistant" : "Join to start chatting with AI"}
                                </p>
                            </div>
                        </div>

                        <button onClick={onClose} style={{
                            width: "30px", height: "30px", borderRadius: "8px",
                            border: "1px solid #2d2d4e", background: "#1a1a2e",
                            color: "#6b7280", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}>
                            <X size={13} />
                        </button>
                    </div>

                    {/* Tab switcher */}
                    <div style={{
                        display: "flex", gap: "4px", padding: "4px",
                        background: "#0d0d1a", borderRadius: "11px",
                        border: "1px solid #2d2d4e", marginBottom: "20px",
                    }}>
                        {(["login", "register"] as const).map(tab => (
                            <button key={tab} onClick={() => { setMode(tab); setError(""); }} style={{
                                flex: 1, padding: "9px 0", borderRadius: "7px", border: "none",
                                fontSize: "13px", fontWeight: 600, cursor: "pointer",
                                transition: "all 0.2s",
                                background: mode === tab ? "#7c6fff" : "transparent",
                                color: mode === tab ? "white" : "#6b7280",
                                fontFamily: "Syne, sans-serif",
                            }}>
                                {tab === "login" ? "Sign In" : "Sign Up"}
                            </button>
                        ))}
                    </div>

                    {/* Fields */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

                        {mode === "register" && (
                            <div style={{ position: "relative" }}>
                                <div style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#4b5563", pointerEvents: "none" }}>
                                    <User size={14} />
                                </div>
                                <input
                                    type="text" name="name" placeholder="Full name"
                                    value={form.name} onChange={handleChange}
                                    onKeyDown={e => e.key === "Enter" && handleSubmit()}
                                    style={inputStyle}
                                />
                            </div>
                        )}

                        <div style={{ position: "relative" }}>
                            <div style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#4b5563", pointerEvents: "none" }}>
                                <Mail size={14} />
                            </div>
                            <input
                                type="email" name="email" placeholder="Email address"
                                value={form.email} onChange={handleChange}
                                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                                style={inputStyle}
                            />
                        </div>

                        <div style={{ position: "relative" }}>
                            <div style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#4b5563", pointerEvents: "none" }}>
                                <Lock size={14} />
                            </div>
                            <input
                                type={showPassword ? "text" : "password"} name="password" placeholder="Password"
                                value={form.password} onChange={handleChange}
                                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                                style={{ ...inputStyle, paddingRight: "42px" }}
                            />
                            <button onClick={() => setShowPassword(p => !p)} style={{
                                position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)",
                                background: "none", border: "none", cursor: "pointer", color: "#4b5563",
                                display: "flex", alignItems: "center", padding: 0,
                            }}>
                                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div style={{
                            marginTop: "12px", padding: "10px 13px", borderRadius: "8px",
                            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
                            color: "#f87171", fontSize: "12px", lineHeight: "1.4",
                        }}>
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        onClick={handleSubmit} disabled={loading}
                        style={{
                            width: "100%", marginTop: "18px", padding: "14px",
                            borderRadius: "11px", border: "none",
                            background: loading ? "#2d2d4e" : "linear-gradient(135deg, #7c6fff, #a855f7)",
                            color: "white", fontSize: "14px", fontWeight: 700,
                            cursor: loading ? "not-allowed" : "pointer",
                            fontFamily: "Syne, sans-serif", letterSpacing: "0.2px",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                            opacity: loading ? 0.75 : 1,
                            transition: "opacity 0.2s, transform 0.15s",
                            boxShadow: loading ? "none" : "0 4px 20px rgba(124,111,255,0.35)",
                        }}
                    >
                        {loading
                            ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Processing...</>
                            : mode === "login" ? "Sign In →" : "Create Account →"
                        }
                    </button>

                    {/* Switch */}
                    <p style={{ textAlign: "center", marginTop: "16px", marginBottom: 0, fontSize: "12px", color: "#6b7280" }}>
                        {mode === "login" ? "Don't have an account? " : "Already have an account? "}
                        <button
                            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#7c6fff", fontWeight: 600, fontSize: "12px", padding: 0 }}
                        >
                            {mode === "login" ? "Sign up free" : "Sign in"}
                        </button>
                    </p>
                </div>
            </div>

            <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.88) translateY(24px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        input[type="text"]::placeholder,
        input[type="email"]::placeholder,
        input[type="password"]::placeholder { color: #3d3d5c !important; }
        input[type="text"]:focus,
        input[type="email"]:focus,
        input[type="password"]:focus { border-color: #7c6fff !important; box-shadow: 0 0 0 3px rgba(124,111,255,0.12); }
      `}</style>
        </div>
    );
}