import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const requestEmailChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ email: z.string().email() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.auth.updateUser({ email: data.email });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ confirmUsername: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("profiles").select("username").eq("id", context.userId).maybeSingle();
    if (!profile || profile.username !== data.confirmUsername) {
      throw new Error("Username confirmation did not match");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Best-effort: remove storage objects under the user's folder in both buckets.
    for (const bucket of ["avatars", "business-documents"]) {
      const { data: files } = await supabaseAdmin.storage.from(bucket).list(context.userId, { limit: 1000 });
      if (files?.length) {
        await supabaseAdmin.storage.from(bucket).remove(files.map((f) => `${context.userId}/${f.name}`));
      }
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
