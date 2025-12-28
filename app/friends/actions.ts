"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return { supabase, userId: user.id };
}

function revalidateFriendPaths(profileHandle?: string | null) {
  revalidatePath("/friends");
  if (profileHandle) {
    revalidatePath(`/u/${profileHandle}`);
  }
}

export async function sendFriendRequest(formData: FormData) {
  const addresseeId = formData.get("addresseeId")?.toString();
  const profileHandle = formData.get("profileHandle")?.toString();

  if (!addresseeId) {
    return;
  }

  const { supabase, userId } = await requireUserId();

  await supabase.from("friendships").insert({
    requester_id: userId,
    addressee_id: addresseeId,
    status: "pending",
  });

  revalidateFriendPaths(profileHandle);
}

export async function acceptFriendRequest(formData: FormData) {
  const requesterId = formData.get("requesterId")?.toString();
  const profileHandle = formData.get("profileHandle")?.toString();

  if (!requesterId) {
    return;
  }

  const { supabase, userId } = await requireUserId();

  await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("requester_id", requesterId)
    .eq("addressee_id", userId);

  revalidateFriendPaths(profileHandle);
}

export async function declineFriendRequest(formData: FormData) {
  const requesterId = formData.get("requesterId")?.toString();
  const profileHandle = formData.get("profileHandle")?.toString();

  if (!requesterId) {
    return;
  }

  const { supabase, userId } = await requireUserId();

  await supabase
    .from("friendships")
    .delete()
    .eq("requester_id", requesterId)
    .eq("addressee_id", userId);

  revalidateFriendPaths(profileHandle);
}

export async function cancelFriendRequest(formData: FormData) {
  const addresseeId = formData.get("addresseeId")?.toString();
  const profileHandle = formData.get("profileHandle")?.toString();

  if (!addresseeId) {
    return;
  }

  const { supabase, userId } = await requireUserId();

  await supabase
    .from("friendships")
    .delete()
    .eq("requester_id", userId)
    .eq("addressee_id", addresseeId);

  revalidateFriendPaths(profileHandle);
}
