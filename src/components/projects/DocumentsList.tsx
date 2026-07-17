import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, Upload, Trash2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const CATEGORIES = ["contract", "invoice", "drawing", "approval", "general"];

export function DocumentsList({ projectId, isAdmin }: { projectId: string; isAdmin: boolean }) {
  const [items, setItems] = useState<Doc[]>([]);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState("general");
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const { data } = await supabase
      .from("project_documents")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Doc[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
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
          <p className="text-xs text-muted-foreground">Contracts, invoices, drawings, and approvals.</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
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
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
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
