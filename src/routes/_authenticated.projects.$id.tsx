import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, MapPin, Calendar, CalendarCheck, Ruler, Activity, Check, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/lib/use-role";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StageManager, type Stage } from "@/components/projects/StageManager";
import { MediaGallery } from "@/components/projects/MediaGallery";
import { DocumentsList } from "@/components/projects/DocumentsList";
import { ProjectChat } from "@/components/projects/ProjectChat";
import {
  ProjectDetailsEditor,
  type EditableProject,
} from "@/components/projects/ProjectDetailsEditor";

import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  component: ProjectDetailPage,
});

interface Project extends EditableProject {
  overall_progress: number;
  current_stage_key: string | null;
}

function ProjectDetailPage() {
  const { id } = Route.useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | undefined>();
  const role = useRole(userId);
  const isAdmin = role === "admin";

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);

  const load = useCallback(async () => {
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from("projects").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("project_stages")
        .select("*")
        .eq("project_id", id)
        .order("stage_order", { ascending: true }),
    ]);
    setProject((p as Project) ?? null);
    setStages((s as Stage[]) ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
        <div className="h-8 w-40 animate-pulse rounded bg-muted/60" />
        <div className="mt-6 h-64 animate-pulse rounded-3xl bg-muted/60" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-8">
        <p className="text-muted-foreground">Project not found.</p>
        <Link to="/projects" className="mt-4 inline-block text-primary hover:underline">
          Back to projects
        </Link>
      </div>
    );
  }

  const completedCount = stages.filter((s) => s.status === "completed").length;
  const totalStages = stages.length;
  const timeElapsed = calcTimeElapsed(project.start_date, project.expected_completion);
  const daysRemaining = calcDaysRemaining(project.expected_completion);
  const statusLabel = statusMeta(project.status);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      <Link
        to="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Projects
      </Link>

      {/* HERO */}
      <section className="relative mt-4 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/5 via-background to-accent/10 p-5 shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 size-64 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {project.villa_number && (
                <span className="rounded-md bg-background/80 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-foreground shadow-sm ring-1 ring-border">
                  {project.villa_number}
                </span>
              )}
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {project.project_type ?? "Residential"}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest",
                  statusLabel.className,
                )}
              >
                <TrendingUp className="size-3" /> {statusLabel.label}
              </span>
            </div>

            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              {project.name}
            </h1>
            {project.address && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-3.5" /> {project.address}
              </p>
            )}

            {/* Stage stepper */}
            <div className="mt-5 -mx-1 overflow-x-auto pb-1">
              <ol className="flex min-w-max items-center gap-1 px-1">
                {stages.map((st, i) => {
                  const done = st.status === "completed";
                  const active = st.status === "in_progress" || st.stage_key === project.current_stage_key;
                  return (
                    <li key={st.id} className="flex items-center">
                      <div
                        title={st.stage_name}
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-full font-mono text-[11px] font-semibold transition-all",
                          done
                            ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                            : active
                              ? "bg-primary/15 text-primary ring-2 ring-primary/40"
                              : "bg-background/70 text-muted-foreground ring-1 ring-border",
                        )}
                      >
                        {done ? <Check className="size-4" /> : i + 1}
                      </div>
                      {i < stages.length - 1 && (
                        <div
                          className={cn(
                            "h-px w-4 sm:w-6",
                            done ? "bg-primary/60" : "bg-border",
                          )}
                        />
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>

            {isAdmin && (
              <div className="mt-5">
                <ProjectDetailsEditor project={project} onSaved={load} />
              </div>
            )}
          </div>

          {/* Time / stages card */}
          <div className="flex items-center gap-5 rounded-2xl border border-border bg-background/80 p-5 shadow-sm backdrop-blur lg:min-w-[260px]">
            <ProgressRing value={timeElapsed} label="Elapsed" />
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Stages
              </div>
              <div className="mt-0.5 font-display text-sm font-semibold">
                {completedCount} / {totalStages} done
              </div>
              <div className="mt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Days remaining
              </div>
              <div className="mt-0.5 font-display text-lg font-semibold tabular-nums">
                {daysRemaining === null ? "—" : `${daysRemaining} days`}
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Meta cards */}
      <section className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <MetaCard icon={Calendar} label="Start date" value={fmt(project.start_date)} />
        <MetaCard icon={CalendarCheck} label="Expected completion" value={fmt(project.expected_completion)} />
        <MetaCard
          icon={Ruler}
          label="Area"
          value={project.area_sqft ? `${project.area_sqft.toLocaleString()} sqft` : "—"}
        />
        <MetaCard
          icon={Activity}
          label="Days remaining"
          value={daysRemaining === null ? "—" : `${daysRemaining}d`}
        />
      </section>

      {/* Tabs */}
      <Tabs defaultValue="timeline" className="mt-8 sm:mt-10">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-semibold sm:text-2xl">
              Construction timeline
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {completedCount} of {totalStages} complete
            </span>
          </div>
          <StageManager
            projectId={project.id}
            stages={stages}
            isAdmin={isAdmin}
            onChanged={load}
          />
        </TabsContent>

        <TabsContent value="media" className="mt-6">
          <MediaGallery projectId={project.id} isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <DocumentsList projectId={project.id} isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="chat" className="mt-6">
          <ProjectChat projectId={project.id} currentUserId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProgressRing({ value }: { value: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <div className="relative grid size-24 shrink-0 place-items-center">
      <svg viewBox="0 0 80 80" className="size-24 -rotate-90">
        <circle cx="40" cy="40" r={r} stroke="currentColor" strokeWidth="7" className="text-muted" fill="none" />
        <circle
          cx="40"
          cy="40"
          r={r}
          stroke="currentColor"
          strokeWidth="7"
          className="text-primary transition-all duration-500"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-display text-xl font-bold tabular-nums text-primary">{value}%</span>
      </div>
    </div>
  );
}

function MetaCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="group rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md sm:p-5">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
      </div>
      <div className="mt-2.5 font-display text-lg font-semibold sm:text-xl">{value}</div>
    </div>
  );
}

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function calcTimeElapsed(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const now = Date.now();
  if (e <= s) return 0;
  return Math.round(Math.min(100, Math.max(0, ((now - s) / (e - s)) * 100)));
}

function calcDaysRemaining(end: string | null): number | null {
  if (!end) return null;
  const diff = new Date(end).getTime() - Date.now();
  return Math.max(0, Math.round(diff / 86400000));
}

function statusMeta(status: string) {
  switch (status) {
    case "active":
      return { label: "On track", className: "bg-primary/10 text-primary" };
    case "on_hold":
      return { label: "On hold", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" };
    case "handover":
      return { label: "Handover", className: "bg-accent/20 text-accent-foreground" };
    case "completed":
      return { label: "Completed", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" };
    default:
      return { label: status.replace("_", " "), className: "bg-muted text-muted-foreground" };
  }
}
