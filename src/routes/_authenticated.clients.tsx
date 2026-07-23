import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { NewClientDialog } from "@/components/clients/NewClientDialog";
import { DeleteBtn } from "./_authenticated.projects.index";
import { deleteClientAccount } from "@/lib/admin.functions";

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

  async function handleDelete(id: string, name: string) {
    try {
      await deleteClientAccount({ data: { user_id: id } });
      toast.success(`Removed ${name}`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Admin</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">Clients</h1>
        </div>
        <NewClientDialog onCreated={refresh} />
      </header>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/60" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center sm:p-16">
          <Users className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No clients yet.</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid gap-3 sm:hidden">
            {rows.map((r) => (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-display font-semibold">{r.full_name ?? "—"}</div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">{r.email}</div>
                    {r.phone && <div className="mt-0.5 text-xs text-muted-foreground">{r.phone}</div>}
                  </div>
                  <DeleteBtn onConfirm={() => handleDelete(r.id, r.full_name ?? r.email)} label={r.full_name ?? r.email} kind="client" />
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Phone</th>
                    <th className="px-5 py-3">Added</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-b-0">
                      <td className="px-5 py-4 font-display font-semibold">{r.full_name ?? "—"}</td>
                      <td className="px-5 py-4 text-muted-foreground">{r.email}</td>
                      <td className="px-5 py-4 text-muted-foreground">{r.phone ?? "—"}</td>
                      <td className="px-5 py-4 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td className="px-5 py-4 text-right">
                        <DeleteBtn onConfirm={() => handleDelete(r.id, r.full_name ?? r.email)} label={r.full_name ?? r.email} kind="client" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
