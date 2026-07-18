import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { Users, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createClientAccount } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/clients")({
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
  component: ClientsPage,
});

interface ClientRow {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
}

function ClientsPage() {
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  async function refresh() {
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "client");
    const ids = (roleRows ?? []).map((r) => r.user_id);
    if (ids.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, phone, created_at")
      .in("id", ids)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as ClientRow[]);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Admin
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Clients</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 size-4" /> Add client
            </Button>
          </DialogTrigger>
          <NewClientDialog
            onCreated={() => {
              setOpen(false);
              refresh();
            }}
          />
        </Dialog>
      </header>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/60" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-16 text-center">
          <Users className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No clients yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Added</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-b-0">
                  <td className="px-5 py-4 font-display font-semibold">
                    {r.full_name ?? "—"}
                  </td>
                  <td className="px-5 py-4 text-muted-foreground">{r.email}</td>
                  <td className="px-5 py-4 text-muted-foreground">{r.phone ?? "—"}</td>
                  <td className="px-5 py-4 text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
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

const clientSchema = z.object({
  email: z.string().trim().email(),
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional(),
  password: z.string().min(10, "At least 10 characters").max(128),
});

function NewClientDialog({ onCreated }: { onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const createFn = useServerFn(createClientAccount);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = clientSchema.safeParse({ email, full_name: fullName, phone: phone || undefined, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setBusy(true);
    try {
      await createFn({
        data: {
          email: parsed.data.email,
          full_name: parsed.data.full_name,
          phone: parsed.data.phone ?? null,
          password: parsed.data.password,
        },
      });
      toast.success("Client created");
      setEmail("");
      setFullName("");
      setPhone("");
      setPassword("");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create client");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Add a new client</DialogTitle>
      </DialogHeader>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="e">Email</Label>
          <Input id="e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ph">Phone (optional)</Label>
          <Input id="ph" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw">Temporary password</Label>
          <Input
            id="pw"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="min. 10 characters"
            required
          />
          <p className="text-xs text-muted-foreground">
            Share this with the client securely. They can change it after signing in.
          </p>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create client"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
