import { createClient } from "@/lib/supabase/server";

export async function getUserClaims() {
  const supabase = await createClient();
  return supabase.auth.getClaims();
}

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
