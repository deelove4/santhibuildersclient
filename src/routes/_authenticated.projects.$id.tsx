import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  CalendarCheck,
  Ruler,
  Activity,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/lib/use-role";
import { STAGES } from "@/lib/stages";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StageManager, type Stage } from "@/components/projects/StageManager";
import { MediaGallery } from "@/components/projects/MediaGallery";
import { DocumentsList } from "@/components/projects/DocumentsList";
import { ChatBox } from "@/components/projects/ChatBox";
import {
  ProjectDetailsEditor,
  type EditableProject,
} from "@/components/projects/ProjectDetailsEditor";

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

  useEffect(() => {
    const channel = supabase
      .channel(`project:${id}:${Math.random().toString(36).slice(2, 10)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "projects", filter: `id=eq.${id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_stages", filter: `project_id=eq.${id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_media", filter: `project_id=eq.${id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_documents", filter: `project_id=eq.${id}` }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, load]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
        <div className="h-8 w-40 animate-pulse rounded bg-muted/60" />
        <div className="mt-6 h-64 animate-pulse rounded-2xl bg-muted/60" />
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

  const now = Date.now();
  const startTs = project.start_date ? new Date(project.start_date).getTime() : null;
  const endTs = project.expected_completion ? new Date(project.expected_completion).getTime() : null;
  const daysLeft = endTs ? Math.round((endTs - now) / 86400000) : null;
  const totalDays = startTs && endTs ? Math.max(1, Math.round((endTs - startTs) / 86400000)) : null;
  const elapsedDays = startTs ? Math.max(0, Math.round((now - startTs) / 86400000)) : null;
  const timeProgress =
    totalDays && elapsedDays !== null ? Math.min(100, Math.round((elapsedDays / totalDays) * 100)) : null;
  const completedStages = stages.filter((s) => s.status === "completed").length;
  const currentIdx = STAGES.findIndex((s) => s.key === project.current_stage_key);

  const health: "on_track" | "warning" | "late" | "done" =
    project.status === "completed"
      ? "done"
      : daysLeft === null
        ? "on_track"
        : daysLeft < 0
          ? "late"
          : daysLeft < 14
            ? "warning"
            : "on_track";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      <Link
        to="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Projects
      </Link>

      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative mt-4 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-accent/10 p-6 sm:p-8"
      >
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-72 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {project.villa_number && (
                <span className="rounded-md bg-card px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {project.villa_number}
                </span>
              )}
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                {project.project_type ?? "Residential"}
              </span>
              <HealthPill health={health} daysLeft={daysLeft} />
            </div>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {project.name}
            </h1>
            {project.address && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-3.5" /> {project.address}
              </p>
            )}
            {isAdmin && (
              <div className="mt-4">
                <ProjectDetailsEditor project={project} onSaved={load} />
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card/80 px-5 py-4 backdrop-blur-sm">
            <BigProgressRing value={project.overall_progress ?? 0} />
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Overall
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {completedStages} / {STAGES.length} stages done
              </div>
              {timeProgress !== null && (
                <div className="mt-2">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Time elapsed
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <div className="h-1 w-20 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${timeProgress}%` }}
                      />
                    </div>
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                      {timeProgress}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="relative mt-6 overflow-x-auto">
          <div className="flex min-w-max items-center gap-1">
            {STAGES.map((s, i) => {
              const stageRow = stages.find((x) => x.stage_key === s.key);
              const isDone = stageRow?.status === "completed";
              const isActive = i === currentIdx;
              return (
                <div key={s.key} className="flex items-center gap-1">
                  <div
                    title={s.name}
                    className={cn(
                      "grid size-7 place-items-center rounded-full border font-mono text-[10px] font-semibold transition-all",
                      isDone
                        ? "border-primary bg-primary text-primary-foreground"
                        : isActive
                          ? "border-primary bg-primary/15 text-primary ring-2 ring-primary/20"
                          : "border-border bg-card text-muted-foreground",
                    )}
                  >
                    {isDone ? <CheckCircle2 className="size-3.5" /> : i + 1}
                  </div>
                  {i < STAGES.length - 1 && (
                    <div
                      className={cn("h-0.5 w-6 rounded-full", isDone ? "bg-primary" : "bg-border")}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </motion.header>

      <section className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2 lg:grid-cols-4">
        <MetaCard icon={Calendar} label="Start date" value={fmt(project.start_date)} />
        <MetaCard
          icon={CalendarCheck}
          label="Expected completion"
          value={fmt(project.expected_completion)}
        />
        <MetaCard
          icon={Ruler}
          label="Area"
          value={project.area_sqft ? `${project.area_sqft.toLocaleString()} sqft` : "—"}
        />
        <MetaCard
          icon={Activity}
          label="Days remaining"
          value={
            daysLeft === null ? "—" : daysLeft < 0 ? `${Math.abs(daysLeft)}d late` : `${daysLeft}d`
          }
          tone={daysLeft !== null && daysLeft < 0 ? "destructive" : "default"}
        />
      </section>

      <Tabs defaultValue="timeline" className="mt-8 sm:mt-12">
        <TabsList className="w-full flex-wrap justify-start gap-1 sm:w-auto">
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-semibold">Construction timeline</h2>
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              {completedStages} of {STAGES.length} complete
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
          {userId ? (
            <ChatBox projectId={project.id} currentUserId={userId} />
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Loading chat…
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetaCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "default" | "destructive";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/30">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "grid size-8 place-items-center rounded-lg",
            tone === "destructive"
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary",
          )}
        >
          <Icon className="size-4" />
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
      </div>
      <div className="mt-2 font-display text-lg font-semibold">{value}</div>
    </div>
  );
}

function BigProgressRing({ value }: { value: number }) {
  const size = 72;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, value)) / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
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
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-lg font-bold tabular-nums">
        {value}%
      </span>
    </div>
  );
}

function HealthPill({
  health,
  daysLeft,
}: {
  health: "on_track" | "warning" | "late" | "done";
  daysLeft: number | null;
}) {
  if (health === "done")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="size-3" /> Completed
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
      <TrendingUp className="size-3" /> On track
    </span>
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
