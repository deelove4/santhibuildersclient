import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Image as ImageIcon, Upload, Trash2, Film } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Media {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  media_type: string;
  caption: string | null;
  created_at: string;
}

export function MediaGallery({ projectId, isAdmin }: { projectId: string; isAdmin: boolean }) {
  const [items, setItems] = useState<Media[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [mediaType, setMediaType] = useState("photo");
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const { data } = await supabase
      .from("project_media")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as Media[];
    setItems(rows);
    if (rows.length) {
      const { data: signed } = await supabase.storage
        .from("project-media")
        .createSignedUrls(rows.map((r) => r.storage_path), 3600);
      const map: Record<string, string> = {};
      signed?.forEach((s, i) => {
        if (s.signedUrl) map[rows[i].id] = s.signedUrl;
      });
      setUrls(map);
    } else {
      setUrls({});
    }
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
        .from("project-media")
        .upload(path, file, { contentType: file.type });
      if (upErr) {
        toast.error(`${file.name}: ${upErr.message}`);
        continue;
      }
      const { error } = await supabase.from("project_media").insert({
        project_id: projectId,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        media_type: file.type.startsWith("video/") ? "video" : mediaType,
        uploaded_by: userRes.user?.id ?? null,
      });
      if (error) toast.error(error.message);
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    toast.success("Uploaded");
    load();
  }

  async function remove(m: Media) {
    if (!confirm(`Delete ${m.file_name}?`)) return;
    await supabase.storage.from("project-media").remove([m.storage_path]);
    await supabase.from("project_media").delete().eq("id", m.id);
    load();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Media library</h2>
          <p className="text-xs text-muted-foreground">Photos, drone shots, and videos of the site.</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Select value={mediaType} onValueChange={setMediaType}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="photo">Photo</SelectItem>
                <SelectItem value="drone">Drone</SelectItem>
                <SelectItem value="video">Video</SelectItem>
              </SelectContent>
            </Select>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              multiple
              hidden
              onChange={onFiles}
            />
            <Button onClick={() => fileRef.current?.click()} disabled={busy}>
              <Upload className="mr-2 size-4" /> {busy ? "Uploading…" : "Upload"}
            </Button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
          <ImageIcon className="mx-auto size-7 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No media yet.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {items.map((m) => {
            const url = urls[m.id];
            const isVideo = m.mime_type?.startsWith("video/") || m.media_type === "video";
            return (
              <div
                key={m.id}
                className="group relative overflow-hidden rounded-xl border border-border bg-card"
              >
                <div className="aspect-square bg-muted">
                  {url ? (
                    isVideo ? (
                      <div className="flex h-full items-center justify-center">
                        <Film className="size-8 text-muted-foreground" />
                      </div>
                    ) : (
                      <img
                        src={url}
                        alt={m.caption ?? m.file_name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    )
                  ) : (
                    <div className="h-full animate-pulse" />
                  )}
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="truncate font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {m.media_type}
                  </span>
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      Open
                    </a>
                  )}
                </div>
                {isAdmin && (
                  <button
                    onClick={() => remove(m)}
                    className="absolute right-2 top-2 grid size-7 place-items-center rounded-md bg-background/80 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
                    aria-label="Delete"
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
