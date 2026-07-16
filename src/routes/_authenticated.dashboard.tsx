import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Clock,
  TrendingUp,
  Users,
  ArrowUpRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { STAGES } from "@/lib/stages";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

interface ProjectRow {
  id: string;
  name: string;
  location: string | null;
  status: string;
  overall_progress: number | null;
  current_stage: string | null;
  updated_at: string;
}

function DashboardPage() {
  const { user } = Route.useRouteContext() as { user: { id: string; email?: string } };
  const [role, setRole] = useState<"admin" | "client" | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: roles }, { data: proj }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase
          .from("projects")
          .select("id, name, location, status, overall_progress, current_stage, updated_at")
          .order("updated_at", { ascending: false })
          .limit(12),
      ]);
      if (cancelled) return;
      const rs = (roles ?? []).map((r) => r.role);
      setRole(rs.includes("admin") ? "admin" : "client");
      setProjects((proj ?? []) as ProjectRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const total = projects.length;
  const active = projects.filter((p) => p.status === "active").length;
  const avgProgress = total
    ? Math.round(projects.reduce((s, p) => s + (p.overall_progress ?? 0), 0) / total)
    : 0;
  const handovers = projects.filter((p) => p.status === "handover" || p.status === "completed").length;

  const kpis = [
    { label: role === "admin" ? "Projects" : "Your projects", value: total, icon: Building2 },
    { label: "Active", value: active, icon: TrendingUp },
    { label: "Avg. progress", value: `${avgProgress}%`, icon: Clock },
    { label: "Nearing handover", value: handovers, icon: Users },
  ];

  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            {role === "admin" ? "Admin overview" : "Your workspace"}
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
            {role === "admin" ? "Portfolio dashboard" : "Project dashboard"}
          </h1>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.35 }}
            className="rounded-2xl border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{k.label}</span>
              <k.icon className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-3 font-display text-3xl font-bold tracking-tight">{k.value}</div>
          </motion.div>
        ))}
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Recent projects</h2>
          <Link
            to="/projects"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View all <ArrowUpRight className="size-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted/60" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <EmptyProjects role={role} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {projects.slice(0, 6).map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectRow }) {
  const stage = STAGES.find((s) => s.key === project.current_stage);
  return (
    <Link
      to="/projects/$id"
      params={{ id: project.id }}
      className="group rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-[var(--shadow-soft)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate font-display text-base font-semibold">{project.name}</h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {project.location ?? "Location TBD"}
          </p>
        </div>
        <StatusBadge status={project.status} />
      </div>
      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {stage ? stage.name : "Awaiting kickoff"}
          </span>
          <span className="font-mono font-medium tabular-nums">
            {project.overall_progress ?? 0}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${project.overall_progress ?? 0}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    planning: "bg-muted text-muted-foreground",
    active: "bg-primary/10 text-primary",
    on_hold: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    handover: "bg-accent/15 text-accent-foreground",
    completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  };
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest",
        map[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function EmptyProjects({ role }: { role: "admin" | "client" | null }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
      <Building2 className="mx-auto size-8 text-muted-foreground" />
      <h3 className="mt-3 font-display text-lg font-semibold">No projects yet</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        {role === "admin"
          ? "Create your first project and assign a client to get started."
          : "Your project will appear here as soon as your Santhi Builders team sets it up."}
      </p>
    </div>
  );
}
