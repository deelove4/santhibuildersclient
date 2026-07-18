import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { STAGES } from "@/lib/stages";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Issue {
  id: string;
  stage_key: string | null;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  raised_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

interface RaiserInfo {
  full_name: string | null;
  email: string | null;
}

const PRIORITY_META: Record<string, { label: string; cls: string }> = {
  critical: { label: "Critical", cls: "bg-red-500/15 text-red-700 dark:text-red-400" },
  high:     { label: "High",     cls: "bg-orange-500/15 text-orange-700 dark:text-orange-400" },
  medium:   { label: "Medium",   cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  low:      { label: "Low",      cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
};

const STATUS_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  open:        { label: "Open",        icon: Circle,       cls: "bg-muted text-muted-foreground" },
  in_progress: { label: "In progress", icon: Clock,        cls: "bg-primary/10 text-primary" },
  resolved:    { label: "Resolved",    icon: CheckCircle2, cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  closed:      { label: "Closed",      icon: XCircle,      cls: "bg-muted text-muted-foreground" },
};

export function IssueTracker({
  projectId,
  isAdmin,
  currentUserId,
}: {
  projectId: string;
  isAdmin: boolean;
  currentUserId: string;
}) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [raisers, setRaisers] = useState<Record<string, RaiserInfo>>({});
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("project_issues")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as Issue[];
    setIssues(rows);

    const ids = Array.from(new Set(rows.map((r) => r.raised_by).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      const map: Record<string, RaiserInfo> = {};
      (profiles ?? []).forEach((p: any) => {
        map[p.id] = { full_name: p.full_name, email: p.email };
      });
      setRaisers(map);
    }
  }, [projectId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`issues:${projectId}:${Math.random().toString(36).slice(2, 10)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_issues",
          filter: `project_id=eq.${projectId}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, load]);

  async function updateStatus(issue: Issue, next: string) {
    const { error } = await supabase
      .from("project_issues")
      .update({
        status: next,
        resolved_at: next === "resolved" ? new Date().toISOString() : null,
      })
      .eq("id", issue.id);
    if (error) return toast.error(error.message);
    toast.success("Issue updated");
    load();
  }

  const shown = issues.filter((i) => {
    if (filterStatus !== "all" && i.status !== filterStatus) return false;
    if (filterPriority !== "all" && i.priority !== filterPriority) return false;
    return true;
  });

  const openCount = issues.filter((i) => i.status === "open" || i.status === "in_progress").length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Snag &amp; Issue Tracker</h2>
          <p className="text-xs text-muted-foreground">
            {openCount > 0
              ? `${openCount} open issue${openCount !== 1 ? "s" : ""} — assign and track to resolution`
              : "All issues resolved. Great work!"}
          </p>
        </div>
        <NewIssueDialog
          projectId={projectId}
          currentUserId={currentUserId}
          onCreated={load}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Status
          </span>
          <div className="flex gap-1">
            {["all", "open", "in_progress", "resolved", "closed"].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest transition-colors",
                  filterStatus === s
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Priority
          </span>
          <div className="flex gap-1">
            {["all", "critical", "high", "medium", "low"].map((p) => (
              <button
                key={p}
                onClick={() => setFilterPriority(p)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest transition-colors",
                  filterPriority === p
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
          <AlertTriangle className="mx-auto size-7 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            {issues.length === 0 ? "No issues raised yet." : "No issues match the current filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map((issue) => {
            const pm = PRIORITY_META[issue.priority] ?? PRIORITY_META.medium;
            const sm = STATUS_META[issue.status] ?? STATUS_META.open;
            const StatusIcon = sm.icon;
            const stage = STAGES.find((s) => s.key === issue.stage_key);
            const raiser = issue.raised_by ? raisers[issue.raised_by] : null;
            return (
              <div
                key={issue.id}
                className={cn(
                  "rounded-xl border border-border bg-card p-4 transition-colors",
                  (issue.status === "open" || issue.status === "in_progress") &&
                    issue.priority === "critical" &&
                    "border-red-500/30 bg-red-500/[0.02]",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest",
                          pm.cls,
                        )}
                      >
                        {pm.label}
                      </span>
                      {stage && (
                        <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                          {stage.short}
                        </span>
                      )}
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest",
                          sm.cls,
                        )}
                      >
                        <StatusIcon className="size-3" />
                        {sm.label}
                      </span>
                    </div>
                    <p className="mt-1.5 font-display font-semibold">{issue.title}</p>
                    {issue.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{issue.description}</p>
                    )}
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      Raised by{" "}
                      <span className="font-medium">
                        {raiser?.full_name || raiser?.email || "Team"}
                      </span>{" "}
                      · {new Date(issue.created_at).toLocaleDateString()}
                      {issue.resolved_at && (
                        <>
                          {" · Resolved "}
                          {new Date(issue.resolved_at).toLocaleDateString()}
                        </>
                      )}
                    </p>
                  </div>
                  {isAdmin && issue.status !== "resolved" && issue.status !== "closed" && (
                    <div className="flex flex-wrap gap-1.5">
                      {issue.status === "open" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(issue, "in_progress")}
                        >
                          <Clock className="mr-1.5 size-3.5" /> Start
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(issue, "resolved")}
                      >
                        <CheckCircle2 className="mr-1.5 size-3.5" /> Resolve
                      </Button>
                    </div>
                  )}
                  {isAdmin && (issue.status === "resolved" || issue.status === "closed") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateStatus(issue, "closed")}
                    >
                      <XCircle className="mr-1.5 size-3.5" /> Close
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewIssueDialog({
  projectId,
  currentUserId,
  onCreated,
}: {
  projectId: string;
  currentUserId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [stageKey, setStageKey] = useState("none");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast.error("Title is required");
    setBusy(true);
    const { error } = await supabase.from("project_issues").insert({
      project_id: projectId,
      stage_key: stageKey === "none" ? null : stageKey,
      title: title.trim(),
      description: description.trim() || null,
      priority,
      status: "open",
      raised_by: currentUserId,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Issue raised");
    setOpen(false);
    setTitle("");
    setDescription("");
    setPriority("medium");
    setStageKey("none");
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" /> Raise issue
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Raise a new issue</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Describe the issue briefly"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Additional detail, dimensions, location…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Related stage</Label>
              <Select value={stageKey} onValueChange={setStageKey}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {STAGES.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.short}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Raise issue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
