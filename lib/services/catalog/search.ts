export type MediaType = "movie" | "tv" | "game" | "book";

export type CatalogItem = {
  type: MediaType;
  source: string;
  external_id: string;
  title: string;
  description: string | null;
  release_date: string | null;
  poster_url: string | null;
  payload: unknown;
};

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

type TmdbSearchItem = {
  id?: number | string;
  title?: string;
  name?: string;
  overview?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  poster_path?: string | null;
};

type IgdbSearchItem = {
  id?: number | string;
  name?: string;
  summary?: string | null;
  first_release_date?: number | null;
  cover?: { image_id?: string | null } | null;
};

type OpenLibraryDoc = {
  key?: string;
  title?: string;
  first_sentence?: string | { value?: string } | null;
  first_publish_year?: string | number | null;
  cover_i?: number | null;
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

type TmdbSearchResponse = { results?: unknown[] };
type OpenLibrarySearchResponse = { docs?: unknown[] };
type GoogleBooksSearchResponse = { items?: unknown[] };

function normalizeTmdbSearch(type: "movie" | "tv", results: unknown[]): CatalogItem[] {
  return results.map((result) => {
    const item = result as TmdbSearchItem;
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
  });
}

function igdbImageUrl(imageId?: string | null) {
  if (!imageId) return null;
  return `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`;
}

function normalizeIgdbSearch(results: unknown[]): CatalogItem[] {
  return results.map((result) => {
    const item = result as IgdbSearchItem;
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
  });
}

function normalizeOpenLibrarySearch(results: unknown[]): CatalogItem[] {
  return results.map((result) => {
    const doc = result as OpenLibraryDoc;
    const firstSentence =
      typeof doc.first_sentence === "string"
        ? doc.first_sentence
        : doc.first_sentence?.value ?? null;
    return {
    type: "book",
    source: "openlibrary",
    external_id: doc.key ?? "unknown",
    title: doc.title ?? "Untitled",
    description: firstSentence,
    release_date: toDateString(doc.first_publish_year),
    poster_url: doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
      : null,
    payload: doc,
    };
  });
}

function normalizeGoogleBooksSearch(items: unknown[]): CatalogItem[] {
  return items.map((result) => {
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
  });
}

export async function searchCatalog(type: MediaType, q: string) {
  if (type === "movie" || type === "tv") {
    const tmdbKey = process.env.TMDB_API_KEY;
    if (!tmdbKey) {
      throw new CatalogError("TMDB_API_KEY not set", 500);
    }

    const endpoint =
      type === "movie"
        ? "https://api.themoviedb.org/3/search/movie"
        : "https://api.themoviedb.org/3/search/tv";

    const response = await fetch(
      `${endpoint}?query=${encodeURIComponent(q)}&include_adult=false&language=en-US&page=1&api_key=${tmdbKey}`,
      { next: { revalidate: 60 } },
    );

    if (!response.ok) {
      throw new CatalogError("TMDB search failed", 502);
    }

    const data = (await response.json()) as TmdbSearchResponse;
    return normalizeTmdbSearch(type, data.results ?? []);
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
      body: `search "${q.replace(/"/g, '\\"')}"; fields id,name,summary,first_release_date,cover.image_id; limit 20;`,
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      throw new CatalogError("IGDB search failed", 502);
    }

    const data = (await response.json()) as unknown;
    return normalizeIgdbSearch(Array.isArray(data) ? data : []);
  }

  const openLibraryResponse = await fetch(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=10`,
    { next: { revalidate: 60 } },
  );

  if (!openLibraryResponse.ok) {
    throw new CatalogError("Open Library search failed", 502);
  }

  const openLibraryData = (await openLibraryResponse.json()) as OpenLibrarySearchResponse;
  let results = normalizeOpenLibrarySearch(openLibraryData.docs ?? []);
  const allowGoogleFallback =
    process.env.CATALOG_GOOGLE_BOOKS_FALLBACK === "true";

  if (allowGoogleFallback && results.length < 3) {
    const googleKey = process.env.GOOGLE_BOOKS_API_KEY;
    if (!googleKey) {
      throw new CatalogError("GOOGLE_BOOKS_API_KEY not set", 500);
    }

    const googleResponse = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&key=${googleKey}&maxResults=10`,
      { next: { revalidate: 60 } },
    );

    if (!googleResponse.ok) {
      throw new CatalogError("Google Books search failed", 502);
    }

    const googleData = (await googleResponse.json()) as GoogleBooksSearchResponse;
    results = normalizeGoogleBooksSearch(googleData.items ?? []);
  }

  return results;
}

export function isCatalogError(error: unknown): error is CatalogError {
  return error instanceof CatalogError;
}
