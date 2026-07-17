import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FileStack, Upload, Trash2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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

const MAX_BYTES = 1024 * 1024;
const CATEGORIES = ["contract", "invoice", "drawing", "approval", "general"];

export const Route = createFileRoute("/_authenticated/templates")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: TemplatesPage,
});

interface Template {
  id: string;
  name: string;
  category: string;
  description: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

function TemplatesPage() {
  const [rows, setRows] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase
      .from("document_templates")
      .select("*")
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Template[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function download(t: Template) {
    const { data, error } = await supabase.storage
      .from("document-templates")
      .createSignedUrl(t.storage_path, 300);
    if (error || !data?.signedUrl) return toast.error("Could not open");
    window.open(data.signedUrl, "_blank");
  }

  async function remove(t: Template) {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    await supabase.storage.from("document-templates").remove([t.storage_path]);
    await supabase.from("document_templates").delete().eq("id", t.id);
    load();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Admin</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Document templates
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reusable contracts and invoices. Generate documents per project with one click.
          </p>
        </div>
        <NewTemplateDialog onCreated={load} />
      </header>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/60" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-16 text-center">
          <FileStack className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No templates yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">File</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-b-0">
                  <td className="px-5 py-3">
                    <div className="font-display font-semibold">{t.name}</div>
                    {t.description && (
                      <div className="text-xs text-muted-foreground">{t.description}</div>
                    )}
                  </td>
                  <td className="px-5 py-3 capitalize text-muted-foreground">{t.category}</td>
                  <td className="px-5 py-3 text-muted-foreground">{t.file_name}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => download(t)}>
                        <Download className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(t)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
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

function NewTemplateDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("contract");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error("Choose a file");
    if (file.size > MAX_BYTES) return toast.warning("Max 1 MB per file");
    if (!name.trim()) return toast.error("Give it a name");

    setBusy(true);
    const ext = file.name.split(".").pop();
    const path = `templates/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("document-templates")
      .upload(path, file, { contentType: file.type });
    if (upErr) {
      setBusy(false);
      return toast.error(upErr.message);
    }
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await supabase.from("document_templates").insert({
      name: name.trim(),
      description: description.trim() || null,
      category,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      storage_path: path,
      created_by: userRes.user?.id ?? null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Template added");
    setName("");
    setDescription("");
    setCategory("contract");
    if (fileRef.current) fileRef.current.value = "";
    setOpen(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="mr-2 size-4" /> New template
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload a document template</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Villa Contract v3" required />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>File (max 1 MB)</Label>
            <Input type="file" ref={fileRef} required />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>{busy ? "Uploading…" : "Upload template"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
