import { createClient } from "npm:@supabase/supabase-js@2";

export const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

export const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T | null {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
