import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Circle, Clock, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { STAGES } from "@/lib/stages";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  component: ProjectDetailPage,
});

interface Project {
  id: string;
  name: string;
  address: string | null;
  villa_number: string | null;
  status: string;
  overall_progress: number;
  current_stage_key: string | null;
  project_type: string | null;
  area_sqft: number | null;
  start_date: string | null;
  expected_completion: string | null;
  notes: string | null;
}

interface Stage {
  id: string;
  stage_key: string;
  stage_name: string;
  stage_order: number;
  status: string;
  progress: number;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
}

function ProjectDetailPage() {
  const { id } = Route.useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from("projects").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("project_stages")
          .select("*")
          .eq("project_id", id)
          .order("stage_order", { ascending: true }),
      ]);
      if (cancelled) return;
      setProject((p as Project) ?? null);
      setStages((s as Stage[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-8 py-10">
        <div className="h-8 w-40 animate-pulse rounded bg-muted/60" />
        <div className="mt-6 h-64 animate-pulse rounded-2xl bg-muted/60" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-6xl px-8 py-16 text-center">
        <p className="text-muted-foreground">Project not found.</p>
        <Link to="/projects" className="mt-4 inline-block text-primary hover:underline">
          Back to projects
        </Link>
      </div>
    );
  }

  const orderedStages = STAGES.map(
    (def) =>
      stages.find((s) => s.stage_key === def.key) ?? {
        id: def.key,
        stage_key: def.key,
        stage_name: def.name,
        stage_order: 0,
        status: "pending",
        progress: 0,
        started_at: null,
        completed_at: null,
        notes: null,
      },
  );

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <Link
        to="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Projects
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            {project.villa_number ?? "Villa"} · {project.project_type ?? "Residential"}
          </p>
          <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">{project.name}</h1>
          {project.address && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-3.5" /> {project.address}
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-card px-6 py-4 text-right">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Overall progress
          </div>
          <div className="mt-1 font-display text-4xl font-bold text-primary tabular-nums">
            {project.overall_progress}%
          </div>
        </div>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <MetaCard label="Start date" value={fmt(project.start_date)} />
        <MetaCard label="Expected completion" value={fmt(project.expected_completion)} />
        <MetaCard
          label="Area"
          value={project.area_sqft ? `${project.area_sqft.toLocaleString()} sqft` : "—"}
        />
      </section>

      <section className="mt-12">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="font-display text-xl font-semibold">Construction timeline</h2>
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            12 stages
          </span>
        </div>

        <ol className="space-y-2">
          {orderedStages.map((stage, i) => (
            <StageRow key={stage.stage_key} stage={stage} index={i} />
          ))}
        </ol>
      </section>
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1.5 font-display text-lg font-semibold">{value}</div>
    </div>
  );
}

function StageRow({ stage, index }: { stage: Stage; index: number }) {
  const done = stage.status === "completed";
  const active = stage.status === "in_progress";
  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      className={cn(
        "flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-colors",
        active && "border-primary/40 bg-primary/[0.03]",
      )}
    >
      <div
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full font-mono text-xs font-semibold",
          done
            ? "bg-primary text-primary-foreground"
            : active
              ? "bg-primary/15 text-primary ring-2 ring-primary/30"
              : "bg-muted text-muted-foreground",
        )}
      >
        {done ? <Check className="size-4" /> : active ? <Clock className="size-4" /> : index + 1}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-display font-semibold">{stage.stage_name}</span>
          {active && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary">
              In progress
            </span>
          )}
        </div>
        {stage.notes && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{stage.notes}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full", done ? "bg-primary" : "bg-primary/70")}
            style={{ width: `${stage.progress}%` }}
          />
        </div>
        <span className="w-10 text-right font-mono text-xs tabular-nums text-muted-foreground">
          {stage.progress}%
        </span>
      </div>
    </motion.li>
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
