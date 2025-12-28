import { createClient } from "@/lib/supabase/server";
import { type FriendRow, type FriendsTab, type ProfileSummary } from "@/lib/types/friends";

type IncomingRow = FriendRow & {
  requester: ProfileSummary | ProfileSummary[] | null;
};

type OutgoingRow = FriendRow & {
  addressee: ProfileSummary | ProfileSummary[] | null;
};

type AcceptedRow = FriendRow & {
  requester: ProfileSummary | ProfileSummary[] | null;
  addressee: ProfileSummary | ProfileSummary[] | null;
};

type FriendsPageData = {
  user: { id: string } | null;
  friendRows: FriendRow[];
  searchResults: ProfileSummary[];
  incomingRequests: Array<FriendRow & { requester: ProfileSummary | null }>;
  outgoingRequests: Array<FriendRow & { addressee: ProfileSummary | null }>;
  acceptedFriends: ProfileSummary[];
};

const normalizeProfile = (
  value: ProfileSummary | ProfileSummary[] | null,
): ProfileSummary | null => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

export async function getFriendsPageData(
  tab: FriendsTab,
  query: string,
): Promise<FriendsPageData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      friendRows: [],
      searchResults: [],
      incomingRequests: [],
      outgoingRequests: [],
      acceptedFriends: [],
    };
  }

  const { data: friendRows } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id, status")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .returns<FriendRow[]>();

  let searchResults: ProfileSummary[] = [];
  if (tab === "search" && query.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, handle, display_name, avatar_url")
      .or(`handle.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(20)
      .returns<ProfileSummary[]>();

    searchResults = (data ?? []).filter((profile) => profile.id !== user.id);
  }

  let incomingRequests: Array<FriendRow & { requester: ProfileSummary | null }> =
    [];
  let outgoingRequests: Array<FriendRow & { addressee: ProfileSummary | null }> =
    [];

  if (tab === "requests") {
    const { data: incoming } = await supabase
      .from("friendships")
      .select(
        "requester_id, addressee_id, status, requester:profiles!friendships_requester_id_fkey(id, handle, display_name, avatar_url)",
      )
      .eq("addressee_id", user.id)
      .eq("status", "pending")
      .returns<IncomingRow[]>();

    const { data: outgoing } = await supabase
      .from("friendships")
      .select(
        "requester_id, addressee_id, status, addressee:profiles!friendships_addressee_id_fkey(id, handle, display_name, avatar_url)",
      )
      .eq("requester_id", user.id)
      .eq("status", "pending")
      .returns<OutgoingRow[]>();

    incomingRequests =
      incoming?.map((row) => ({
        ...row,
        requester: normalizeProfile(row.requester),
      })) ?? [];
    outgoingRequests =
      outgoing?.map((row) => ({
        ...row,
        addressee: normalizeProfile(row.addressee),
      })) ?? [];
  }

  let acceptedFriends: ProfileSummary[] = [];

  if (tab === "friends") {
    const { data } = await supabase
      .from("friendships")
      .select(
        "requester_id, addressee_id, status, requester:profiles!friendships_requester_id_fkey(id, handle, display_name, avatar_url), addressee:profiles!friendships_addressee_id_fkey(id, handle, display_name, avatar_url)",
      )
      .eq("status", "accepted")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .returns<AcceptedRow[]>();

    acceptedFriends =
      data
        ?.map((row) => {
          const friend =
            row.requester_id === user.id ? row.addressee : row.requester;
          return normalizeProfile(friend);
        })
        .filter((friend): friend is ProfileSummary => friend !== null) ?? [];
  }

  return {
    user: { id: user.id },
    friendRows: friendRows ?? [],
    searchResults,
    incomingRequests,
    outgoingRequests,
    acceptedFriends,
  };
}
