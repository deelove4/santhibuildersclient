import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar, MobileTopBar, DesktopTopBar, useProfile } from "@/components/app-sidebar";
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

  const sidebarProps = {
    role,
    email: user.email ?? null,
    fullName: profile?.full_name ?? null,
    userId: user.id,
  };

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <AppSidebar {...sidebarProps} />
      <main className="flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden">
        <MobileTopBar {...sidebarProps} />
        <DesktopTopBar userId={user.id} />
        <div className="flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
