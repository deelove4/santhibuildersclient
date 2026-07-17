import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/use-auth";

export function useRole(userId: string | undefined) {
  const [role, setRole] = useState<AppRole | null>(null);
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .then(({ data }) => {
        const rs = (data ?? []).map((r) => r.role as AppRole);
        setRole(rs.includes("admin") ? "admin" : "client");
      });
  }, [userId]);
  return role;
}
