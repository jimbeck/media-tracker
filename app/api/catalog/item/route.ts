import { NextResponse } from "next/server";
import {
  getCatalogItem,
  isCatalogError,
  type CatalogSource,
} from "@/lib/services/catalog/item";
import { type MediaType } from "@/lib/services/catalog/search";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") as MediaType | null;
  const source = url.searchParams.get("source");
  const externalId = url.searchParams.get("external_id");

  const isValidSource = (value: string | null): value is CatalogSource => {
    if (!value) return false;
    return ["tmdb", "igdb", "openlibrary", "google_books"].includes(value);
  };

  if (!type || !isValidSource(source) || !externalId) {
    return NextResponse.json(
      { error: "Missing required query params: type, source, external_id" },
      { status: 400 },
    );
  }

  try {
    const item = await getCatalogItem(type, source, externalId);
    return NextResponse.json(item);
  } catch (error) {
    if (isCatalogError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
