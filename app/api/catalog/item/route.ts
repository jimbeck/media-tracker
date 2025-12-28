import { NextResponse } from "next/server";
import { getCatalogItem, isCatalogError } from "@/lib/catalog/item";
import { type MediaType } from "@/lib/catalog/search";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") as MediaType | null;
  const source = url.searchParams.get("source");
  const externalId = url.searchParams.get("external_id");

  if (!type || !source || !externalId) {
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
