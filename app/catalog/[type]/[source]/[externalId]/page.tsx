import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getCatalogItem,
  isCatalogError,
  type CatalogSource,
} from "@/lib/services/catalog/item";
import { type MediaType } from "@/lib/services/catalog/search";

type PageParams = {
  type: MediaType;
  source: CatalogSource;
  externalId: string;
};

async function CatalogItemContent({ params }: { params: Promise<PageParams> }) {
  noStore();
  const { type, source, externalId } = await params;

  try {
    const item = await getCatalogItem(type, source, externalId);

    return (
      <div className="flex flex-col gap-6">
        <div>
          <Button asChild variant="ghost" className="px-0">
            <Link href="/">Back to search</Link>
          </Button>
        </div>

        <Card className="overflow-hidden">
          <div className="grid gap-6 p-6 md:grid-cols-[220px_1fr]">
            <div className="h-64 w-full overflow-hidden rounded-md bg-muted md:h-80">
              {item.poster_url ? (
                <img
                  src={item.poster_url}
                  alt={`${item.title} poster`}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm uppercase tracking-wide text-muted-foreground">
                  {item.type}
                  {item.release_date ? ` · ${item.release_date}` : ""}
                </p>
                <h1 className="text-3xl font-semibold">{item.title}</h1>
              </div>

              <Card>
                <CardContent className="p-4 text-sm text-muted-foreground">
                  {item.description ?? "No description available yet."}
                </CardContent>
              </Card>
            </div>
          </div>
        </Card>
      </div>
    );
  } catch (error) {
    if (isCatalogError(error) && error.status === 404) {
      notFound();
    }
  }

  return (
    <Card>
      <CardContent className="p-6 text-sm text-muted-foreground">
        Unable to load this item right now.
      </CardContent>
    </Card>
  );
}

function CatalogItemFallback() {
  return (
    <Card>
      <CardContent className="p-6 text-sm text-muted-foreground">
        Loading item...
      </CardContent>
    </Card>
  );
}

export default function CatalogItemPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  return (
    <Suspense fallback={<CatalogItemFallback />}>
      <CatalogItemContent params={params} />
    </Suspense>
  );
}
