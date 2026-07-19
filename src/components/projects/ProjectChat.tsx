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
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface ProjectChatProps {
  projectId: string;
  currentUserId: string | undefined;
}

export function ProjectChat({ projectId, currentUserId }: ProjectChatProps) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const senderIds = useMemo(
    () => Array.from(new Set(messages.map((message) => message.sender_id))),
    [messages],
  );

  const loadMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from("messages")
      .select("id, project_id, sender_id, body, read_at, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    setMessages((data ?? []) as MessageRow[]);
    setLoading(false);
  }, [projectId]);

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
        const next = Object.fromEntries(((data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));
        setProfiles((current) => ({ ...current, ...next }));
      });
  }, [senderIds.join("|")]);

  useEffect(() => {
    const channel = supabase
      .channel(`project-chat:${projectId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `project_id=eq.${projectId}` },
        (payload) => {
          const next = payload.new as MessageRow;
          setMessages((current) => (current.some((message) => message.id === next.id) ? current : [...current, next]));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

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
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setBody("");
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center gap-2 font-display text-lg font-semibold">
          <MessageSquare className="size-5 text-primary" /> Project chat
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Messages are shared live between Santhi Builders and this project’s client.
        </p>
      </div>

      <div ref={viewportRef} className="h-[430px] overflow-y-auto">
        <div className="space-y-4 p-5">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/60" />
            ))
          ) : messages.length === 0 ? (
            <div className="py-16 text-center">
              <MessageSquare className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">No messages yet.</p>
            </div>
          ) : (
            messages.map((message) => {
              const mine = message.sender_id === currentUserId;
              const profile = profiles[message.sender_id];
              const name = mine ? "You" : profile?.full_name || profile?.email || "Santhi Team";
              return (
                <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[78%] rounded-2xl px-4 py-3 text-sm",
                      mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between gap-3 text-[11px] opacity-75">
                      <span className="font-medium">{name}</span>
                      <time className="font-mono">{formatTime(message.created_at)}</time>
                    </div>
                    <p className="whitespace-pre-wrap break-words leading-relaxed">{message.body}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <form onSubmit={sendMessage} className="border-t border-border p-4">
        <div className="flex gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type a project update…"
            rows={2}
            className="min-h-12 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <Button type="submit" size="icon" disabled={sending || !body.trim() || !currentUserId} aria-label="Send message">
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