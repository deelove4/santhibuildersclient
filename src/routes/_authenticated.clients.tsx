import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { Users, UserPlus, MailPlus, ShieldCheck, ShieldOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createClientAccount, inviteUser, setUserActive } from "@/lib/admin.functions";
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
import { cn } from "@/lib/utils";

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
  component: UsersPage,
});

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  role: "admin" | "client";
}

function UsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "admin" | "client" | "inactive">("all");
  const setActiveFn = useServerFn(setUserActive);

  async function refresh() {
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "client"]);
    const rolesMap = new Map<string, "admin" | "client">();
    (roleRows ?? []).forEach((r) => {
      // admin wins over client
      const existing = rolesMap.get(r.user_id);
      if (r.role === "admin" || !existing) rolesMap.set(r.user_id, r.role as "admin" | "client");
    });
    const ids = Array.from(rolesMap.keys());
    if (!ids.length) {
      setRows([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, phone, is_active, created_at")
      .in("id", ids)
      .order("created_at", { ascending: false });
    setRows(
      (data ?? []).map((p: any) => ({
        ...p,
        role: rolesMap.get(p.id) ?? "client",
      })) as UserRow[],
    );
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function toggleActive(u: UserRow) {
    const next = !u.is_active;
    if (!confirm(`${next ? "Activate" : "Deactivate"} ${u.full_name || u.email}?`)) return;
    try {
      await setActiveFn({ data: { user_id: u.id, is_active: next } });
      toast.success(next ? "User activated" : "User deactivated");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  const shown = rows.filter((r) => {
    if (filter === "all") return true;
    if (filter === "inactive") return !r.is_active;
    return r.role === filter;
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Admin</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">User management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, invite, and deactivate admin and client accounts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <MailPlus className="mr-2 size-4" /> Invite
              </Button>
            </DialogTrigger>
            <InviteDialog onDone={() => { setInviteOpen(false); refresh(); }} />
          </Dialog>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 size-4" /> Add user
              </Button>
            </DialogTrigger>
            <NewUserDialog onCreated={() => { setCreateOpen(false); refresh(); }} />
          </Dialog>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {(["all", "admin", "client", "inactive"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors",
              filter === f
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/60" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-16 text-center">
          <Users className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No users match this filter.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-b-0">
                  <td className="px-5 py-4 font-display font-semibold">{r.full_name ?? "—"}</td>
                  <td className="px-5 py-4 text-muted-foreground">{r.email}</td>
                  <td className="px-5 py-4">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest",
                        r.role === "admin" ? "bg-accent/15 text-accent-foreground" : "bg-primary/10 text-primary",
                      )}
                    >
                      {r.role}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest",
                        r.is_active
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {r.is_active ? "active" : "inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Button size="sm" variant="ghost" onClick={() => toggleActive(r)}>
                      {r.is_active ? (
                        <><ShieldOff className="mr-1.5 size-3.5" /> Deactivate</>
                      ) : (
                        <><ShieldCheck className="mr-1.5 size-3.5" /> Activate</>
                      )}
                    </Button>
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

const userSchema = z.object({
  email: z.string().trim().email(),
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional(),
  password: z.string().min(10, "At least 10 characters").max(128),
  role: z.enum(["admin", "client"]),
});

function NewUserDialog({ onCreated }: { onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "client">("client");
  const [busy, setBusy] = useState(false);
  const createFn = useServerFn(createClientAccount);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = userSchema.safeParse({ email, full_name: fullName, phone: phone || undefined, password, role });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
    setBusy(true);
    try {
      await createFn({
        data: {
          email: parsed.data.email,
          full_name: parsed.data.full_name,
          phone: parsed.data.phone ?? null,
          password: parsed.data.password,
          role: parsed.data.role,
        },
      });
      toast.success("User created");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Add a new user</DialogTitle>
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
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "admin" | "client")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ph">Phone (optional)</Label>
            <Input id="ph" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw">Temporary password</Label>
          <Input id="pw" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min. 10 characters" required />
          <p className="text-xs text-muted-foreground">Share securely. They can change it after signing in.</p>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create user"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function InviteDialog({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"admin" | "client">("client");
  const [busy, setBusy] = useState(false);
  const inviteFn = useServerFn(inviteUser);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !fullName) return toast.error("Email and name required");
    setBusy(true);
    try {
      await inviteFn({ data: { email, full_name: fullName, role } });
      toast.success("Invite email sent");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Invite a user</DialogTitle>
      </DialogHeader>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Full name</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as "admin" | "client")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="client">Client</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send invite"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
