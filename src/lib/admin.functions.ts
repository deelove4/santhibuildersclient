import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreateClientInput = z.object({
  email: z.string().trim().email().max(255),
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional().nullable(),
  password: z.string().min(10).max(128),
});

export const createClientAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => CreateClientInput.parse(raw))
  .handler(async ({ data, context }) => {
    // Verify caller is admin using their own RLS-scoped client
    const { data: adminRole, error: rerr } = await context.supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (rerr) throw new Error("Role check failed");
    if (!adminRole) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Failed to create user");

    // Ensure profile fields
    await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.full_name, phone: data.phone ?? null })
      .eq("id", created.user.id);

    // Ensure client role
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: created.user.id, role: "client" }, { onConflict: "user_id,role" });

    return { user_id: created.user.id, email: created.user.email };
  });
