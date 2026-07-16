import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { STAGES } from "@/lib/stages";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects")({
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

  useEffect(() => {
    supabase
      .from("projects")
      .select("id, name, address, status, overall_progress, current_stage_key, villa_number, updated_at")
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        setRows((data ?? []) as Row[]);
        setLoading(false);
      });
  }, []);

  const filtered = rows.filter(
    (r) =>
      !q ||
      r.name.toLowerCase().includes(q.toLowerCase()) ||
      (r.address ?? "").toLowerCase().includes(q.toLowerCase()) ||
      (r.villa_number ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Portfolio
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Projects</h1>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search projects…"
            className="pl-9"
          />
        </div>
      </header>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/60" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-16 text-center">
          <Building2 className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No projects found.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
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
                      <Link
                        to="/projects/$id"
                        params={{ id: r.id }}
                        className="block"
                      >
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
