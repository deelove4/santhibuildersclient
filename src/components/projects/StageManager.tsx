import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Clock, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface Stage {
  id: string;
  stage_key: string;
  stage_name: string;
  stage_order: number;
  status: string;
  progress: number;
  notes: string | null;
  phase_name?: string | null;
  phase_order?: number | null;
}

interface Props {
  projectId: string;
  stages: Stage[];
  isAdmin: boolean;
  onChanged: () => void;
}

export function StageManager({ projectId, stages, isAdmin, onChanged }: Props) {
  const phases = useMemo(() => {
    const map = new Map<string, { name: string; order: number; items: Stage[] }>();
    for (const s of stages) {
      const pname = s.phase_name || "Timeline";
      const porder = s.phase_order ?? 1;
      const key = `${porder}::${pname}`;
      if (!map.has(key)) map.set(key, { name: pname, order: porder, items: [] });
      map.get(key)!.items.push(s);
    }
    return Array.from(map.values()).sort((a, b) => a.order - b.order);
  }, [stages]);

  let counter = 0;
  return (
    <div className="space-y-6">
      {phases.map((ph) => (
        <div key={`${ph.order}-${ph.name}`}>
          <div className="mb-3 flex items-baseline gap-2">
            <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-primary">
              Phase {ph.order}
            </span>
            <h3 className="font-display text-lg font-semibold">{ph.name}</h3>
            <span className="font-mono text-[10px] text-muted-foreground">
              {ph.items.filter((s) => s.status === "completed").length} / {ph.items.length} done
            </span>
          </div>
          <ol className="space-y-2">
            {ph.items.map((s) => {
              const idx = counter++;
              return (
                <StageRow
                  key={s.id}
                  stage={s}
                  index={idx}
                  isAdmin={isAdmin}
                  projectId={projectId}
                  totalStages={stages.length}
                  onChanged={onChanged}
                />
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}

function StageRow({
  stage,
  index,
  isAdmin,
  projectId,
  totalStages,
  onChanged,
}: {
  stage: Stage;
  index: number;
  isAdmin: boolean;
  projectId: string;
  totalStages: number;
  onChanged: () => void;
}) {
  const [edit, setEdit] = useState(false);
  const [status, setStatus] = useState(stage.status);
  const [notes, setNotes] = useState(stage.notes ?? "");
  const [busy, setBusy] = useState(false);

  const done = status === "completed";
  const active = status === "in_progress";

  async function save() {
    setBusy(true);
    const progress = status === "completed" ? 100 : status === "in_progress" ? 50 : 0;
    const { error } = await supabase
      .from("project_stages")
      .update({
        status: status as "pending" | "in_progress" | "completed",
        progress,
        notes: notes.trim() || null,
        started_at: status !== "pending" ? new Date().toISOString() : null,
        completed_at: status === "completed" ? new Date().toISOString() : null,
      })
      .eq("id", stage.id);
    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }
    // Recalc overall progress + current stage
    const { data: all } = await supabase
      .from("project_stages")
      .select("progress, status, stage_order, stage_key")
      .eq("project_id", projectId)
      .order("stage_order");
    const rows = all ?? [];
    const overall = rows.length
      ? Math.round(rows.reduce((s, r) => s + (r.progress ?? 0), 0) / rows.length)
      : 0;
    const currentStage =
      rows.find((r) => r.status === "in_progress")?.stage_key ??
      rows.find((r) => r.status !== "completed")?.stage_key ??
      stage.stage_key;
    await supabase
      .from("projects")
      .update({ overall_progress: overall, current_stage_key: currentStage })
      .eq("id", projectId);
    toast.success("Stage updated");
    setBusy(false);
    setEdit(false);
    onChanged();
  }

  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index, 20) * 0.02, duration: 0.25 }}
      className={cn(
        "rounded-xl border border-border bg-card px-4 py-3 transition-colors sm:px-5 sm:py-4",
        active && "border-primary/40 bg-primary/[0.03]",
      )}
    >
      <div className="flex items-center gap-3 sm:gap-4">
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display font-semibold">{stage.stage_name}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest",
                done
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : active
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {done ? "Completed" : active ? "In progress" : "Pending"}
            </span>
          </div>
          {!edit && stage.notes && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{stage.notes}</p>
          )}
        </div>
        {isAdmin && (
          <Button size="sm" variant="ghost" onClick={() => setEdit((v) => !v)}>
            {edit ? "Cancel" : "Edit"}
          </Button>
        )}
      </div>

      {edit && isAdmin && (
        <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-[180px_1fr_auto]">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Status
            </label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Notes
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={save} disabled={busy} size="sm">
              <Save className="mr-1.5 size-3.5" /> {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}
      <span className="sr-only">{totalStages}</span>
    </motion.li>
  );
}
