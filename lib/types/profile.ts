export type Profile = {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  discoverable: boolean;
};

export type MediaItemSummary = {
  title: string | null;
  type: string | null;
};

export type UserMediaRow = {
  media_items: MediaItemSummary | MediaItemSummary[] | null;
};
