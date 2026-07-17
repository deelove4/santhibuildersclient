import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/lib/use-role";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StageManager, type Stage } from "@/components/projects/StageManager";
import { MediaGallery } from "@/components/projects/MediaGallery";
import { DocumentsList } from "@/components/projects/DocumentsList";
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
          {isAdmin && (
            <div className="mt-3">
              <ProjectDetailsEditor project={project} onSaved={load} />
            </div>
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

      <Tabs defaultValue="timeline" className="mt-12">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-semibold">Construction timeline</h2>
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              12 stages
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
      </Tabs>
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1.5 font-display text-lg font-semibold">{value}</div>
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
