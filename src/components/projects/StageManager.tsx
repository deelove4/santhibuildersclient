import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Clock, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { STAGES } from "@/lib/stages";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
}

interface Props {
  projectId: string;
  stages: Stage[];
  isAdmin: boolean;
  onChanged: () => void;
}

export function StageManager({ projectId, stages, isAdmin, onChanged }: Props) {
  const ordered = STAGES.map(
    (def) =>
      stages.find((s) => s.stage_key === def.key) ?? {
        id: def.key,
        stage_key: def.key,
        stage_name: def.name,
        stage_order: 0,
        status: "pending",
        progress: 0,
        notes: null,
      },
  );

  return (
    <ol className="space-y-2">
      {ordered.map((s, i) => (
        <StageRow
          key={s.stage_key}
          stage={s}
          index={i}
          isAdmin={isAdmin}
          projectId={projectId}
          onChanged={onChanged}
        />
      ))}
    </ol>
  );
}

function StageRow({
  stage,
  index,
  isAdmin,
  projectId,
  onChanged,
}: {
  stage: Stage;
  index: number;
  isAdmin: boolean;
  projectId: string;
  onChanged: () => void;
}) {
  const [edit, setEdit] = useState(false);
  const [status, setStatus] = useState(stage.status);
  const [progress, setProgress] = useState(stage.progress);
  const [notes, setNotes] = useState(stage.notes ?? "");
  const [busy, setBusy] = useState(false);

  const done = status === "completed";
  const active = status === "in_progress";

  async function save() {
    setBusy(true);
    const payload = {
      project_id: projectId,
      stage_key: stage.stage_key,
      stage_name: stage.stage_name,
      stage_order: STAGES.findIndex((x) => x.key === stage.stage_key) + 1,
      status: status as "pending" | "in_progress" | "completed",
      progress: Math.max(0, Math.min(100, progress)),
      notes: notes.trim() || null,
      started_at: status !== "pending" ? new Date().toISOString() : null,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    };
    const { error } = await supabase
      .from("project_stages")
      .upsert(payload, { onConflict: "project_id,stage_key" });
    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }
    // Update project current stage + overall progress
    const { data: all } = await supabase
      .from("project_stages")
      .select("progress, status, stage_order, stage_key")
      .eq("project_id", projectId);
    const rows = all ?? [];
    const overall = rows.length
      ? Math.round(rows.reduce((s, r) => s + (r.progress ?? 0), 0) / STAGES.length)
      : 0;
    const currentStage =
      rows
        .filter((r) => r.status === "in_progress")
        .sort((a, b) => a.stage_order - b.stage_order)[0]?.stage_key ??
      rows
        .filter((r) => r.status !== "completed")
        .sort((a, b) => a.stage_order - b.stage_order)[0]?.stage_key ??
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
      transition={{ delay: index * 0.02, duration: 0.25 }}
      className={cn(
        "rounded-xl border border-border bg-card px-5 py-4 transition-colors",
        active && "border-primary/40 bg-primary/[0.03]",
      )}
    >
      <div className="flex items-center gap-4">
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
          {!edit && stage.notes && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{stage.notes}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", done ? "bg-primary" : "bg-primary/70")}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="w-10 text-right font-mono text-xs tabular-nums text-muted-foreground">
            {progress}%
          </span>
          {isAdmin && (
            <Button size="sm" variant="ghost" onClick={() => setEdit((v) => !v)}>
              {edit ? "Cancel" : "Edit"}
            </Button>
          )}
        </div>
      </div>

      {edit && isAdmin && (
        <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-[160px_120px_1fr_auto]">
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
              Progress
            </label>
            <Input
              type="number"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="mt-1"
            />
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
    </motion.li>
  );
}
