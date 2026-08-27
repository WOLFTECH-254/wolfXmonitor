import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface PlanLimits {
  slug: string;
  name: string;
  monitorLimit: number;
  checkIntervalSeconds: number;
  retentionDays: number;
  statusPageLimit: number;
  teamMemberLimit: number;
  emailAlerts: boolean;
  webhookAlerts: boolean;
  telegramAlerts: boolean;
  sslMonitoring: boolean;
  isUnlimited: boolean;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  notificationEmail: string | null;
  notificationsEnabled: boolean;
  isAdmin: boolean;
  country: string | null;
  plan: string; // legacy "free" | "pro"
  planSlug?: string;
  planName?: string;
  overLimit?: boolean;
  subscriptionStatus?: string;
  planExpiresAt?: string | null;
  planLimits?: PlanLimits;
}

async function fetchMe(): Promise<AuthUser | null> {
  const res = await fetch(`${BASE}/api/auth/me`, { credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Failed to fetch user");
  return res.json();
}

async function apiLogin(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Login failed");
  }
  return res.json();
}

async function apiRegister(name: string, email: string, password: string, country?: string): Promise<AuthUser> {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, email, password, country }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Registration failed");
  }
  return res.json();
}

async function apiLogout(): Promise<void> {
  await fetch(`${BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
}

interface AuthContext {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, country?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthContext | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data: user = null, isLoading } = useQuery({
    queryKey: ["auth-me"],
    queryFn: fetchMe,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      apiLogin(email, password),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth-me"] }),
  });

  const registerMutation = useMutation({
    mutationFn: ({ name, email, password, country }: { name: string; email: string; password: string; country?: string }) =>
      apiRegister(name, email, password, country),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth-me"] }),
  });

  const logoutMutation = useMutation({
    mutationFn: apiLogout,
    onSuccess: () => {
      queryClient.setQueryData(["auth-me"], null);
      queryClient.clear();
    },
  });

  return (
    <Ctx.Provider
      value={{
        user,
        isLoading,
        login: async (email, password) => { await loginMutation.mutateAsync({ email, password }); },
        register: async (name, email, password, country) => { await registerMutation.mutateAsync({ name, email, password, country }); },
        logout: async () => { await logoutMutation.mutateAsync(); },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
