"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { type MediaStatus } from "@/lib/types/media";
import { type MediaType } from "@/lib/services/catalog/search";

const allowedStatuses: MediaStatus[] = [
  "interested",
  "in_progress",
  "completed",
  "on_hold",
  "dropped",
];

const parseStatus = (value: string | null): MediaStatus | "untracked" | null => {
  if (!value) return null;
  if (value === "untracked") return "untracked";
  return allowedStatuses.includes(value as MediaStatus)
    ? (value as MediaStatus)
    : null;
};

const parseType = (value: string | null): MediaType | null => {
  if (!value) return null;
  return ["movie", "tv", "game", "book"].includes(value)
    ? (value as MediaType)
    : null;
};

const parseSource = (value: string | null): string | null => {
  if (!value) return null;
  return ["tmdb", "igdb", "openlibrary", "google_books", "manual"].includes(value)
    ? value
    : null;
};

const emptyToNull = (value: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const toDateString = (value: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
};

export async function updateMediaStatus(formData: FormData) {
  const mediaItemIdValue = formData.get("mediaItemId")?.toString();
  const statusValue = formData.get("status")?.toString() ?? null;
  const revalidateTarget = formData.get("revalidatePath")?.toString();
  const typeValue = formData.get("type")?.toString() ?? null;
  const sourceValue = formData.get("source")?.toString() ?? null;
  const externalIdValue = formData.get("externalId")?.toString() ?? null;
  const titleValue = formData.get("title")?.toString() ?? null;
  const descriptionValue = formData.get("description")?.toString() ?? null;
  const releaseDateValue = formData.get("releaseDate")?.toString() ?? null;
  const posterUrlValue = formData.get("posterUrl")?.toString() ?? null;

  const mediaItemId = mediaItemIdValue ? Number(mediaItemIdValue) : NaN;
  const status = parseStatus(statusValue);

  if ((!mediaItemId || Number.isNaN(mediaItemId)) && !externalIdValue) {
    return;
  }

  if (!status) {
    return;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  let resolvedMediaItemId = mediaItemId;

  if (status === "untracked") {
    if (!resolvedMediaItemId || Number.isNaN(resolvedMediaItemId)) {
      const source = parseSource(sourceValue);
      const externalId = emptyToNull(externalIdValue);
      if (!source || !externalId) {
        return;
      }

      const { data: mediaItem } = await supabase
        .from("media_items")
        .select("id")
        .eq("source", source)
        .eq("external_id", externalId)
        .maybeSingle();

      if (!mediaItem?.id) {
        return;
      }

      resolvedMediaItemId = mediaItem.id;
    }

    await supabase
      .from("user_media")
      .delete()
      .eq("user_id", user.id)
      .eq("media_item_id", resolvedMediaItemId);

    revalidatePath(revalidateTarget ?? "/my-media");
    return;
  }

  if (!resolvedMediaItemId || Number.isNaN(resolvedMediaItemId)) {
    const type = parseType(typeValue);
    const source = parseSource(sourceValue);
    const externalId = emptyToNull(externalIdValue);
    const title = emptyToNull(titleValue);
    const releaseDate = toDateString(releaseDateValue);

    if (!type || !source || !externalId || !title) {
      return;
    }
    const { data: mediaItem, error: mediaItemError } = await supabase
      .from("media_items")
      .upsert(
        {
          type,
          source,
          external_id: externalId,
          title,
          description: emptyToNull(descriptionValue),
          release_date: releaseDate,
          poster_url: emptyToNull(posterUrlValue),
          payload: null,
          last_fetched_at: new Date().toISOString(),
        },
        { onConflict: "source,external_id" },
      )
      .select("id")
      .maybeSingle();

    let resolvedId = mediaItem?.id ?? null;
    if (!resolvedId) {
      const { data: existingMediaItem } = await supabase
        .from("media_items")
        .select("id")
        .eq("source", source)
        .eq("external_id", externalId)
        .maybeSingle();
      resolvedId = existingMediaItem?.id ?? null;
    }

    if (!resolvedId) {
      if (mediaItemError) {
        console.error("media_items upsert failed", mediaItemError);
      }
      return;
    }

    resolvedMediaItemId = resolvedId;
  }

  const { data: existing } = await supabase
    .from("user_media")
    .select("started_at, completed_at")
    .eq("user_id", user.id)
    .eq("media_item_id", resolvedMediaItemId)
    .maybeSingle();

  const today = new Date().toISOString().slice(0, 10);
  let started_at = existing?.started_at ?? null;
  let completed_at = existing?.completed_at ?? null;

  if (status === "interested") {
    started_at = null;
    completed_at = null;
  } else if (status === "in_progress") {
    if (!started_at) started_at = today;
    completed_at = null;
  } else if (status === "completed") {
    if (!started_at) started_at = today;
    if (!completed_at) completed_at = today;
  } else if (status === "on_hold" || status === "dropped") {
    if (!started_at) started_at = today;
    completed_at = null;
  }

  await supabase.from("user_media").upsert(
    {
      user_id: user.id,
      media_item_id: resolvedMediaItemId,
      status,
      started_at,
      completed_at,
    },
    { onConflict: "user_id,media_item_id" },
  );

  revalidatePath(revalidateTarget ?? "/my-media");
}
