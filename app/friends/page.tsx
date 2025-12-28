import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getFriendsPageData } from "@/lib/services/friends";
import { type FriendRow, type FriendsTab, type ProfileSummary } from "@/lib/types/friends";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  sendFriendRequest,
} from "./actions";

const tabs = [
  { id: "search", label: "Search" },
  { id: "requests", label: "Requests" },
  { id: "friends", label: "Friends" },
];

function ProfileCard({
  profile,
  actions,
}: {
  profile: ProfileSummary;
  actions?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 overflow-hidden rounded-full border bg-muted">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={`${profile.display_name ?? profile.handle} avatar`}
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          <div className="flex flex-col">
            <Link
              href={`/u/${profile.handle}`}
              className="text-lg font-semibold hover:underline"
            >
              {profile.display_name ?? profile.handle}
            </Link>
            <span className="text-sm text-muted-foreground">
              @{profile.handle}
            </span>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </CardContent>
    </Card>
  );
}

async function FriendsContent({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; q?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const tab = (tabs.some((item) => item.id === resolvedSearchParams?.tab)
    ? resolvedSearchParams?.tab
    : "search") as FriendsTab;
  const query =
    typeof resolvedSearchParams?.q === "string"
      ? resolvedSearchParams.q.trim()
      : "";

  const {
    user,
    friendRows,
    searchResults,
    incomingRequests,
    outgoingRequests,
    acceptedFriends,
  } = await getFriendsPageData(tab, query);

  if (!user) {
    redirect("/auth/login");
  }

  const friendshipMap = new Map<string, FriendRow>();
  (friendRows ?? []).forEach((row) => {
    const otherId =
      row.requester_id === user.id ? row.addressee_id : row.requester_id;
    friendshipMap.set(otherId, row);
  });

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Friends</h1>
        <p className="text-muted-foreground">
          Find people, manage requests, and organize your friend list.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <Button
            key={item.id}
            variant={tab === item.id ? "default" : "outline"}
            asChild
          >
            <Link href={`/friends?tab=${item.id}`}>{item.label}</Link>
          </Button>
        ))}
      </div>

      {tab === "search" ? (
        <div className="flex flex-col gap-4">
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
            action="/friends"
            method="get"
          >
            <input type="hidden" name="tab" value="search" />
            <Input
              name="q"
              placeholder="Search by handle or display name"
              defaultValue={query}
            />
            <Button type="submit">Search</Button>
          </form>

          {query.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Enter a handle or display name to start searching.
              </CardContent>
            </Card>
          ) : searchResults.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                No matching profiles yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {searchResults.map((profile) => {
                const relationship = friendshipMap.get(profile.id);
                const isRequester = relationship?.requester_id === user.id;

                return (
                  <ProfileCard
                    key={profile.id}
                    profile={profile}
                    actions={
                      relationship ? (
                        <Button variant="secondary" disabled>
                          {relationship.status === "accepted"
                            ? "Friends"
                            : relationship.status === "blocked"
                              ? "Blocked"
                              : isRequester
                                ? "Requested"
                                : "Respond in Requests"}
                        </Button>
                      ) : (
                        <form action={sendFriendRequest}>
                          <input
                            type="hidden"
                            name="addresseeId"
                            value={profile.id}
                          />
                          <input
                            type="hidden"
                            name="profileHandle"
                            value={profile.handle}
                          />
                          <Button type="submit">Add friend</Button>
                        </form>
                      )
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {tab === "requests" ? (
        <div className="grid gap-6">
          <div className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold">Incoming</h2>
            {incomingRequests.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  No incoming requests.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {incomingRequests.map((row) =>
                  row.requester ? (
                    <ProfileCard
                      key={`${row.requester_id}:${row.addressee_id}`}
                      profile={row.requester}
                      actions={
                        <>
                          <form action={acceptFriendRequest}>
                            <input
                              type="hidden"
                              name="requesterId"
                              value={row.requester_id}
                            />
                            <input
                              type="hidden"
                              name="profileHandle"
                              value={row.requester.handle}
                            />
                            <Button type="submit">Accept</Button>
                          </form>
                          <form action={declineFriendRequest}>
                            <input
                              type="hidden"
                              name="requesterId"
                              value={row.requester_id}
                            />
                            <input
                              type="hidden"
                              name="profileHandle"
                              value={row.requester.handle}
                            />
                            <Button type="submit" variant="outline">
                              Decline
                            </Button>
                          </form>
                        </>
                      }
                    />
                  ) : null,
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold">Outgoing</h2>
            {outgoingRequests.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  No outgoing requests.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {outgoingRequests.map((row) =>
                  row.addressee ? (
                    <ProfileCard
                      key={`${row.requester_id}:${row.addressee_id}`}
                      profile={row.addressee}
                      actions={
                        <form action={cancelFriendRequest}>
                          <input
                            type="hidden"
                            name="addresseeId"
                            value={row.addressee_id}
                          />
                          <input
                            type="hidden"
                            name="profileHandle"
                            value={row.addressee.handle}
                          />
                          <Button type="submit" variant="outline">
                            Cancel
                          </Button>
                        </form>
                      }
                    />
                  ) : null,
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {tab === "friends" ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Friends</h2>
          {acceptedFriends.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                No friends yet. Search and send a request to get started.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {acceptedFriends.map((profile) => (
                <ProfileCard key={profile.id} profile={profile} />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function FriendsPageFallback() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="h-8 w-40 rounded bg-muted" />
        <div className="h-4 w-72 rounded bg-muted" />
      </div>
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <div key={item.id} className="h-9 w-24 rounded bg-muted" />
        ))}
      </div>
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Loading friends...
        </CardContent>
      </Card>
    </div>
  );
}

export default function FriendsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; q?: string }>;
}) {
  return (
    <Suspense fallback={<FriendsPageFallback />}>
      <FriendsContent searchParams={searchParams} />
    </Suspense>
  );
}
