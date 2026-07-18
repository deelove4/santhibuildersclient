import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { IndianRupee, Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { STAGES } from "@/lib/stages";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface BudgetRow {
  id: string;
  stage_key: string | null;
  category: string;
  description: string;
  budgeted_amount: number;
  actual_amount: number;
  notes: string | null;
}

const CATEGORIES = ["materials", "labour", "equipment", "overhead"];

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function BudgetTracker({
  projectId,
  isAdmin,
}: {
  projectId: string;
  isAdmin: boolean;
}) {
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<BudgetRow>>({});

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("project_budget")
      .select("*")
      .eq("project_id", projectId)
      .order("stage_key", { ascending: true });
    setRows((data ?? []) as BudgetRow[]);
  }, [projectId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`budget:${projectId}:${Math.random().toString(36).slice(2, 10)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_budget",
          filter: `project_id=eq.${projectId}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, load]);

  async function saveEdit(id: string) {
    const { error } = await supabase
      .from("project_budget")
      .update({
        description: editForm.description,
        stage_key: editForm.stage_key || null,
        category: editForm.category,
        budgeted_amount: Number(editForm.budgeted_amount ?? 0),
        actual_amount: Number(editForm.actual_amount ?? 0),
        notes: editForm.notes || null,
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    setEditId(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this budget line?")) return;
    await supabase.from("project_budget").delete().eq("id", id);
    load();
  }

  const totalBudget = rows.reduce((s, r) => s + r.budgeted_amount, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual_amount, 0);
  const totalVariance = totalBudget - totalActual;
  const spentPct = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;

  // Group by stage
  const stageOrder = STAGES.map((s) => s.key);
  const grouped = stageOrder.map((key) => {
    const stageRows = rows.filter((r) => r.stage_key === key);
    const ungrouped = rows.filter((r) => !r.stage_key);
    return { key, rows: key === stageOrder[0] ? [...stageRows] : stageRows };
  });
  const noStageRows = rows.filter((r) => !r.stage_key);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Budget Tracker</h2>
          <p className="text-xs text-muted-foreground">
            Budgeted vs actual spend per stage and category.
          </p>
        </div>
        {isAdmin && (
          <NewBudgetLineDialog projectId={projectId} onCreated={load} />
        )}
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Total budget" value={fmt(totalBudget)} />
        <SummaryCard label="Actual spend" value={fmt(totalActual)} />
        <SummaryCard
          label="Variance"
          value={fmt(Math.abs(totalVariance))}
          tone={totalVariance < 0 ? "over" : totalVariance === 0 ? "neutral" : "under"}
          suffix={totalVariance < 0 ? "over budget" : totalVariance > 0 ? "under budget" : "on budget"}
        />
      </div>

      {/* Progress bar */}
      {totalBudget > 0 && (
        <div className="mb-6 rounded-xl border border-border bg-card p-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Budget utilisation</span>
            <span
              className={cn(
                "font-mono font-semibold tabular-nums",
                spentPct > 100 ? "text-destructive" : "text-foreground",
              )}
            >
              {spentPct}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                spentPct > 100 ? "bg-destructive" : spentPct > 85 ? "bg-amber-500" : "bg-primary",
              )}
              style={{ width: `${Math.min(spentPct, 100)}%` }}
            />
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
          <IndianRupee className="mx-auto size-7 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No budget entries yet.</p>
          {isAdmin && (
            <p className="mt-1 text-xs text-muted-foreground">
              Click "Add line item" to start tracking.
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Stage / Item</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Budgeted</th>
                <th className="px-4 py-3 text-right">Actual</th>
                <th className="px-4 py-3 text-right">Variance</th>
                {isAdmin && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {STAGES.map((stageDef) => {
                const stageRows = rows.filter((r) => r.stage_key === stageDef.key);
                if (!stageRows.length) return null;
                const stageBudget = stageRows.reduce((s, r) => s + r.budgeted_amount, 0);
                const stageActual = stageRows.reduce((s, r) => s + r.actual_amount, 0);
                const stageVariance = stageBudget - stageActual;
                return (
                  <>
                    {/* Stage sub-header */}
                    <tr key={`hdr-${stageDef.key}`} className="border-b border-border bg-muted/20">
                      <td colSpan={isAdmin ? 6 : 5} className="px-4 py-2">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                          {stageDef.name}
                        </span>
                        <span className="ml-3 font-mono text-[10px] tabular-nums text-muted-foreground">
                          {fmt(stageBudget)} budgeted ·{" "}
                          <span className={stageVariance < 0 ? "text-destructive" : "text-emerald-600"}>
                            {stageVariance < 0 ? "−" : "+"}{fmt(Math.abs(stageVariance))}
                          </span>
                        </span>
                      </td>
                    </tr>
                    {stageRows.map((r) => (
                      <BudgetLineRow
                        key={r.id}
                        row={r}
                        isAdmin={isAdmin}
                        editId={editId}
                        editForm={editForm}
                        setEditId={setEditId}
                        setEditForm={setEditForm}
                        onSave={saveEdit}
                        onRemove={remove}
                      />
                    ))}
                  </>
                );
              })}
              {/* Rows without a stage */}
              {noStageRows.map((r) => (
                <BudgetLineRow
                  key={r.id}
                  row={r}
                  isAdmin={isAdmin}
                  editId={editId}
                  editForm={editForm}
                  setEditId={setEditId}
                  setEditForm={setEditForm}
                  onSave={saveEdit}
                  onRemove={remove}
                />
              ))}
              {/* Totals row */}
              <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                <td className="px-4 py-3 font-display" colSpan={2}>
                  Total
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{fmt(totalBudget)}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{fmt(totalActual)}</td>
                <td
                  className={cn(
                    "px-4 py-3 text-right font-mono tabular-nums",
                    totalVariance < 0 ? "text-destructive" : "text-emerald-600",
                  )}
                >
                  {totalVariance < 0 ? "−" : "+"}{fmt(Math.abs(totalVariance))}
                </td>
                {isAdmin && <td />}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BudgetLineRow({
  row,
  isAdmin,
  editId,
  editForm,
  setEditId,
  setEditForm,
  onSave,
  onRemove,
}: {
  row: BudgetRow;
  isAdmin: boolean;
  editId: string | null;
  editForm: Partial<BudgetRow>;
  setEditId: (id: string | null) => void;
  setEditForm: (f: Partial<BudgetRow>) => void;
  onSave: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const variance = row.budgeted_amount - row.actual_amount;
  const isEditing = editId === row.id;

  if (isEditing) {
    return (
      <tr key={row.id} className="border-b border-border bg-primary/[0.02]">
        <td className="px-4 py-2" colSpan={isAdmin ? 6 : 5}>
          <div className="grid gap-2 sm:grid-cols-[1fr_120px_120px_120px_auto]">
            <Input
              value={editForm.description ?? ""}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              placeholder="Description"
            />
            <Input
              type="number"
              value={editForm.budgeted_amount ?? 0}
              onChange={(e) => setEditForm({ ...editForm, budgeted_amount: Number(e.target.value) })}
              placeholder="Budgeted"
            />
            <Input
              type="number"
              value={editForm.actual_amount ?? 0}
              onChange={(e) => setEditForm({ ...editForm, actual_amount: Number(e.target.value) })}
              placeholder="Actual"
            />
            <Select
              value={editForm.category ?? "materials"}
              onValueChange={(v) => setEditForm({ ...editForm, category: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c} className="capitalize">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-1">
              <Button size="sm" onClick={() => onSave(row.id)}>
                <Save className="size-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                <X className="size-3.5" />
              </Button>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-muted/20">
      <td className="px-4 py-3">{row.description}</td>
      <td className="px-4 py-3 capitalize text-muted-foreground">{row.category}</td>
      <td className="px-4 py-3 text-right font-mono tabular-nums">{fmt(row.budgeted_amount)}</td>
      <td className="px-4 py-3 text-right font-mono tabular-nums">{fmt(row.actual_amount)}</td>
      <td
        className={cn(
          "px-4 py-3 text-right font-mono tabular-nums",
          variance < 0 ? "text-destructive" : variance > 0 ? "text-emerald-600" : "text-muted-foreground",
        )}
      >
        {row.actual_amount === 0
          ? "—"
          : `${variance < 0 ? "−" : "+"}${fmt(Math.abs(variance))}`}
      </td>
      {isAdmin && (
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditId(row.id);
                setEditForm({ ...row });
              }}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onRemove(row.id)}>
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          </div>
        </td>
      )}
    </tr>
  );
}

function SummaryCard({
  label,
  value,
  tone = "neutral",
  suffix,
}: {
  label: string;
  value: string;
  tone?: "over" | "under" | "neutral";
  suffix?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-2 font-display text-2xl font-bold tabular-nums",
          tone === "over" && "text-destructive",
          tone === "under" && "text-emerald-600",
        )}
      >
        {value}
      </div>
      {suffix && (
        <div
          className={cn(
            "mt-0.5 font-mono text-[10px] uppercase tracking-widest",
            tone === "over" && "text-destructive",
            tone === "under" && "text-emerald-600",
            tone === "neutral" && "text-muted-foreground",
          )}
        >
          {suffix}
        </div>
      )}
    </div>
  );
}

function NewBudgetLineDialog({
  projectId,
  onCreated,
}: {
  projectId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [stageKey, setStageKey] = useState("none");
  const [category, setCategory] = useState("materials");
  const [budgeted, setBudgeted] = useState("");
  const [actual, setActual] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return toast.error("Description is required");
    setBusy(true);
    const { error } = await supabase.from("project_budget").insert({
      project_id: projectId,
      stage_key: stageKey === "none" ? null : stageKey,
      category,
      description: description.trim(),
      budgeted_amount: Number(budgeted) || 0,
      actual_amount: Number(actual) || 0,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Line item added");
    setOpen(false);
    setDescription("");
    setStageKey("none");
    setCategory("materials");
    setBudgeted("");
    setActual("");
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" /> Add line item
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add budget line item</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. TMT steel reinforcement bars"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Stage</Label>
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
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Budgeted amount (₹)</Label>
              <Input
                type="number"
                min={0}
                value={budgeted}
                onChange={(e) => setBudgeted(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Actual amount (₹)</Label>
              <Input
                type="number"
                min={0}
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? "Adding…" : "Add line item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
