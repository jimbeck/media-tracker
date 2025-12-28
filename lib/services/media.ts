import { createClient } from "@/lib/supabase/server";
import { type MediaType } from "@/lib/services/catalog/search";
import { type CatalogItem } from "@/lib/services/catalog/search";
import {
  type MediaItemRow,
  type MediaStatus,
  type MyMediaEntry,
} from "@/lib/types/media";

type UserMediaRow = {
  status: MediaStatus | null;
  rating: number | null;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  media_items: MediaItemRow | MediaItemRow[] | null;
};

type SortKey = "recent" | "title" | "release" | "added";

const normalizeMediaItem = (
  value: MediaItemRow | MediaItemRow[] | null,
): MediaItemRow | null => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

type MediaStatusRow = {
  status: MediaStatus | null;
  media_items: { source: string; external_id: string } | null;
};

async function fetchMyMediaEntries(
  supabase: Awaited<ReturnType<typeof createClient>>,
  options: {
    userId: string;
    typeFilter: MediaType | "all";
    statusFilter: MediaStatus | "all";
    sort: SortKey;
  },
) {
  let query = supabase
    .from("user_media")
    .select(
      "status, rating, notes, started_at, completed_at, created_at, updated_at, media_items!inner(id, type, source, external_id, title, release_date, poster_url)",
    )
    .eq("user_id", options.userId);

  if (options.typeFilter !== "all") {
    query = query.eq("media_items.type", options.typeFilter);
  }

  if (options.statusFilter !== "all") {
    query = query.eq("status", options.statusFilter);
  }

  switch (options.sort) {
    case "title":
      query = query.order("title", {
        ascending: true,
        foreignTable: "media_items",
      });
      break;
    case "release":
      query = query.order("release_date", {
        ascending: false,
        foreignTable: "media_items",
      });
      break;
    case "added":
      query = query.order("created_at", { ascending: false });
      break;
    case "recent":
    default:
      query = query.order("updated_at", { ascending: false });
      break;
  }

  const { data } = await query.returns<UserMediaRow[]>();
  return (
    data
      ?.map((row) => {
        const media = normalizeMediaItem(row.media_items);
        if (!media) return null;
        return {
          media,
          status: row.status,
          rating: row.rating,
          notes: row.notes,
          started_at: row.started_at,
          completed_at: row.completed_at,
          created_at: row.created_at,
          updated_at: row.updated_at,
        } satisfies MyMediaEntry;
      })
      .filter((entry): entry is MyMediaEntry => entry !== null) ?? []
  );
}

export async function getMyMediaPageData(options: {
  typeFilter: MediaType | "all";
  statusFilter: MediaStatus | "all";
  sort: SortKey;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, entries: [] as MyMediaEntry[] };
  }

  const entries = await fetchMyMediaEntries(supabase, {
    userId: user.id,
    typeFilter: options.typeFilter,
    statusFilter: options.statusFilter,
    sort: options.sort,
  });

  return { user: { id: user.id }, entries };
}

export async function getCatalogStatusMap(
  userId: string,
  items: CatalogItem[],
) {
  if (items.length === 0) {
    return new Map<string, MediaStatus | null>();
  }

  const supabase = await createClient();
  const sources = Array.from(new Set(items.map((item) => item.source)));
  const externalIds = Array.from(new Set(items.map((item) => item.external_id)));

  const { data } = await supabase
    .from("user_media")
    .select("status, media_items!inner(source, external_id)")
    .eq("user_id", userId)
    .in("media_items.source", sources)
    .in("media_items.external_id", externalIds)
    .returns<MediaStatusRow[]>();

  const map = new Map<string, MediaStatus | null>();
  (data ?? []).forEach((row) => {
    const media = row.media_items;
    if (!media) return;
    map.set(`${media.source}:${media.external_id}`, row.status);
  });

  return map;
}
