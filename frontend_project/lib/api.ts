const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const WS_BASE = process.env.NEXT_WS_API_URL || "wss://agentic-ai-chatbot-parser.onrender.com";

// ─── Auth Interfaces ───────────────────────────────────────────────────────

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

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// ─── Token Helpers ─────────────────────────────────────────────────────────

export const TokenStorage = {
  get: (): string | null =>
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null,

  set: (token: string): void =>
    localStorage.setItem("access_token", token),

  remove: (): void =>
    localStorage.removeItem("access_token"),

  getUser: (): User | null => {
    if (typeof window === "undefined") return null;
    const u = localStorage.getItem("auth_user");
    return u ? JSON.parse(u) : null;
  },

  setUser: (user: User): void =>
    localStorage.setItem("auth_user", JSON.stringify(user)),

  clear: (): void => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("auth_user");
  },
};

// ─── Auth Header Helper ────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token = TokenStorage.get();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ─── Auth APIs ─────────────────────────────────────────────────────────────

export async function register(data: RegisterRequest): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Registration failed");
  }
  const result: TokenResponse = await res.json();
  TokenStorage.set(result.access_token);
  TokenStorage.setUser(result.user);
  return result;
}

export async function login(data: LoginRequest): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Login failed");
  }
  const result: TokenResponse = await res.json();
  TokenStorage.set(result.access_token);
  TokenStorage.setUser(result.user);
  return result;
}

export async function loginWithGoogle(googleToken: string): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: googleToken }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Google login failed");
  }
  const result: TokenResponse = await res.json();
  TokenStorage.set(result.access_token);
  TokenStorage.setUser(result.user);
  return result;
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    headers: authHeaders(),
  });
  TokenStorage.clear();
}

export async function getMe(): Promise<User> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    TokenStorage.clear();
    throw new Error("Session expired. Please login again.");
  }
  return res.json();
}

// ─── Chat Interfaces ───────────────────────────────────────────────────────

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

export interface SendMessageResponse {
  id: number;
  question: string;
  answer: string;
  source: string;
  created_at: string;
}

// ─── WebSocket Event Callbacks ─────────────────────────────────────────────

export interface WSChatCallbacks {
  onStatusUpdate?: (status: string) => void;
  onChunk?: (chunk: string, fullAnswer: string) => void;
  onDone?: (fullAnswer: string, source: string) => void;
  onError?: (error: Event) => void;
  onClose?: () => void;
}

// ─── WebSocket Chat Manager ────────────────────────────────────────────────

export class ChatWebSocket {
  private ws: WebSocket | null = null;
  private accumulatedAnswer = "";



  connect(callbacks: WSChatCallbacks): Promise<void> {
    return new Promise((resolve, reject) => {
      // 🔹 attach token as query param for WS auth
      const token = TokenStorage.get();
      const url = token
        ? `${WS_BASE}/ws/chat/?token=${token}`
        : `${WS_BASE}/ws/chat/`;

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log("WebSocket connected");
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
              callbacks.onDone?.(data.message, data.source);
              this.accumulatedAnswer = "";
              break;
            // 🔹 handle auth error from server
            case "error":
              if (data.code === 4001) {
                TokenStorage.clear();
                window.location.href = "/login";
              }
              break;
          }
        } catch (err) {
          console.error("Failed to parse WS message:", err);
        }
      };

      this.ws.onerror = (error) => {
        callbacks.onError?.(error);
        reject(error);
      };

      this.ws.onclose = (event) => {
        // 🔹 4001 = unauthorized — redirect to login
        if (event.code === 4001) {
          TokenStorage.clear();
          window.location.href = "/login";
          return;
        }
        callbacks.onClose?.();
      };
    });
  }

  sendMessage(message: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected");
    }
    this.accumulatedAnswer = "";
    this.ws.send(message);
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// ─── REST Chat APIs ────────────────────────────────────────────────────────

export async function sendMessage(
  message: string,
  user: string
): Promise<SendMessageResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: authHeaders(),   // 🔹 auth header added
    body: JSON.stringify({ message, user }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getChatHistory(

): Promise<ChatHistoryResponse> {
  const res = await fetch(
    `${API_BASE}/chat/history`,
    { headers: authHeaders() }  // 🔹 auth header added
  );
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}