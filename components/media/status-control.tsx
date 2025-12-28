"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMediaStatus } from "@/app/actions/media";
import { type MediaStatus } from "@/lib/types/media";
import { type CatalogItem } from "@/lib/services/catalog/search";
import { cn } from "@/lib/utils";

const controlOptions: Array<{ value: "untracked" | MediaStatus; label: string }> = [
  { value: "untracked", label: "Untracked" },
  { value: "interested", label: "Interested" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];

type MediaStatusControlProps =
  | {
      mediaItemId: number;
      catalogItem?: never;
      currentStatus?: MediaStatus | null;
      revalidatePath?: string;
      className?: string;
    }
  | {
      mediaItemId?: never;
      catalogItem: CatalogItem;
      currentStatus?: MediaStatus | null;
      revalidatePath?: string;
      className?: string;
    };

export function MediaStatusControl({
  mediaItemId,
  catalogItem,
  currentStatus,
  revalidatePath,
  className,
}: MediaStatusControlProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleChange = () => {
    startTransition(async () => {
      if (!formRef.current) return;
      const formData = new FormData(formRef.current);
      await updateMediaStatus(formData);
      router.refresh();
    });
  };

  return (
    <form
      ref={formRef}
      className={cn("flex flex-wrap items-center gap-2", className)}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onSubmit={(event) => event.preventDefault()}
    >
      {typeof mediaItemId === "number" ? (
        <input type="hidden" name="mediaItemId" value={String(mediaItemId)} />
      ) : null}
      {catalogItem ? (
        <>
          <input type="hidden" name="type" value={catalogItem.type} />
          <input type="hidden" name="source" value={catalogItem.source} />
          <input
            type="hidden"
            name="externalId"
            value={catalogItem.external_id}
          />
          <input type="hidden" name="title" value={catalogItem.title} />
          <input
            type="hidden"
            name="description"
            value={catalogItem.description ?? ""}
          />
          <input
            type="hidden"
            name="releaseDate"
            value={catalogItem.release_date ?? ""}
          />
          <input
            type="hidden"
            name="posterUrl"
            value={catalogItem.poster_url ?? ""}
          />
        </>
      ) : null}
      {revalidatePath ? (
        <input type="hidden" name="revalidatePath" value={revalidatePath} />
      ) : null}
      <label className="text-xs uppercase tracking-wide text-muted-foreground">
        Status
      </label>
      <select
        name="status"
        defaultValue={currentStatus ?? "untracked"}
        onChange={handleChange}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
      >
        {controlOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {isPending ? (
        <span className="text-xs text-muted-foreground">Saving...</span>
      ) : null}
    </form>
  );
}
