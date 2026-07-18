import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar, useProfile } from "@/components/app-sidebar";
import type { AppRole } from "@/lib/use-auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const [role, setRole] = useState<AppRole | null>(null);
  const profile = useProfile(user.id);

  useEffect(() => {
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const roles = (data ?? []).map((r) => r.role as AppRole);
        setRole(roles.includes("admin") ? "admin" : "client");
      });
  }, [user.id]);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <AppSidebar role={role} email={user.email ?? null} fullName={profile?.full_name ?? null} />
      <main className="min-w-0 flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
