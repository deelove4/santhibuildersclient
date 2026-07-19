import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NewClientDialog } from "@/components/clients/NewClientDialog";

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

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Admin
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Clients</h1>
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
