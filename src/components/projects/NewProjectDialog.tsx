import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, GripVertical, ArrowUp, ArrowDown } from "lucide-react";

interface Client {
  id: string;
  full_name: string | null;
  email: string;
}

interface TemplateItem {
  phase_name: string;
  phase_order: number;
  stage_name: string;
  stage_key: string;
  stage_order: number;
}

interface Template {
  id: string;
  name: string;
  category: string;
}

type Category = "residential" | "commercial" | "renovation" | "other";

const CATEGORY_LABELS: Record<Category, string> = {
  residential: "Residential Construction",
  commercial: "Commercial",
  renovation: "Renovation",
  other: "Other / Custom",
};

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || `stage_${Date.now()}`
  );
}

export function NewProjectDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [category, setCategory] = useState<Category>("residential");
  const [templateId, setTemplateId] = useState<string>("");
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");

  const [name, setName] = useState("");
  const [villa, setVilla] = useState("");
  const [address, setAddress] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [area, setArea] = useState("");
  const [startDate, setStartDate] = useState("");
  const [expected, setExpected] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  // Load clients + templates when opened
  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: roles }, { data: tpls }] = await Promise.all([
        supabase.from("user_roles").select("user_id").eq("role", "client"),
        supabase.from("stage_templates").select("id, name, category").order("name"),
      ]);
      const ids = (roles ?? []).map((r) => r.user_id);
      if (ids.length) {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", ids)
          .order("full_name");
        setClients((data ?? []) as Client[]);
      } else {
        setClients([]);
      }
      setTemplates((tpls ?? []) as Template[]);
    })();
  }, [open]);

  // Pick default template when category changes
  useEffect(() => {
    if (!templates.length) return;
    const first = templates.find((t) => t.category === category);
    if (first) setTemplateId(first.id);
  }, [category, templates]);

  // Load template items when selection changes
  useEffect(() => {
    if (!templateId) {
      setItems([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("stage_template_items")
        .select("phase_name, phase_order, stage_name, stage_key, stage_order")
        .eq("template_id", templateId)
        .order("stage_order");
      setItems((data ?? []) as TemplateItem[]);
    })();
  }, [templateId]);

  const templatesForCategory = useMemo(
    () => templates.filter((t) => t.category === category),
    [templates, category],
  );

  // Group items by phase preserving order
  const phases = useMemo(() => {
    const map = new Map<string, { phase_name: string; phase_order: number; items: TemplateItem[] }>();
    for (const it of items) {
      const key = `${it.phase_order}::${it.phase_name}`;
      if (!map.has(key)) map.set(key, { phase_name: it.phase_name, phase_order: it.phase_order, items: [] });
      map.get(key)!.items.push(it);
    }
    return Array.from(map.values()).sort((a, b) => a.phase_order - b.phase_order);
  }, [items]);

  function updateStageName(index: number, name: string) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, stage_name: name } : it)));
  }

  function removeStage(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index).map((it, i) => ({ ...it, stage_order: i + 1 })));
  }

  function addStageToPhase(phase_name: string, phase_order: number) {
    setItems((prev) => {
      const next = [...prev];
      // Find last index of phase; insert after
      let insertAt = next.length;
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].phase_name === phase_name && next[i].phase_order === phase_order) {
          insertAt = i + 1;
          break;
        }
      }
      next.splice(insertAt, 0, {
        phase_name,
        phase_order,
        stage_name: "New stage",
        stage_key: `custom_${Date.now()}`,
        stage_order: 0,
      });
      return next.map((it, i) => ({ ...it, stage_order: i + 1 }));
    });
  }

  function addPhase() {
    setItems((prev) => {
      const nextOrder = (prev.reduce((m, x) => Math.max(m, x.phase_order), 0) || 0) + 1;
      return [
        ...prev,
        {
          phase_name: `Phase ${nextOrder}`,
          phase_order: nextOrder,
          stage_name: "New stage",
          stage_key: `custom_${Date.now()}`,
          stage_order: prev.length + 1,
        },
      ];
    });
  }

  function renamePhase(oldName: string, oldOrder: number, newName: string) {
    setItems((prev) =>
      prev.map((it) =>
        it.phase_name === oldName && it.phase_order === oldOrder ? { ...it, phase_name: newName } : it,
      ),
    );
  }

  function moveStage(index: number, dir: -1 | 1) {
    setItems((prev) => {
      const swap = index + dir;
      if (swap < 0 || swap >= prev.length) return prev;
      if (prev[swap].phase_name !== prev[index].phase_name) return prev;
      const next = [...prev];
      [next[index], next[swap]] = [next[swap], next[index]];
      return next.map((it, i) => ({ ...it, stage_order: i + 1 }));
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !clientId) {
      toast.error("Name and client are required");
      return;
    }
    if (items.length === 0) {
      toast.error("Add at least one stage");
      return;
    }
    setBusy(true);
    const { data: userRes } = await supabase.auth.getUser();
    const { data: proj, error } = await supabase
      .from("projects")
      .insert({
        name: name.trim(),
        villa_number: villa.trim() || null,
        address: address.trim() || null,
        client_id: clientId,
        project_type: CATEGORY_LABELS[category],
        area_sqft: area ? Number(area) : null,
        start_date: startDate || null,
        expected_completion: expected || null,
        notes: notes.trim() || null,
        status: "planning",
        overall_progress: 0,
        created_by: userRes.user?.id ?? null,
      })
      .select("id")
      .single();

    if (error || !proj) {
      setBusy(false);
      toast.error(error?.message ?? "Failed to create project");
      return;
    }

    // Insert stages (dedupe keys per project)
    const seen = new Set<string>();
    const stageRows = items.map((it, idx) => {
      let key = it.stage_key || slugify(it.stage_name);
      while (seen.has(key)) key = `${key}_${idx}`;
      seen.add(key);
      return {
        project_id: proj.id,
        stage_key: key,
        stage_name: it.stage_name.trim() || "Untitled stage",
        stage_order: idx + 1,
        phase_name: it.phase_name,
        phase_order: it.phase_order,
        status: "pending" as const,
        progress: 0,
      };
    });
    const { error: stErr } = await supabase.from("project_stages").insert(stageRows);
    if (stErr) {
      toast.error(`Project created but stages failed: ${stErr.message}`);
    }

    // Save as new template if requested
    if (saveAsTemplate && newTemplateName.trim()) {
      const { data: tpl } = await supabase
        .from("stage_templates")
        .insert({
          name: newTemplateName.trim(),
          category: "custom",
          is_default: false,
          created_by: userRes.user?.id ?? null,
        })
        .select("id")
        .single();
      if (tpl) {
        await supabase.from("stage_template_items").insert(
          items.map((it, idx) => ({
            template_id: tpl.id,
            phase_name: it.phase_name,
            phase_order: it.phase_order,
            stage_name: it.stage_name,
            stage_key: it.stage_key || slugify(it.stage_name),
            stage_order: idx + 1,
          })),
        );
      }
    }

    setBusy(false);
    toast.success("Project created");
    setOpen(false);
    // reset
    setName(""); setVilla(""); setAddress(""); setClientId("");
    setArea(""); setStartDate(""); setExpected(""); setNotes("");
    setSaveAsTemplate(false); setNewTemplateName("");
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" /> New project
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create a new project</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Project name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Villa number</Label>
            <Input value={villa} onChange={(e) => setVilla(e.target.value)} placeholder="V-24" />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(CATEGORY_LABELS) as Category[]).map((k) => (
                  <SelectItem key={k} value={k}>{CATEGORY_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Timeline template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {templatesForCategory.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
                {templates
                  .filter((t) => t.category === "custom")
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name} (custom)</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder={clients.length ? "Select a client" : "No clients yet — add one first"} />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name || c.email} · {c.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Area (sqft)</Label>
            <Input type="number" value={area} onChange={(e) => setArea(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Start date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Expected completion</Label>
            <Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          {/* Timeline builder */}
          <div className="sm:col-span-2 space-y-2 rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Timeline stages</Label>
              <Button type="button" size="sm" variant="outline" onClick={addPhase}>
                <Plus className="mr-1 size-3.5" /> Add phase
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Edit, reorder or remove stages for this project. Changes here don't affect the base template.
            </p>

            {phases.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Select a template above to load stages.</p>
            ) : (
              <Accordion type="multiple" defaultValue={phases.map((p) => `${p.phase_order}`)} className="space-y-2">
                {phases.map((ph) => (
                  <AccordionItem key={`${ph.phase_order}-${ph.phase_name}`} value={`${ph.phase_order}`} className="rounded-lg border border-border bg-background px-3">
                    <AccordionTrigger className="py-2.5 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-primary">
                          Phase {ph.phase_order}
                        </span>
                        <span className="text-sm font-semibold">{ph.phase_name}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {ph.items.length} {ph.items.length === 1 ? "stage" : "stages"}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-3">
                      <div className="mb-2">
                        <Input
                          value={ph.phase_name}
                          onChange={(e) => renamePhase(ph.phase_name, ph.phase_order, e.target.value)}
                          className="h-8 text-xs"
                          placeholder="Phase name"
                        />
                      </div>
                      <ul className="space-y-1.5">
                        {ph.items.map((it) => {
                          const globalIndex = items.indexOf(it);
                          return (
                            <li key={globalIndex} className="flex items-center gap-1.5">
                              <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
                              <Input
                                value={it.stage_name}
                                onChange={(e) => updateStageName(globalIndex, e.target.value)}
                                className="h-8 text-sm"
                              />
                              <Button type="button" size="icon" variant="ghost" className="size-7" onClick={() => moveStage(globalIndex, -1)}>
                                <ArrowUp className="size-3.5" />
                              </Button>
                              <Button type="button" size="icon" variant="ghost" className="size-7" onClick={() => moveStage(globalIndex, 1)}>
                                <ArrowDown className="size-3.5" />
                              </Button>
                              <Button type="button" size="icon" variant="ghost" className="size-7 text-destructive" onClick={() => removeStage(globalIndex)}>
                                <Trash2 className="size-3.5" />
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="mt-2"
                        onClick={() => addStageToPhase(ph.phase_name, ph.phase_order)}
                      >
                        <Plus className="mr-1 size-3.5" /> Add stage
                      </Button>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}

            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-dashed border-border bg-background/60 p-3 sm:flex-row sm:items-center">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={saveAsTemplate} onCheckedChange={(v) => setSaveAsTemplate(!!v)} />
                Save this arrangement as a reusable template
              </label>
              {saveAsTemplate && (
                <Input
                  className="h-8 flex-1 text-sm"
                  placeholder="Template name"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                />
              )}
            </div>
          </div>

          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
