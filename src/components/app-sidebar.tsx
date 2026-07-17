import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  Users,
  Settings,
  LogOut,
  Sun,
  Moon,
  FileStack,
  Menu,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/lib/theme";
import type { AppRole } from "@/lib/use-auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { NotificationsBell } from "@/components/NotificationsBell";

interface Props {
  role: AppRole | null;
  email: string | null;
  fullName: string | null;
  userId: string;
}

function useNavItems(role: AppRole | null) {
  return [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/projects", label: "Projects", icon: Building2 },
    ...(role === "admin"
      ? [
          { to: "/clients", label: "Clients", icon: Users },
          { to: "/templates", label: "Templates", icon: FileStack },
        ]
      : []),
    { to: "/settings", label: "Settings", icon: Settings },
  ] as const;
}

function SidebarInner({ role, email, fullName, onNavigate }: Props & { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const [signingOut, setSigningOut] = useState(false);
  const items = useNavItems(role);

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="grid size-8 place-items-center rounded-lg bg-primary font-display font-bold text-primary-foreground">
          S
        </div>
        <div className="min-w-0">
          <div className="font-display text-sm font-semibold leading-tight">Santhi Builders</div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {role === "admin" ? "Admin Console" : "Client Portal"}
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {items.map((it) => {
          const active = pathname === it.to || pathname.startsWith(it.to + "/");
          return (
            <Link
              key={it.to}
              to={it.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <it.icon className="size-4" />
              {it.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-2 border-t border-sidebar-border p-3">
        <button
          onClick={toggle}
          className="mb-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>

        <div className="flex items-center gap-2 rounded-lg px-2 py-2">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 font-display text-sm font-semibold text-primary">
            {(fullName || email || "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{fullName || "Account"}</div>
            <div className="truncate text-xs text-muted-foreground">{email}</div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleSignOut}
            disabled={signingOut}
            aria-label="Sign out"
            className="size-8"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AppSidebar(props: Props) {
  return (
    <aside className="hidden h-screen w-64 shrink-0 border-r border-sidebar-border lg:block">
      <SidebarInner {...props} />
    </aside>
  );
}

export function MobileTopBar(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-background/80 px-4 py-2 backdrop-blur lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Menu">
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarInner {...props} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex items-center gap-1.5">
        <div className="grid size-7 place-items-center rounded-md bg-primary font-display text-xs font-bold text-primary-foreground">
          S
        </div>
        <span className="font-display text-sm font-semibold">Santhi Builders</span>
      </div>
      <NotificationsBell userId={props.userId} />
    </div>
  );
}

export function DesktopTopBar({ userId }: { userId: string }) {
  return (
    <div className="hidden items-center justify-end border-b border-border bg-background/80 px-6 py-2 backdrop-blur lg:flex">
      <NotificationsBell userId={userId} />
    </div>
  );
}

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<{ full_name: string | null; email: string | null } | null>(null);
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => setProfile(data ?? null));
  }, [userId]);
  return profile;
}
