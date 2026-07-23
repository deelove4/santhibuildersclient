import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Send, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface MessageRow {
  id: string;
  project_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  stage_key: string | null;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface ProjectChatProps {
  projectId: string;
  currentUserId: string | undefined;
  stageKey?: string;
  compact?: boolean;
  title?: string;
  subtitle?: string;
  placeholder?: string;
}

export function ProjectChat({
  projectId,
  currentUserId,
  stageKey,
  compact = false,
  title = "Project chat",
  subtitle = "Messages are shared live between Santhi Builders and this project's client.",
  placeholder = "Type a project update…",
}: ProjectChatProps) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const senderIds = useMemo(
    () => Array.from(new Set(messages.map((m) => m.sender_id))),
    [messages],
  );

  const loadMessages = useCallback(async () => {
    let q = supabase
      .from("messages")
      .select("id, project_id, sender_id, body, read_at, created_at, stage_key")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (stageKey) q = q.eq("stage_key", stageKey);
    const { data, error } = await q;
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    setMessages((data ?? []) as MessageRow[]);
    setLoading(false);
  }, [projectId, stageKey]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (senderIds.length === 0) return;
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", senderIds)
      .then(({ data }) => {
        const next = Object.fromEntries(((data ?? []) as ProfileRow[]).map((p) => [p.id, p]));
        setProfiles((cur) => ({ ...cur, ...next }));
      });
  }, [senderIds.join("|")]);

  useEffect(() => {
    const channel = supabase
      .channel(`project-chat:${projectId}:${stageKey ?? "all"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `project_id=eq.${projectId}` },
        (payload) => {
          const next = payload.new as MessageRow;
          if (stageKey && next.stage_key !== stageKey) return;
          setMessages((cur) => (cur.some((m) => m.id === next.id) ? cur : [...cur, next]));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, stageKey]);

  useEffect(() => {
    viewportRef.current?.scrollTo({ top: viewportRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || !currentUserId) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      project_id: projectId,
      sender_id: currentUserId,
      body: text,
      stage_key: stageKey ?? null,
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setBody("");
  }

  const viewportHeight = compact ? "h-[260px]" : "h-[430px]";

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      {!compact && (
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-2 font-display text-lg font-semibold">
            <MessageSquare className="size-5 text-primary" /> {title}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
      )}

      <div ref={viewportRef} className={cn("overflow-y-auto", viewportHeight)}>
        <div className={cn("space-y-3", compact ? "p-3" : "p-5")}>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/60" />
            ))
          ) : messages.length === 0 ? (
            <div className={compact ? "py-6 text-center" : "py-16 text-center"}>
              <MessageSquare className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-2 text-xs text-muted-foreground">No messages yet.</p>
            </div>
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === currentUserId;
              const profile = profiles[m.sender_id];
              const name = mine ? "You" : profile?.full_name || profile?.email || "Santhi Team";
              return (
                <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
                      mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                    )}
                  >
                    <div className="mb-0.5 flex items-center justify-between gap-3 text-[10px] opacity-75">
                      <span className="font-medium">{name}</span>
                      <time className="font-mono">{formatTime(m.created_at)}</time>
                    </div>
                    <p className="whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <form onSubmit={sendMessage} className={cn("border-t border-border", compact ? "p-2" : "p-4")}>
        <div className="flex gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={placeholder}
            rows={compact ? 1 : 2}
            className={cn("resize-none", compact ? "min-h-10" : "min-h-12")}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <Button type="submit" size="icon" disabled={sending || !body.trim() || !currentUserId} aria-label="Send">
            <Send className="size-4" />
          </Button>
        </div>
      </form>
    </section>
  );
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
