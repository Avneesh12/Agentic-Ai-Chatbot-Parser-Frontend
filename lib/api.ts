// ─── Config ────────────────────────────────────────────────────────────────
//
// NEXT_PUBLIC_API_URL       → REST base URL  (default: http://localhost:8000/api)
// NEXT_PUBLIC_WS_URL        → WS  base URL   (default: ws://localhost:8000)
// NEXT_PUBLIC_ENABLE_RAG_UPLOAD → "true" | "false"
//   When "false" the upload panel is completely hidden and the /api/upload
//   endpoint is never called. Flip to "true" to enable multi-file RAG ingestion.

export const ENABLE_RAG_UPLOAD =
  process.env.NEXT_PUBLIC_ENABLE_RAG_UPLOAD === "true";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

// ─── Auth types ─────────────────────────────────────────────────────────────

export interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string;
}
export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}
export interface RegisterRequest { name: string; email: string; password: string; }
export interface LoginRequest    { email: string; password: string; }

// ─── Token helpers ───────────────────────────────────────────────────────────

export const TokenStorage = {
  get:     (): string | null =>
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null,
  set:     (t: string) => localStorage.setItem("access_token", t),
  remove:  ()          => localStorage.removeItem("access_token"),
  getUser: (): User | null => {
    if (typeof window === "undefined") return null;
    const u = localStorage.getItem("auth_user");
    return u ? JSON.parse(u) : null;
  },
  setUser: (u: User)   => localStorage.setItem("auth_user", JSON.stringify(u)),
  clear:   () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("auth_user");
  },
};

function authHeaders(): Record<string, string> {
  const t = TokenStorage.get();
  return {
    "Content-Type": "application/json",
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

// ─── Auth APIs ───────────────────────────────────────────────────────────────

export async function register(data: RegisterRequest): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "Registration failed"); }
  const result: TokenResponse = await res.json();
  TokenStorage.set(result.access_token);
  TokenStorage.setUser(result.user);
  return result;
}

export async function login(data: LoginRequest): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "Login failed"); }
  const result: TokenResponse = await res.json();
  TokenStorage.set(result.access_token);
  TokenStorage.setUser(result.user);
  return result;
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, { method: "POST", headers: authHeaders() });
  TokenStorage.clear();
}

export async function getMe(): Promise<User> {
  const res = await fetch(`${API_BASE}/auth/me`, { headers: authHeaders() });
  if (!res.ok) { TokenStorage.clear(); throw new Error("Session expired"); }
  return res.json();
}

// ─── Multi-file RAG upload ───────────────────────────────────────────────────
//
// Gated by ENABLE_RAG_UPLOAD flag. Accepts up to 20 files.
// Returns a per-file status report from the backend.

export interface FileUploadResult {
  filename: string;
  status: "indexed" | "rejected" | "error";
  chunks_inserted?: number;
  saved_as?: string;
  reason?: string;
}

export interface UploadResponse {
  summary: { total: number; indexed: number; failed: number };
  files: FileUploadResult[];
}

export async function uploadFiles(files: File[]): Promise<UploadResponse> {
  if (!ENABLE_RAG_UPLOAD) {
    throw new Error("RAG upload is disabled. Set NEXT_PUBLIC_ENABLE_RAG_UPLOAD=true to enable.");
  }

  const token = TokenStorage.get();
  const form  = new FormData();
  files.forEach(f => form.append("files", f));

  const res = await fetch(`${API_BASE}/kb/upload/`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  // Accept both 200 (all ok) and 422 (some failed)
  if (res.status !== 200 && res.status !== 422) {
    const e = await res.json().catch(() => ({}));
    throw new Error((e as any).detail || `Upload failed: ${res.status}`);
  }

  return res.json();
}

// ─── Chat types ──────────────────────────────────────────────────────────────

export interface ChatMessage {
  type: "query" | "ai";
  message: string;
  ai_source?: string;
  created_at: string;
}

export interface ChatHistoryResponse {
  user: string;
  total_messages: number;
  chats: ChatMessage[];
}

export async function getChatHistory(): Promise<ChatHistoryResponse> {
  const res = await fetch(`${API_BASE}/chat/history`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ─── WebSocket chat ──────────────────────────────────────────────────────────

export interface WSChatCallbacks {
  onStatusUpdate?: (status: string) => void;
  onChunk?:        (chunk: string, fullAnswer: string) => void;
  onDone?:         (fullAnswer: string, source: string, toolResult?: unknown) => void;
  onError?:        (error: Event) => void;
  onClose?:        () => void;
}

export class ChatWebSocket {
  private ws:                WebSocket | null = null;
  private accumulatedAnswer: string           = "";

connect(callbacks: WSChatCallbacks): Promise<void> {
  return new Promise((resolve, reject) => {
    const token = TokenStorage.get();

    const url = token
      ? `${WS_BASE}/ws/chat/?token=${token}`
      : `${WS_BASE}/ws/chat/`;

    this.ws = new WebSocket(url);

    // ✅ Add connection timeout — prevents silent hangs
    const timeout = setTimeout(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) {
        this.ws?.close();
        reject(new Error("WebSocket connection timeout"));
      }
    }, 8000);

    this.ws.onopen = () => {
      clearTimeout(timeout);
      resolve();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case "status":
            callbacks.onStatusUpdate?.(data.message);
            break;
          case "stream":
            this.accumulatedAnswer += data.chunk;
            callbacks.onChunk?.(data.chunk, this.accumulatedAnswer);
            break;
          case "done":
            callbacks.onDone?.(data.message, data.source, data.tool_result);
            this.accumulatedAnswer = "";
            break;
          case "error":
            if (data.code === 4001) {
              TokenStorage.clear();
              window.location.href = "/";
            }
            break;
        }
      } catch { /* ignore malformed frames */ }
    };

    this.ws.onerror = (e) => {
      clearTimeout(timeout);
      callbacks.onError?.(e);
      reject(e);
    };

    this.ws.onclose = (e) => {
      clearTimeout(timeout);
      // ✅ Handle all abnormal close codes
      if (e.code === 4001) {
        TokenStorage.clear();
        window.location.href = "/";
        return;
      }
      // 1006 = abnormal closure, 1005 = no status — both are normal browser behavior
      if (e.code !== 1000 && e.code !== 1001) {
        console.warn(`WS closed abnormally: code=${e.code}`);
      }
      callbacks.onClose?.();
    };
  });
}

  sendMessage(msg: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN)
      throw new Error("WebSocket not open");
    this.accumulatedAnswer = "";
    this.ws.send(msg);
  }

  disconnect(): void { this.ws?.close(); this.ws = null; }
  get isConnected(): boolean { return this.ws?.readyState === WebSocket.OPEN; }
}
