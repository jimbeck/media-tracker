import { type CatalogItem, type MediaType } from "@/lib/services/catalog/search";

export type CatalogSource = "tmdb" | "igdb" | "openlibrary" | "google_books";

class CatalogError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

function toDateString(value: string | number | null | undefined) {
  if (!value) return null;
  return String(value);
}

type TmdbItem = {
  id?: number | string;
  title?: string;
  name?: string;
  overview?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  poster_path?: string | null;
};

type IgdbItem = {
  id?: number | string;
  name?: string;
  summary?: string | null;
  first_release_date?: number | null;
  cover?: { image_id?: string | null } | null;
};

type OpenLibraryWork = {
  title?: string;
  description?: string | { value?: string };
  first_publish_date?: string | null;
  covers?: number[];
};

type GoogleBooksItem = {
  id?: string | number;
  volumeInfo?: {
    title?: string;
    description?: string;
    publishedDate?: string;
    imageLinks?: { thumbnail?: string };
  };
};

function normalizeTmdbItem(type: "movie" | "tv", result: unknown): CatalogItem {
  const item = result as TmdbItem;
  return {
    type,
    source: "tmdb",
    external_id: String(item.id),
    title: item.title ?? item.name ?? "Untitled",
    description: item.overview ?? null,
    release_date: toDateString(item.release_date ?? item.first_air_date),
    poster_url: item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : null,
    payload: item,
  };
}

function igdbImageUrl(imageId?: string | null) {
  if (!imageId) return null;
  return `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`;
}

function normalizeIgdbItem(result: unknown): CatalogItem {
  const item = result as IgdbItem;
  return {
    type: "game",
    source: "igdb",
    external_id: String(item.id),
    title: item.name ?? "Untitled",
    description: item.summary ?? null,
    release_date: item.first_release_date
      ? new Date(item.first_release_date * 1000).toISOString().slice(0, 10)
      : null,
    poster_url: igdbImageUrl(item.cover?.image_id),
    payload: item,
  };
}

function normalizeOpenLibraryItem(result: unknown, externalId: string): CatalogItem {
  const item = result as OpenLibraryWork;
  const description =
    typeof item.description === "string"
      ? item.description
      : item.description?.value ?? null;
  const coverId = Array.isArray(item.covers) ? item.covers[0] : null;

  return {
    type: "book",
    source: "openlibrary",
    external_id: externalId,
    title: item.title ?? "Untitled",
    description,
    release_date: toDateString(item.first_publish_date),
    poster_url: coverId
      ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
      : null,
    payload: item,
  };
}

function normalizeGoogleBooksItem(result: unknown): CatalogItem {
  const item = result as GoogleBooksItem;
  const info = item.volumeInfo ?? {};
  return {
    type: "book",
    source: "google_books",
    external_id: String(item.id),
    title: info.title ?? "Untitled",
    description: info.description ?? null,
    release_date: toDateString(info.publishedDate),
    poster_url: info.imageLinks?.thumbnail?.replace("http://", "https://") ?? null,
    payload: item,
  };
}

export async function getCatalogItem(
  type: MediaType,
  source: CatalogSource,
  externalId: string,
) {
  const decodedExternalId = decodeURIComponent(externalId);
  if (type === "movie" || type === "tv") {
    const tmdbKey = process.env.TMDB_API_KEY;
    if (!tmdbKey) {
      throw new CatalogError("TMDB_API_KEY not set", 500);
    }

    const endpoint =
      type === "movie"
        ? `https://api.themoviedb.org/3/movie/${decodedExternalId}`
        : `https://api.themoviedb.org/3/tv/${decodedExternalId}`;

    const response = await fetch(
      `${endpoint}?language=en-US&api_key=${tmdbKey}`,
      { next: { revalidate: 60 } },
    );

    if (!response.ok) {
      throw new CatalogError("TMDB item fetch failed", 502);
    }

    const data = (await response.json()) as unknown;
    return normalizeTmdbItem(type, data);
  }

  if (type === "game") {
    const igdbClientId = process.env.IGDB_CLIENT_ID;
    const igdbClientSecret = process.env.IGDB_CLIENT_SECRET;
    const igdbAccessToken = process.env.IGDB_ACCESS_TOKEN;

    if (!igdbClientId || (!igdbClientSecret && !igdbAccessToken)) {
      throw new CatalogError("IGDB credentials not set", 500);
    }

    let accessToken = igdbAccessToken;
    if (!accessToken) {
      const tokenResponse = await fetch(
        `https://id.twitch.tv/oauth2/token?client_id=${igdbClientId}&client_secret=${igdbClientSecret}&grant_type=client_credentials`,
        { method: "POST" },
      );

      if (!tokenResponse.ok) {
        throw new CatalogError("IGDB token request failed", 502);
      }

      const tokenData = await tokenResponse.json();
      accessToken = tokenData.access_token;
    }

    const response = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": igdbClientId,
        Authorization: `Bearer ${accessToken}`,
      },
      body: `fields id,name,summary,first_release_date,cover.image_id; where id = ${Number(
        decodedExternalId,
      )}; limit 1;`,
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      throw new CatalogError("IGDB item fetch failed", 502);
    }

    const data = (await response.json()) as unknown;
    const item = Array.isArray(data) ? data[0] : null;
    if (!item) {
      throw new CatalogError("IGDB item not found", 404);
    }
    return normalizeIgdbItem(item);
  }

  if (type === "book" && source === "openlibrary") {
    const normalizedId = decodedExternalId.startsWith("/works/")
      ? decodedExternalId
      : `/works/${decodedExternalId}`;
    const response = await fetch(
      `https://openlibrary.org${normalizedId}.json`,
      { next: { revalidate: 60 } },
    );

    if (!response.ok) {
      throw new CatalogError("Open Library item fetch failed", 502);
    }

    const data = (await response.json()) as unknown;
    return normalizeOpenLibraryItem(data, normalizedId);
  }

  if (type === "book" && source === "google_books") {
    const googleKey = process.env.GOOGLE_BOOKS_API_KEY;
    if (!googleKey) {
      throw new CatalogError("GOOGLE_BOOKS_API_KEY not set", 500);
    }

    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes/${decodedExternalId}?key=${googleKey}`,
      { next: { revalidate: 60 } },
    );

    if (!response.ok) {
      throw new CatalogError("Google Books item fetch failed", 502);
    }

    const data = (await response.json()) as unknown;
    return normalizeGoogleBooksItem(data);
  }

  throw new CatalogError("Unsupported type/source", 400);
}

export function isCatalogError(error: unknown): error is CatalogError {
  return error instanceof CatalogError;
}
