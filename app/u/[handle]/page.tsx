import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Profile = {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  discoverable: boolean;
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

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const supabase = await createClient();
  const resolvedParams = await params;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, handle, display_name, avatar_url, discoverable")
    .eq("handle", resolvedParams.handle)
    .maybeSingle<Profile>();

  if (!profile) {
    notFound();
  }

  const { data: privateData, error: privateError } = await supabase
    .from("profile_private")
    .select("bio, website, location, favorite_types")
    .eq("user_id", profile.id)
    .maybeSingle();

  const { data: mediaData, error: mediaError } = await supabase
    .from("user_media")
    .select("status, rating, is_favorite, media_items(title, type)")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const privateRestricted = isRlsError(privateError);
  const mediaRestricted = isRlsError(mediaError);
  console.log(profile);
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link href="/friends" className="text-sm text-muted-foreground hover:underline">
          Back to friends
        </Link>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-full border bg-muted">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={`${profile.display_name ?? profile.handle} avatar`}
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          <div>
            <h1 className="text-3xl font-semibold">
              {profile.display_name ?? profile.handle}
            </h1>
            <p className="text-muted-foreground">@{profile.handle}</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          {privateRestricted ? (
            <p>Friends only.</p>
          ) : privateError ? (
            <p>Unable to load private details.</p>
          ) : privateData ? (
            <>
              <p>{privateData.bio ?? "No bio yet."}</p>
              {privateData.website ? (
                <p>
                  <span className="font-medium text-foreground">Website:</span>{" "}
                  {privateData.website}
                </p>
              ) : null}
              {privateData.location ? (
                <p>
                  <span className="font-medium text-foreground">Location:</span>{" "}
                  {privateData.location}
                </p>
              ) : null}
            </>
          ) : (
            <p>No private details yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent media</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          {mediaRestricted ? (
            <p>Friends only.</p>
          ) : mediaError ? (
            <p>Unable to load media list.</p>
          ) : mediaData && mediaData.length > 0 ? (
            <ul className="space-y-2">
              {mediaData.map((item, index) => (
                <li key={`${item.media_items?.title ?? "item"}-${index}`}>
                  <span className="font-medium text-foreground">
                    {item.media_items?.title ?? "Untitled"}
                  </span>{" "}
                  <span>
                    {item.media_items?.type ? `(${item.media_items.type})` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No media updates yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
