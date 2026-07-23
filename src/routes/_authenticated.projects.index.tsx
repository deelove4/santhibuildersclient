import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { STAGES } from "@/lib/stages";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  updated_at: string;
}

function ProjectsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [userId, setUserId] = useState<string | undefined>();
  const role = useRole(userId);
  const isAdmin = role === "admin";

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);

  function load() {
    supabase
      .from("projects")
      .select("id, name, address, status, overall_progress, current_stage_key, villa_number, updated_at")
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        setRows((data ?? []) as Row[]);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: string, name: string) {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Deleted "${name}"`);
    load();
  }

  const filtered = rows.filter(
    (r) =>
      !q ||
      r.name.toLowerCase().includes(q.toLowerCase()) ||
      (r.address ?? "").toLowerCase().includes(q.toLowerCase()) ||
      (r.villa_number ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Portfolio</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">Projects</h1>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-64 sm:flex-initial">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects…" className="pl-9" />
          </div>
          {isAdmin && <NewProjectDialog onCreated={load} />}
        </div>
      </header>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/60" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center sm:p-16">
          <Building2 className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No projects found.</p>
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="grid gap-3 sm:hidden">
            {filtered.map((r) => {
              const stage = STAGES.find((s) => s.key === r.current_stage_key);
              return (
                <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link to="/projects/$id" params={{ id: r.id }} className="min-w-0 flex-1">
                      <div className="font-display font-semibold">{r.name}</div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {r.villa_number ? `${r.villa_number} · ` : ""}{r.address ?? "—"}
                      </div>
                    </Link>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest", statusStyles(r.status))}>
                      {r.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="truncate text-xs text-muted-foreground">{stage?.name ?? "—"}</span>
                    {isAdmin && <DeleteBtn onConfirm={() => handleDelete(r.id, r.name)} label={r.name} kind="project" />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3">Project</th>
                    <th className="px-5 py-3">Stage</th>
                    <th className="px-5 py-3">Status</th>
                    {isAdmin && <th className="px-5 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const stage = STAGES.find((s) => s.key === r.current_stage_key);
                    return (
                      <tr key={r.id} className="group border-b border-border last:border-b-0 transition-colors hover:bg-muted/30">
                        <td className="px-5 py-4">
                          <Link to="/projects/$id" params={{ id: r.id }} className="block">
                            <div className="font-display font-semibold group-hover:text-primary">{r.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {r.villa_number ? `${r.villa_number} · ` : ""}{r.address ?? "—"}
                            </div>
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">{stage?.name ?? "—"}</td>
                        <td className="px-5 py-4">
                          <span className={cn("rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest", statusStyles(r.status))}>
                            {r.status.replace("_", " ")}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="px-5 py-4 text-right">
                            <DeleteBtn onConfirm={() => handleDelete(r.id, r.name)} label={r.name} kind="project" />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function DeleteBtn({ onConfirm, label, kind }: { onConfirm: () => void | Promise<void>; label: string; kind: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" aria-label={`Delete ${kind}`}>
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {kind}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove <span className="font-semibold text-foreground">{label}</span>. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => void onConfirm()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
