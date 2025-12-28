import Link from "next/link";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MediaStatusControl } from "@/components/media/status-control";
import { getMyMediaPageData } from "@/lib/services/media";
import { type MediaStatus, type MyMediaEntry } from "@/lib/types/media";
import { type MediaType } from "@/lib/services/catalog/search";

const mediaTypes = [
  { value: "all", label: "All types" },
  { value: "tv", label: "TV" },
  { value: "movie", label: "Movies" },
  { value: "game", label: "Games" },
  { value: "book", label: "Books" },
];

const statusOptions = [
  { value: "all", label: "All statuses" },
  { value: "interested", label: "Interested" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];

const sortOptions = [
  { value: "recent", label: "Recently updated" },
  { value: "added", label: "Recently added" },
  { value: "title", label: "Title A-Z" },
  { value: "release", label: "Newest release" },
];

const buildDetailHref = (entry: MyMediaEntry) =>
  `/catalog/${entry.media.type}/${entry.media.source}/${encodeURIComponent(
    entry.media.external_id,
  )}`;

async function MyMediaContent({
  searchParams,
}: {
  searchParams?: Promise<{ type?: string; status?: string; sort?: string; q?: string }>;
}) {
  noStore();
  const resolvedSearchParams = await searchParams;
  const typeFilter = mediaTypes.some((item) => item.value === resolvedSearchParams?.type)
    ? (resolvedSearchParams?.type as MediaType | "all")
    : "all";
  const statusFilter = statusOptions.some(
    (item) => item.value === resolvedSearchParams?.status,
  )
    ? (resolvedSearchParams?.status as MediaStatus | "all")
    : "all";
  const sort = sortOptions.some((item) => item.value === resolvedSearchParams?.sort)
    ? (resolvedSearchParams?.sort as
        | "recent"
        | "added"
        | "title"
        | "release")
    : "recent";
  const query =
    typeof resolvedSearchParams?.q === "string"
      ? resolvedSearchParams.q.trim()
      : "";

  const { user, entries: initialEntries } = await getMyMediaPageData({
    typeFilter,
    statusFilter,
    sort,
  });

  if (!user) {
    redirect("/auth/login");
  }

  let entries = initialEntries;
  if (query.length > 0) {
    const lowered = query.toLowerCase();
    entries = entries.filter((entry) =>
      entry.media.title.toLowerCase().includes(lowered),
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">My media</h1>
        <p className="text-muted-foreground">
          Filter and sort your tracking list.
        </p>
      </div>

      <form className="grid gap-3 lg:grid-cols-[1.2fr_180px_180px_200px_auto]">
        <Input
          name="q"
          placeholder="Search your titles"
          defaultValue={query}
          aria-label="Search your titles"
        />
        <select
          name="type"
          defaultValue={typeFilter}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {mediaTypes.map((mediaType) => (
            <option key={mediaType.value} value={mediaType.value}>
              {mediaType.label}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={statusFilter}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {statusOptions.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
        <select
          name="sort"
          defaultValue={sort}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Button type="submit">Apply</Button>
      </form>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No media matches these filters yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <Card key={`${entry.media.source}-${entry.media.external_id}`}>
              <CardContent className="flex gap-4 p-4">
                <Link href={buildDetailHref(entry)} className="h-24 w-16 flex-none">
                  <div className="h-full w-full overflow-hidden rounded bg-muted">
                    {entry.media.poster_url ? (
                      <img
                        src={entry.media.poster_url}
                        alt={`${entry.media.title} poster`}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                </Link>
                  <div className="flex flex-1 flex-col gap-2">
                    <div>
                      <Link
                        href={buildDetailHref(entry)}
                        className="text-base font-semibold hover:underline"
                    >
                      {entry.media.title}
                    </Link>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      {entry.media.type}
                      {entry.media.release_date ? ` · ${entry.media.release_date}` : ""}
                    </p>
                  </div>
                  <MediaStatusControl
                    mediaItemId={entry.media.id}
                    currentStatus={entry.status}
                    revalidatePath="/my-media"
                  />
                  {entry.notes ? (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {entry.notes}
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function MyMediaFallback() {
  return (
    <Card>
      <CardContent className="p-6 text-sm text-muted-foreground">
        Loading your media...
      </CardContent>
    </Card>
  );
}

export default function MyMediaPage({
  searchParams,
}: {
  searchParams?: Promise<{ type?: string; status?: string; sort?: string; q?: string }>;
}) {
  return (
    <Suspense fallback={<MyMediaFallback />}>
      <MyMediaContent searchParams={searchParams} />
    </Suspense>
  );
}
