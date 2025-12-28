export type FriendRow = {
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "blocked";
};

export type ProfileSummary = {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type FriendsTab = "search" | "requests" | "friends";
