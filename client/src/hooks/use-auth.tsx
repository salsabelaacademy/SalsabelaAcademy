import {queryClient} from '@/lib/queryClient';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type AppRole = "student" | "admin";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: AppRole;
  status: string;
  avatarUrl: string | null;
  grade: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, turnstileToken?: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong");
  return data;
}

export function getDashboardPath(role: AppRole) {
  return role === "admin" ? "/dashboard/admin" : "/dashboard/student";
}

function isSupportedUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Partial<AuthUser>;
  return (user.role === "admin" || user.role === "student")
    && typeof user.id === "number"
    && typeof user.name === "string"
    && typeof user.email === "string";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    request("/api/auth/me")
      .then(data => {
        if (!isSupportedUser(data.user)) throw new Error("Unsupported account role");
        queryClient.clear();
    setUser(data.user);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string, turnstileToken?: string) {
    const data = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, turnstileToken }),
    });
    if (!isSupportedUser(data.user)) {
      await request("/api/auth/logout", { method: "POST" }).catch(() => undefined);
      throw new Error("This account type is not supported.");
    }
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    await request("/api/auth/logout", { method: "POST" });
    queryClient.clear();
    setUser(null);
  }

  async function logoutAll() {
    await request("/api/auth/logout-all", { method: "POST" });
    queryClient.clear();
    setUser(null);
  }

  async function refreshUser() {
    const data = await request("/api/auth/me");
    if (!isSupportedUser(data.user)) throw new Error("Invalid account");
    setUser(data.user);
  }

  const value = useMemo(() => ({ user, loading, login, logout, logoutAll, refreshUser }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
