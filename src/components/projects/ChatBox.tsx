import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Msg {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
}

interface SenderInfo {
  full_name: string | null;
  email: string | null;
}

export function ChatBox({ projectId, currentUserId }: { projectId: string; currentUserId: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [senders, setSenders] = useState<Record<string, SenderInfo>>({});
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function loadSenders(rows: Msg[]) {
    const ids = Array.from(new Set(rows.map((r) => r.sender_id)));
    if (!ids.length) return;
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ids);
    const map: Record<string, SenderInfo> = {};
    (data ?? []).forEach((p: any) => {
      map[p.id] = { full_name: p.full_name, email: p.email };
    });
    setSenders((prev) => ({ ...prev, ...map }));
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, body, sender_id, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (!mounted) return;
      const rows = (data ?? []) as Msg[];
      setMsgs(rows);
      loadSenders(rows);
    })();

    const channel = supabase
      .channel(`chat:${projectId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `project_id=eq.${projectId}` },
        (payload) => {
          const row = payload.new as Msg;
          setMsgs((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          loadSenders([row]);
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    const { error } = await supabase.from("messages").insert({
      project_id: projectId,
      sender_id: currentUserId,
      body,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setText("");
  }

  return (
    <div className="flex h-[60vh] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-5 py-3">
        <h3 className="font-display font-semibold">Project chat</h3>
        <p className="text-xs text-muted-foreground">
          Direct line between the client and the Santhi Builders team.
        </p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {msgs.length === 0 ? (
          <div className="grid h-full place-items-center text-center">
            <p className="text-sm text-muted-foreground">No messages yet. Say hello 👋</p>
          </div>
        ) : (
          msgs.map((m) => {
            const mine = m.sender_id === currentUserId;
            const s = senders[m.sender_id];
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[80%] rounded-2xl px-4 py-2 text-sm", mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
                  {!mine && (
                    <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wider opacity-70">
                      {s?.full_name || s?.email || "Team"}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words">{m.body}</div>
                  <div className={cn("mt-1 text-[10px] tabular-nums", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="flex items-center gap-2 border-t border-border p-3">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          maxLength={2000}
        />
        <Button type="submit" disabled={busy || !text.trim()} size="icon" aria-label="Send">
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
