import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Search,
  X,
  LayoutGrid,
  List,
  GanttChartSquare,
  MapPin,
  CalendarDays,
  TrendingUp,
  Sparkles,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  AlertTriangle,
} from "lucide-react";
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
  expected_completion: string | null;
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
  const [view, setView] = useState<"grid" | "list">("grid");
  const [userId, setUserId] = useState<string | undefined>();
  const role = useRole(userId);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);

  function load() {
    supabase
      .from("projects")
      .select(
        "id, name, address, status, overall_progress, current_stage_key, villa_number, client_id, start_date, expected_completion, updated_at",
      )
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        setRows((data ?? []) as Row[]);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`projects-list:${Math.random().toString(36).slice(2, 10)}`)
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

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.status === "active").length;
    const nearing = rows.filter((r) => (r.overall_progress ?? 0) >= 80 && r.status !== "completed").length;
    const avg = total ? Math.round(rows.reduce((s, r) => s + (r.overall_progress ?? 0), 0) / total) : 0;
    return { total, active, nearing, avg };
  }, [rows]);

  const activeFilters =
    (status !== "all" ? 1 : 0) + (clientId !== "all" ? 1 : 0) + (from ? 1 : 0) + (to ? 1 : 0);

  function clearFilters() {
    setStatus("all");
    setClientId("all");
    setFrom("");
    setTo("");
    setQ("");
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-10">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-accent/10 p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 size-64 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Portfolio · Live
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {role === "admin" ? "All construction projects" : "Your projects"}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Track progress across every stage in real time — from site prep to handover.
            </p>
          </div>
          {role === "admin" && <NewProjectDialog onCreated={load} />}
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat icon={Building2} label="Total" value={stats.total} />
          <MiniStat icon={TrendingUp} label="Active" value={stats.active} tone="primary" />
          <MiniStat icon={Sparkles} label="Nearing handover" value={stats.nearing} tone="accent" />
          <MiniStat icon={Clock3} label="Avg. progress" value={`${stats.avg}%`} />
        </div>
      </div>

      {/* Filter bar */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-3 sm:p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_170px_200px_140px_140px_auto]">
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
          {role === "admin" ? (
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
          ) : (
            <div className="hidden lg:block" />
          )}
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="From"
          />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} placeholder="To" />
          <div className="flex items-center gap-2">
            {(activeFilters > 0 || q) && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 size-4" /> Clear
              </Button>
            )}
            <div className="ml-auto inline-flex overflow-hidden rounded-lg border border-border">
              <button
                onClick={() => setView("grid")}
                className={cn(
                  "p-2 transition-colors",
                  view === "grid"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
                aria-label="Grid view"
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                onClick={() => setView("list")}
                className={cn(
                  "p-2 transition-colors",
                  view === "list"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
                aria-label="List view"
              >
                <List className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="mt-6">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 animate-pulse rounded-2xl bg-muted/60" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-16 text-center">
            <Building2 className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No projects match your filters.</p>
          </div>
        ) : view === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r, i) => (
              <ProjectCard key={r.id} row={r} index={i} />
            ))}
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
                      className="group border-b border-border transition-colors last:border-b-0 hover:bg-muted/30"
                    >
                      <td className="px-5 py-4">
                        <Link to="/projects/$id" params={{ id: r.id }} className="block">
                          <div className="font-display font-semibold group-hover:text-primary">
                            {r.name}
                          </div>
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
                          <span className="font-mono text-xs tabular-nums">
                            {r.overall_progress}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill status={r.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  tone?: "default" | "primary" | "accent";
}) {
  const toneClass =
    tone === "primary"
      ? "bg-primary/10 text-primary"
      : tone === "accent"
        ? "bg-accent/15 text-accent-foreground"
        : "bg-muted text-muted-foreground";
  return (
    <div className="rounded-xl border border-border bg-card/70 p-3 backdrop-blur-sm sm:p-4">
      <div className="flex items-center gap-2">
        <div className={cn("grid size-7 place-items-center rounded-lg", toneClass)}>
          <Icon className="size-3.5" />
        </div>
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="mt-2 font-display text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function ProjectCard({ row, index }: { row: Row; index: number }) {
  const stage = STAGES.find((s) => s.key === row.current_stage_key);
  const stageIdx = STAGES.findIndex((s) => s.key === row.current_stage_key);
  const nextStage = stageIdx >= 0 && stageIdx < STAGES.length - 1 ? STAGES[stageIdx + 1] : null;

  const now = Date.now();
  const startTs = row.start_date ? new Date(row.start_date).getTime() : null;
  const endTs = row.expected_completion ? new Date(row.expected_completion).getTime() : null;
  const daysLeft = endTs ? Math.round((endTs - now) / 86400000) : null;
  const health: "on_track" | "warning" | "late" | "done" =
    row.status === "completed"
      ? "done"
      : daysLeft === null
        ? "on_track"
        : daysLeft < 0
          ? "late"
          : daysLeft < 14
            ? "warning"
            : "on_track";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.35 }}
    >
      <Link
        to="/projects/$id"
        params={{ id: row.id }}
        className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-elevated)]"
      >
        {/* Accent stripe based on health */}
        <div
          className={cn(
            "absolute inset-x-0 top-0 h-1",
            health === "done"
              ? "bg-emerald-500"
              : health === "late"
                ? "bg-destructive"
                : health === "warning"
                  ? "bg-warning"
                  : "bg-primary",
          )}
        />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {row.villa_number && (
                <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {row.villa_number}
                </span>
              )}
              <StatusPill status={row.status} />
            </div>
            <h3 className="mt-2 truncate font-display text-lg font-semibold group-hover:text-primary">
              {row.name}
            </h3>
            {row.address && (
              <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
                <MapPin className="size-3 shrink-0" /> {row.address}
              </p>
            )}
          </div>
          <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
        </div>

        {/* Progress ring + stage */}
        <div className="mt-5 flex items-center gap-4">
          <ProgressRing value={row.overall_progress ?? 0} />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Current stage
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold">
              {stage?.short ?? "Not started"}
            </p>
            {nextStage && (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                Next: {nextStage.short}
              </p>
            )}
          </div>
        </div>

        {/* Mini stage dots */}
        <div className="mt-4 flex gap-1">
          {STAGES.map((_, i) => {
            const active = stageIdx >= 0 && i <= stageIdx;
            return (
              <div
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  active ? "bg-primary" : "bg-muted",
                )}
              />
            );
          })}
        </div>

        {/* Footer meta */}
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5" />
            {startTs ? new Date(startTs).toLocaleDateString(undefined, { month: "short", day: "2-digit" }) : "TBD"}
            {" → "}
            {endTs ? new Date(endTs).toLocaleDateString(undefined, { month: "short", day: "2-digit" }) : "TBD"}
          </span>
          <HealthBadge health={health} daysLeft={daysLeft} />
        </div>
      </Link>
    </motion.div>
  );
}

function ProgressRing({ value }: { value: number }) {
  const size = 56;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, value)) / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-mono text-xs font-bold tabular-nums">
        {value}%
      </span>
    </div>
  );
}

function HealthBadge({
  health,
  daysLeft,
}: {
  health: "on_track" | "warning" | "late" | "done";
  daysLeft: number | null;
}) {
  if (health === "done")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="size-3" /> Done
      </span>
    );
  if (health === "late")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-destructive">
        <AlertTriangle className="size-3" /> {Math.abs(daysLeft ?? 0)}d late
      </span>
    );
  if (health === "warning")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-warning-foreground">
        <Clock3 className="size-3" /> {daysLeft}d left
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-primary">
      <TrendingUp className="size-3" /> {daysLeft !== null ? `${daysLeft}d left` : "On track"}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider",
        statusStyles(status),
      )}
    >
      <span className={cn("size-1.5 rounded-full", statusDot(status))} />
      {status.replace("_", " ")}
    </span>
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

function statusDot(status: string) {
  switch (status) {
    case "active":
      return "bg-primary animate-pulse";
    case "on_hold":
      return "bg-amber-500";
    case "handover":
      return "bg-accent";
    case "completed":
      return "bg-emerald-500";
    default:
      return "bg-muted-foreground";
  }
}
