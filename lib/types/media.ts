import { type MediaType } from "@/lib/services/catalog/search";

export type MediaStatus =
  | "interested"
  | "in_progress"
  | "completed"
  | "on_hold"
  | "dropped";

export type MediaItemRow = {
  id: number;
  type: MediaType;
  source: string;
  external_id: string;
  title: string;
  release_date: string | null;
  poster_url: string | null;
};

export type MyMediaEntry = {
  media: MediaItemRow;
  status: MediaStatus | null;
  rating: number | null;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};
