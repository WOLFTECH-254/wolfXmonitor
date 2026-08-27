import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useListMonitors } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Globe, Users, Plus, Trash2, ExternalLink, Lock, Loader2, Mail, Check, Clock,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: init?.body ? { "content-type": "application/json" } : undefined,
    ...init,
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? "Request failed");
  return body as T;
}

// ── Status pages ────────────────────────────────────────────────────────────

interface StatusPageRow {
  id: number; slug: string; name: string; description: string;
  isPublic: boolean; monitorCount: number;
}
interface StatusPagesResponse {
  pages: StatusPageRow[]; limit: number; limitLabel: string; canCreate: boolean;
}

function StatusPagesCard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery<StatusPagesResponse>({
    queryKey: ["me-status-pages"],
    queryFn: () => api<StatusPagesResponse>("/api/me/status-pages"),
  });
  const { data: monitors = [] } = useListMonitors();

  const create = useMutation({
    mutationFn: () =>
      api("/api/me/status-pages", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), monitorIds: picked }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me-status-pages"] });
      setName(""); setPicked([]); setCreating(false);
      toast({ title: "Status page created" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Could not create", description: e.message }),
  });

  const del = useMutation({
    mutationFn: (id: number) => api(`/api/me/status-pages/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me-status-pages"] });
      toast({ title: "Status page deleted" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Could not delete", description: e.message }),
  });

  const limitLabel = data?.limitLabel ?? "—";
  const canCreate = !!data?.canCreate;
  const noneAllowed = data?.limit === 0;

  return (
    <section className="border border-border bg-card rounded-lg p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
          <Globe className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-lg tracking-wide text-foreground">Status Pages</h2>
          <p className="font-mono text-[11px] text-muted-foreground">
            Public pages showing a chosen set of monitors · plan allows {limitLabel}
          </p>
        </div>
        {!creating && canCreate && (
          <Button size="sm" className="font-mono text-xs" onClick={() => setCreating(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> New
          </Button>
        )}
      </div>

      {noneAllowed && (
        <div className="bg-primary/5 border border-primary/30 rounded p-3 flex gap-2">
          <Lock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div className="font-mono text-[11px] text-muted-foreground leading-relaxed">
            Custom status pages aren't included on your plan.{" "}
            <Link href="/upgrade" className="text-primary hover:underline font-semibold">Upgrade</Link> to publish one.
          </div>
        </div>
      )}

      {creating && (
        <div className="border border-border rounded-md p-4 space-y-3 bg-background">
          <Input
            autoFocus placeholder="Status page name (e.g. Public API)"
            value={name} onChange={(e) => setName(e.target.value)}
            className="font-mono text-sm"
          />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Include monitors</p>
            <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
              {monitors.length === 0 && <p className="font-mono text-[11px] text-muted-foreground">No monitors yet.</p>}
              {monitors.map((m) => (
                <label key={m.id} className="flex items-center gap-2 font-mono text-xs text-foreground cursor-pointer py-1">
                  <input
                    type="checkbox"
                    checked={picked.includes(m.id)}
                    onChange={(e) =>
                      setPicked((p) => (e.target.checked ? [...p, m.id] : p.filter((x) => x !== m.id)))
                    }
                  />
                  <span className="truncate">{m.name}</span>
                  <span className="text-muted-foreground truncate">{m.url}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              className="font-mono text-xs text-muted-foreground hover:text-foreground px-3 py-2"
              onClick={() => { setCreating(false); setName(""); setPicked([]); }}
            >
              Cancel
            </button>
            <Button
              size="sm" className="font-mono text-xs"
              disabled={!name.trim() || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="font-mono text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-2">
          {data?.pages.length === 0 && !creating && !noneAllowed && (
            <p className="font-mono text-xs text-muted-foreground">No status pages yet.</p>
          )}
          {data?.pages.map((p) => (
            <div key={p.id} className="border border-border rounded-md p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-sm text-foreground truncate">{p.name}</div>
                <a
                  href={`${BASE}/status-pages/${p.slug}`}
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-primary transition-colors"
                >
                  /status-pages/{p.slug} <ExternalLink className="w-3 h-3" />
                </a>
                <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                  {p.monitorCount} monitor{p.monitorCount === 1 ? "" : "s"} · {p.isPublic ? "public" : "private"}
                </div>
              </div>
              <button
                className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                onClick={() => del.mutate(p.id)}
                disabled={del.isPending}
                title="Delete status page"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Team ────────────────────────────────────────────────────────────────────

interface TeamMember {
  id: number; email: string; role: string; status: string;
}
interface TeamResponse {
  team: { id: number; name: string };
  owner: { id: number; name: string | null; email: string; role: "owner"; status: "active" };
  members: TeamMember[];
  seatLimit: number; seatLimitLabel: string; seatsUsed: number; canInvite: boolean;
}

function TeamCard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [email, setEmail] = useState("");

  const { data, isLoading } = useQuery<TeamResponse>({
    queryKey: ["me-team"],
    queryFn: () => api<TeamResponse>("/api/me/team"),
  });

  const invite = useMutation({
    mutationFn: () =>
      api("/api/me/team/members", { method: "POST", body: JSON.stringify({ email: email.trim() }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me-team"] });
      setEmail("");
      toast({ title: "Invitation added", description: "They'll get access when they sign in with that email." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Could not invite", description: e.message }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/me/team/members/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me-team"] });
      toast({ title: "Member removed" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Could not remove", description: e.message }),
  });

  return (
    <section className="border border-border bg-card rounded-lg p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
          <Users className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-lg tracking-wide text-foreground">Team</h2>
          <p className="font-mono text-[11px] text-muted-foreground">
            {data ? `${data.seatsUsed} of ${data.seatLimitLabel} seats used` : "Invite people to your workspace"}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="font-mono text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : data ? (
        <>
          <div className="space-y-2">
            <div className="border border-border rounded-md p-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-mono text-sm text-foreground truncate">{data.owner.name ?? data.owner.email}</div>
                <div className="font-mono text-[11px] text-muted-foreground truncate">{data.owner.email}</div>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-primary border border-primary/25 bg-primary/5 px-2 py-0.5 rounded shrink-0">
                Owner
              </span>
            </div>
            {data.members.map((m) => (
              <div key={m.id} className="border border-border rounded-md p-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="font-mono text-sm text-foreground truncate">{m.email}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border ${
                    m.status === "active"
                      ? "text-primary border-primary/25 bg-primary/5"
                      : "text-yellow-400 border-yellow-500/25 bg-yellow-500/5"
                  }`}>
                    {m.status === "active" ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    {m.status}
                  </span>
                  <button
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    onClick={() => remove.mutate(m.id)}
                    disabled={remove.isPending}
                    title="Remove member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {data.canInvite ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => { e.preventDefault(); if (email.trim()) invite.mutate(); }}
            >
              <Input
                type="email" placeholder="teammate@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="font-mono text-sm"
              />
              <Button type="submit" size="sm" className="font-mono text-xs shrink-0" disabled={!email.trim() || invite.isPending}>
                {invite.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Plus className="w-3.5 h-3.5 mr-1.5" /> Invite</>}
              </Button>
            </form>
          ) : (
            <div className="bg-primary/5 border border-primary/30 rounded p-3 flex gap-2">
              <Lock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div className="font-mono text-[11px] text-muted-foreground leading-relaxed">
                Your plan is single-user.{" "}
                <Link href="/upgrade" className="text-primary hover:underline font-semibold">Upgrade</Link> to invite teammates.
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="font-mono text-xs text-muted-foreground">Couldn't load team.</p>
      )}
    </section>
  );
}

export default function Workspace() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <Layout>
      <Helmet><title>Workspace — GuardiX</title></Helmet>
      <div className="max-w-3xl space-y-8">
        <div>
          <h1 className="font-display text-2xl tracking-wide text-foreground">
            Work<span className="text-primary">space</span>
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            Manage your published status pages and team members. Limits come from your plan.
          </p>
        </div>
        <StatusPagesCard />
        <TeamCard />
      </div>
    </Layout>
  );
}
