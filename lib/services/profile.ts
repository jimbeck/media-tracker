import { createClient } from "@/lib/supabase/server";
import { type Profile, type UserMediaRow } from "@/lib/types/profile";

type PrivateProfile = {
  bio: string | null;
  website: string | null;
  location: string | null;
  favorite_types: string[] | null;
};

type ProfilePageData = {
  profile: Profile | null;
  privateData: PrivateProfile | null;
  privateError: { code?: string; message?: string } | null;
  mediaData: UserMediaRow[] | null;
  mediaError: { code?: string; message?: string } | null;
  privateRestricted: boolean;
  mediaRestricted: boolean;
};

function isRlsError(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false;
  }

  return (
    error.code === "42501" ||
    error.message?.toLowerCase().includes("permission denied") ||
    false
  );
}

export async function getProfilePageData(handle: string): Promise<ProfilePageData> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, handle, display_name, avatar_url, discoverable")
    .eq("handle", handle)
    .maybeSingle<Profile>();

  if (!profile) {
    return {
      profile: null,
      privateData: null,
      privateError: null,
      mediaData: null,
      mediaError: null,
      privateRestricted: false,
      mediaRestricted: false,
    };
  }

  const { data: privateData, error: privateError } = await supabase
    .from("profile_private")
    .select("bio, website, location, favorite_types")
    .eq("user_id", profile.id)
    .maybeSingle<PrivateProfile>();

  const { data: mediaData, error: mediaError } = await supabase
    .from("user_media")
    .select("status, rating, is_favorite, media_items(title, type)")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(10)
    .returns<UserMediaRow[]>();

  return {
    profile,
    privateData,
    privateError,
    mediaData,
    mediaError,
    privateRestricted: isRlsError(privateError),
    mediaRestricted: isRlsError(mediaError),
  };
}
