import { Suspense } from "react";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MediaStatusControl } from "@/components/media/status-control";
import {
  searchCatalog,
  type CatalogItem,
  type MediaType,
} from "@/lib/services/catalog/search";
import { getCurrentUser } from "@/lib/services/auth";
import { getCatalogStatusMap } from "@/lib/services/media";
import { type MediaStatus } from "@/lib/types/media";

type MediaRow = CatalogItem;

const mediaTypes = [
  { value: "all", label: "All types" },
  { value: "tv", label: "TV" },
  { value: "movie", label: "Movies" },
  { value: "game", label: "Games" },
  { value: "book", label: "Books" },
];

async function MediaSearchContent({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; type?: string }>;
}) {
  noStore();
  const user = await getCurrentUser();
  const resolvedSearchParams = await searchParams;
  const query =
    typeof resolvedSearchParams?.q === "string"
      ? resolvedSearchParams.q.trim()
      : "";
  const typeFilter =
    typeof resolvedSearchParams?.type === "string" ? resolvedSearchParams.type : "all";

  let results: MediaRow[] = [];
  let groupedResults: Map<MediaType, MediaRow[]> | null = null;
  let statusMap = new Map<string, MediaStatus | null>();

  if (query.length > 0) {
    const typesToFetch: MediaType[] =
      typeFilter === "all"
        ? ["movie", "tv", "game", "book"]
        : [typeFilter as MediaType];
    const responses = await Promise.all(
      typesToFetch.map(async (type) => {
        try {
          return (await searchCatalog(type as MediaType, query)) as MediaRow[];
        } catch {
          return [];
        }
      }),
    );

    results = responses.flat().slice(0, 24);
    if (typeFilter === "all") {
      groupedResults = new Map<MediaType, MediaRow[]>(
        typesToFetch.map((type, index) => [type, responses[index] ?? []]),
      );
    }
  }

  if (user && query.length > 0) {
    const displayedItems =
      typeFilter === "all" && groupedResults
        ? Array.from(groupedResults.values()).flat()
        : results;
    statusMap = await getCatalogStatusMap(user.id, displayedItems);
  }

  const buildDetailHref = (item: MediaRow) =>
    `/catalog/${item.type}/${item.source}/${encodeURIComponent(item.external_id)}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Search your media</h1>
        <p className="text-muted-foreground">
          Find shows, movies, games, and books in your tracker.
        </p>
      </div>

      <form className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
        <Input
          name="q"
          placeholder="Search by title"
          defaultValue={query}
          aria-label="Search by title"
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
        <Button type="submit">Search</Button>
      </form>

      {query.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Start with a title, then filter by media type.
          </CardContent>
        </Card>
      ) : results.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No results yet. Try a different search.
          </CardContent>
        </Card>
      ) : typeFilter === "all" && groupedResults ? (
        <div className="flex flex-col gap-6">
          {mediaTypes
            .filter((mediaType) => mediaType.value !== "all")
            .map((mediaType) => {
              const items =
                groupedResults?.get(mediaType.value as MediaType) ?? [];
              if (items.length === 0) {
                return null;
              }
              return (
                <section key={mediaType.value} className="flex flex-col gap-3">
                  <h2 className="text-xl font-semibold">{mediaType.label}</h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((item) => (
                      <Card
                        key={`${item.source}-${item.external_id}`}
                        className="overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <Link href={buildDetailHref(item)} className="block">
                          <div className="h-40 w-full bg-muted">
                            {item.poster_url ? (
                              <img
                                src={item.poster_url}
                                alt={`${item.title} poster`}
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                        </Link>
                        <CardContent className="flex flex-col gap-1 p-4">
                          <p className="text-sm text-muted-foreground uppercase tracking-wide">
                            {item.type}
                            {item.release_date ? ` · ${item.release_date}` : ""}
                          </p>
                          <Link
                            href={buildDetailHref(item)}
                            className="text-base font-semibold hover:underline"
                          >
                            {item.title}
                          </Link>
                            {user ? (
                              <MediaStatusControl
                                catalogItem={item}
                                currentStatus={
                                  statusMap.get(`${item.source}:${item.external_id}`) ??
                                  null
                                }
                                revalidatePath="/"
                              />
                            ) : null}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              );
            })}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((item) => (
            <Card
              key={`${item.source}-${item.external_id}`}
              className="overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <Link href={buildDetailHref(item)} className="block">
                <div className="h-40 w-full bg-muted">
                  {item.poster_url ? (
                    <img
                      src={item.poster_url}
                      alt={`${item.title} poster`}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
              </Link>
              <CardContent className="flex flex-col gap-1 p-4">
                <p className="text-sm text-muted-foreground uppercase tracking-wide">
                  {item.type}
                  {item.release_date ? ` · ${item.release_date}` : ""}
                </p>
                <Link
                  href={buildDetailHref(item)}
                  className="text-base font-semibold hover:underline"
                >
                  {item.title}
                </Link>
                {user ? (
                  <MediaStatusControl
                    catalogItem={item}
                    currentStatus={
                      statusMap.get(`${item.source}:${item.external_id}`) ?? null
                    }
                    revalidatePath="/"
                  />
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function MediaSearchFallback() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="h-8 w-56 rounded bg-muted" />
        <div className="h-4 w-80 rounded bg-muted" />
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
        <div className="h-9 rounded bg-muted" />
        <div className="h-9 rounded bg-muted" />
        <div className="h-9 rounded bg-muted" />
      </div>
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Loading search...
        </CardContent>
      </Card>
    </div>
  );
}

export default function Home({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; type?: string }>;
}) {
  return (
    <Suspense fallback={<MediaSearchFallback />}>
      <MediaSearchContent searchParams={searchParams} />
    </Suspense>
  );
}
