import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { Suspense } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProfilePageData } from "@/lib/services/profile";

async function ProfileContent({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  noStore();
  const resolvedParams = await params;

  const {
    profile,
    privateData,
    privateError,
    privateRestricted,
    mediaData,
    mediaError,
    mediaRestricted,
  } = await getProfilePageData(resolvedParams.handle);

  if (!profile) {
    notFound();
  }
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
              {mediaData.map((item, index) => {
                const mediaItem = Array.isArray(item.media_items)
                  ? item.media_items[0] ?? null
                  : item.media_items;
                return (
                  <li key={`${mediaItem?.title ?? "item"}-${index}`}>
                    <span className="font-medium text-foreground">
                      {mediaItem?.title ?? "Untitled"}
                    </span>{" "}
                    <span>{mediaItem?.type ? `(${mediaItem.type})` : ""}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>No media updates yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProfileFallback() {
  return (
    <Card>
      <CardContent className="p-6 text-sm text-muted-foreground">
        Loading profile...
      </CardContent>
    </Card>
  );
}

export default function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  return (
    <Suspense fallback={<ProfileFallback />}>
      <ProfileContent params={params} />
    </Suspense>
  );
}
