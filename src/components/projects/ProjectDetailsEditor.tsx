import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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

export interface EditableProject {
  id: string;
  name: string;
  address: string | null;
  villa_number: string | null;
  status: string;
  project_type: string | null;
  area_sqft: number | null;
  start_date: string | null;
  expected_completion: string | null;
  notes: string | null;
}

const STATUSES = ["planning", "active", "on_hold", "handover", "completed"];

export function ProjectDetailsEditor({
  project,
  onSaved,
}: {
  project: EditableProject;
  onSaved: () => void;
}) {
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(project);

  async function save() {
    setBusy(true);
    const { error } = await supabase
      .from("projects")
      .update({
        name: form.name,
        address: form.address,
        villa_number: form.villa_number,
        status: form.status as any,
        project_type: form.project_type,
        area_sqft: form.area_sqft,
        start_date: form.start_date,
        expected_completion: form.expected_completion,
        notes: form.notes,
      })
      .eq("id", project.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Project updated");
    setEdit(false);
    onSaved();
  }

  if (!edit) {
    return (
      <Button size="sm" variant="outline" onClick={() => setEdit(true)}>
        <Pencil className="mr-1.5 size-3.5" /> Edit details
      </Button>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display font-semibold">Edit project</h3>
        <Button size="icon" variant="ghost" onClick={() => setEdit(false)}>
          <X className="size-4" />
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Villa number">
          <Input
            value={form.villa_number ?? ""}
            onChange={(e) => setForm({ ...form, villa_number: e.target.value || null })}
          />
        </Field>
        <Field label="Address" full>
          <Input
            value={form.address ?? ""}
            onChange={(e) => setForm({ ...form, address: e.target.value || null })}
          />
        </Field>
        <Field label="Type">
          <Input
            value={form.project_type ?? ""}
            onChange={(e) => setForm({ ...form, project_type: e.target.value || null })}
          />
        </Field>
        <Field label="Status">
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Area (sqft)">
          <Input
            type="number"
            value={form.area_sqft ?? ""}
            onChange={(e) =>
              setForm({ ...form, area_sqft: e.target.value ? Number(e.target.value) : null })
            }
          />
        </Field>
        <Field label="Start date">
          <Input
            type="date"
            value={form.start_date ?? ""}
            onChange={(e) => setForm({ ...form, start_date: e.target.value || null })}
          />
        </Field>
        <Field label="Expected completion" full>
          <Input
            type="date"
            value={form.expected_completion ?? ""}
            onChange={(e) => setForm({ ...form, expected_completion: e.target.value || null })}
          />
        </Field>
        <Field label="Notes" full>
          <Textarea
            rows={3}
            value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.target.value || null })}
          />
        </Field>
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={save} disabled={busy}>
          <Save className="mr-1.5 size-3.5" /> {busy ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
