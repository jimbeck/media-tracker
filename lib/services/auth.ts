import { createClient } from "@/lib/supabase/server";

export async function getUserClaims() {
  const supabase = await createClient();
  return supabase.auth.getClaims();
}
