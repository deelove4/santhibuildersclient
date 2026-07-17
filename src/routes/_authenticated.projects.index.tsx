import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Building2, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { STAGES } from "@/lib/stages";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useRole } from "@/lib/use-role";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";

export const Route = createFileRoute("/_authenticated/projects/")({
  component: ProjectsPage,
});

interface Row {
  id: string;
  name: string;
  address: string | null;
  status: string;
  overall_progress: number;
  current_stage_key: string | null;
  villa_number: string | null;
  client_id: string;
  start_date: string | null;
  updated_at: string;
}

interface ClientOpt {
  id: string;
  full_name: string | null;
  email: string;
}

const STATUS_OPTIONS = ["all", "planning", "active", "on_hold", "handover", "completed"];

function ProjectsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [clientId, setClientId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [userId, setUserId] = useState<string | undefined>();
  const role = useRole(userId);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);

  function load() {
    supabase
      .from("projects")
      .select("id, name, address, status, overall_progress, current_stage_key, villa_number, client_id, start_date, updated_at")
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        setRows((data ?? []) as Row[]);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("projects-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (role !== "admin") return;
    supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "client")
      .then(async ({ data: r }) => {
        const ids = (r ?? []).map((x) => x.user_id);
        if (!ids.length) return setClients([]);
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", ids)
          .order("full_name");
        setClients((data ?? []) as ClientOpt[]);
      });
  }, [role]);

  const filtered = useMemo(() => {
    const fromTs = from ? new Date(from).getTime() : null;
    const toTs = to ? new Date(to).getTime() + 24 * 60 * 60 * 1000 : null;
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (clientId !== "all" && r.client_id !== clientId) return false;
      if (fromTs || toTs) {
        const ts = r.start_date ? new Date(r.start_date).getTime() : null;
        if (!ts) return false;
        if (fromTs && ts < fromTs) return false;
        if (toTs && ts > toTs) return false;
      }
      if (q) {
        const needle = q.toLowerCase();
        const hay = `${r.name} ${r.address ?? ""} ${r.villa_number ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, q, status, clientId, from, to]);

  const activeFilters = (status !== "all" ? 1 : 0) + (clientId !== "all" ? 1 : 0) + (from ? 1 : 0) + (to ? 1 : 0);

  function clearFilters() {
    setStatus("all");
    setClientId("all");
    setFrom("");
    setTo("");
    setQ("");
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Portfolio
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">Projects</h1>
        </div>
        {role === "admin" && <NewProjectDialog onCreated={load} />}
      </header>

      <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_180px_220px_150px_150px_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, villa #, address…"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s === "all" ? "All statuses" : s.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {role === "admin" && (
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger>
              <SelectValue placeholder="Client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.full_name || c.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} placeholder="To" />
        {activeFilters > 0 || q ? (
          <Button variant="ghost" onClick={clearFilters}>
            <X className="mr-1 size-4" /> Clear
          </Button>
        ) : (
          <div />
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/60" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-16 text-center">
          <Building2 className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No projects match your filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Project</th>
                <th className="px-5 py-3">Stage</th>
                <th className="px-5 py-3">Progress</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const stage = STAGES.find((s) => s.key === r.current_stage_key);
                return (
                  <tr
                    key={r.id}
                    className="group border-b border-border last:border-b-0 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-5 py-4">
                      <Link to="/projects/$id" params={{ id: r.id }} className="block">
                        <div className="font-display font-semibold group-hover:text-primary">{r.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.villa_number ? `${r.villa_number} · ` : ""}
                          {r.address ?? "—"}
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">{stage?.name ?? "—"}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${r.overall_progress}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs tabular-nums">{r.overall_progress}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest",
                          statusStyles(r.status),
                        )}
                      >
                        {r.status.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function statusStyles(status: string) {
  switch (status) {
    case "active":
      return "bg-primary/10 text-primary";
    case "on_hold":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    case "handover":
      return "bg-accent/15 text-accent-foreground";
    case "completed":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}
