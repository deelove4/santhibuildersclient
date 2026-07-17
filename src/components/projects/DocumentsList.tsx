import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { FileText, Upload, Trash2, Download, FilePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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

const MAX_BYTES = 1024 * 1024; // 1 MB

interface Doc {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  category: string;
  description: string | null;
  created_at: string;
}

interface Template {
  id: string;
  name: string;
  category: string;
  file_name: string;
  mime_type: string | null;
  storage_path: string;
  size_bytes: number | null;
}

const CATEGORIES = ["contract", "invoice", "drawing", "approval", "general"];

export function DocumentsList({ projectId, isAdmin }: { projectId: string; isAdmin: boolean }) {
  const [items, setItems] = useState<Doc[]>([]);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState("general");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("project_documents")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Doc[]);
  }, [projectId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`docs:${projectId}:${Math.random().toString(36).slice(2,10)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_documents", filter: `project_id=eq.${projectId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, load]);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (!picked.length) return;

    const oversized = picked.filter((f) => f.size > MAX_BYTES);
    const files = picked.filter((f) => f.size <= MAX_BYTES);
    if (oversized.length) {
      toast.warning(
        `${oversized.length} file(s) skipped — max 1 MB per file: ${oversized
          .map((f) => f.name)
          .slice(0, 3)
          .join(", ")}${oversized.length > 3 ? "…" : ""}`,
      );
    }
    if (!files.length) {
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setBusy(true);
    const { data: userRes } = await supabase.auth.getUser();
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${projectId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("project-documents")
        .upload(path, file, { contentType: file.type });
      if (upErr) {
        toast.error(`${file.name}: ${upErr.message}`);
        continue;
      }
      const { error } = await supabase.from("project_documents").insert({
        project_id: projectId,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        category,
        uploaded_by: userRes.user?.id ?? null,
      });
      if (error) toast.error(error.message);
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    toast.success("Uploaded");
    load();
  }

  async function download(d: Doc) {
    const { data, error } = await supabase.storage
      .from("project-documents")
      .createSignedUrl(d.storage_path, 300);
    if (error || !data?.signedUrl) return toast.error("Could not open document");
    window.open(data.signedUrl, "_blank");
  }

  async function remove(d: Doc) {
    if (!confirm(`Delete ${d.file_name}?`)) return;
    await supabase.storage.from("project-documents").remove([d.storage_path]);
    await supabase.from("project_documents").delete().eq("id", d.id);
    load();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Documents</h2>
          <p className="text-xs text-muted-foreground">
            Contracts, invoices, drawings, and approvals. Max 1 MB per file.
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <FromTemplateButton projectId={projectId} onCreated={load} />
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-36">
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
            <input ref={fileRef} type="file" multiple hidden onChange={onFiles} />
            <Button onClick={() => fileRef.current?.click()} disabled={busy}>
              <Upload className="mr-2 size-4" /> {busy ? "Uploading…" : "Upload"}
            </Button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
          <FileText className="mx-auto size-7 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No documents yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-5 py-3">File</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Size</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-b-0">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <FileText className="size-4 text-muted-foreground" />
                      <span className="font-medium">{d.file_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground capitalize">{d.category}</td>
                  <td className="px-5 py-3 font-mono text-xs tabular-nums text-muted-foreground">
                    {d.size_bytes ? `${(d.size_bytes / 1024).toFixed(1)} KB` : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => download(d)}>
                        <Download className="size-4" />
                      </Button>
                      {isAdmin && (
                        <Button size="sm" variant="ghost" onClick={() => remove(d)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FromTemplateButton({ projectId, onCreated }: { projectId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("document_templates")
      .select("id, name, category, file_name, mime_type, storage_path, size_bytes")
      .order("name")
      .then(({ data }) => setTemplates((data ?? []) as Template[]));
  }, [open]);

  async function create() {
    const tpl = templates.find((t) => t.id === selected);
    if (!tpl) return toast.error("Choose a template");
    setBusy(true);
    // 1. Download the template file
    const { data: blob, error: dlErr } = await supabase.storage
      .from("document-templates")
      .download(tpl.storage_path);
    if (dlErr || !blob) {
      setBusy(false);
      return toast.error("Failed to load template");
    }
    // 2. Upload as a project document
    const ext = tpl.file_name.split(".").pop();
    const path = `${projectId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("project-documents")
      .upload(path, blob, { contentType: tpl.mime_type ?? undefined });
    if (upErr) {
      setBusy(false);
      return toast.error(upErr.message);
    }
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await supabase.from("project_documents").insert({
      project_id: projectId,
      storage_path: path,
      file_name: `${tpl.name} — ${tpl.file_name}`,
      mime_type: tpl.mime_type,
      size_bytes: tpl.size_bytes,
      category: tpl.category,
      uploaded_by: userRes.user?.id ?? null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Document created from template");
    setOpen(false);
    setSelected("");
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FilePlus className="mr-2 size-4" /> From template
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create from template</DialogTitle>
        </DialogHeader>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No templates uploaded yet. Add one from the Templates page.
          </p>
        ) : (
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger>
              <SelectValue placeholder="Select a template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name} · <span className="text-muted-foreground capitalize">{t.category}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <DialogFooter>
          <Button onClick={create} disabled={busy || !selected}>
            {busy ? "Creating…" : "Create document"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
