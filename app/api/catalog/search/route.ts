import { NextResponse } from "next/server";
import {
  isCatalogError,
  searchCatalog,
  type MediaType,
} from "@/lib/services/catalog/search";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") as MediaType | null;
  const q = url.searchParams.get("q");

  if (!type || !q) {
    return NextResponse.json(
      { error: "Missing required query params: type, q" },
      { status: 400 },
    );
  }

  if (!["movie", "tv", "game", "book"].includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  try {
    const results = await searchCatalog(type, q);
    return NextResponse.json({ results });
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
