import { UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { FollowButton, MessageButton, PersonRow } from "@/components/people/person";
import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, LinkTabs, PageHeader } from "@/components/ui/misc";
import { requireOnboardedUser } from "@/lib/auth/session";
import { privateMetadata } from "@/lib/seo";
import { removeConnectionAction, respondConnectionAction } from "@/server/actions/network";
import { getSuggestedPeople, listConnectionRequests, listConnections, listFollowers, listFollowing } from "@/server/queries/people";

export const metadata = privateMetadata("My network");

const TABS = ["connections", "requests", "following", "followers", "discover"] as const;
type Tab = (typeof TABS)[number];

function List({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent>
        <ul className="divide-y [&>li]:py-4 [&>li:first-child]:pt-0 [&>li:last-child]:pb-0">{children}</ul>
      </CardContent>
    </Card>
  );
}

export default async function NetworkPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireOnboardedUser();
  const params = await searchParams;
  const tab: Tab = TABS.includes(params.tab as Tab) ? (params.tab as Tab) : "connections";

  const [connections, received, sent, following, followers, suggested] = await Promise.all([
    tab === "connections" ? listConnections(user.id) : [],
    listConnectionRequests(user.id, "received"),
    tab === "requests" ? listConnectionRequests(user.id, "sent") : [],
    tab === "following" || tab === "followers" || tab === "discover" ? listFollowing(user.id, 500) : [],
    tab === "followers" ? listFollowers(user.id) : [],
    tab === "discover" ? getSuggestedPeople(user.id, 24) : [],
  ]);
  const followingIds = new Set(following.map((p) => p.id));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <PageHeader title="My network" description="Connections are mutual and request-based. Following is one-way and needs no approval." />
      <LinkTabs
        current={tab}
        items={[
          { value: "connections", label: "Connections", href: "/network" },
          { value: "requests", label: "Requests", href: "/network?tab=requests", count: received.length },
          { value: "following", label: "Following", href: "/network?tab=following" },
          { value: "followers", label: "Followers", href: "/network?tab=followers" },
          { value: "discover", label: "Discover", href: "/network?tab=discover" },
        ]}
      />

      {tab === "connections" ? (
        connections.length === 0 ? (
          <Card>
            <EmptyState
              icon={Users}
              title="No connections yet"
              description="Connect with people you have worked, studied or competed with."
              action={
                <Button asChild>
                  <Link href="/network?tab=discover">
                    <UserPlus /> Find people
                  </Link>
                </Button>
              }
            />
          </Card>
        ) : (
          <List>
            {connections.map((person) => (
              <li key={person.connectionId}>
                <PersonRow
                  person={person}
                  action={
                    <>
                      <MessageButton userId={person.id} />
                      <ActionButton action={removeConnectionAction} input={{ id: person.connectionId }} confirm={`Remove ${person.name} from your connections?`} variant="ghost" size="sm">
                        Remove
                      </ActionButton>
                    </>
                  }
                />
              </li>
            ))}
          </List>
        )
      ) : null}

      {tab === "requests" ? (
        <>
          <section className="space-y-2">
            <h2 className="px-1 text-[13px] font-semibold uppercase tracking-wider text-subtle">Received</h2>
            {received.length === 0 ? (
              <Card>
                <EmptyState title="No pending requests" description="Requests from other members will appear here." />
              </Card>
            ) : (
              <List>
                {received.map((person) => (
                  <li key={person.connectionId}>
                    <PersonRow
                      person={person}
                      note={person.note}
                      action={
                        <>
                          <ActionButton action={respondConnectionAction} input={{ id: person.connectionId, accept: true }} size="sm">
                            Accept
                          </ActionButton>
                          <ActionButton action={respondConnectionAction} input={{ id: person.connectionId, accept: false }} variant="outline" size="sm">
                            Decline
                          </ActionButton>
                        </>
                      }
                    />
                  </li>
                ))}
              </List>
            )}
          </section>
          {sent.length > 0 ? (
            <section className="space-y-2">
              <h2 className="px-1 text-[13px] font-semibold uppercase tracking-wider text-subtle">Sent</h2>
              <List>
                {sent.map((person) => (
                  <li key={person.connectionId}>
                    <PersonRow
                      person={person}
                      action={
                        <ActionButton action={removeConnectionAction} input={{ id: person.connectionId }} variant="outline" size="sm">
                          Withdraw
                        </ActionButton>
                      }
                    />
                  </li>
                ))}
              </List>
            </section>
          ) : null}
        </>
      ) : null}

      {tab === "following" || tab === "followers" || tab === "discover" ? (
        (() => {
          const people = tab === "following" ? following : tab === "followers" ? followers : suggested;
          if (people.length === 0) {
            return (
              <Card>
                <EmptyState
                  icon={Users}
                  title={tab === "following" ? "You are not following anyone yet" : tab === "followers" ? "No followers yet" : "No suggestions right now"}
                  description={
                    tab === "discover"
                      ? "As more members join in your domains, suggestions will appear here."
                      : tab === "followers"
                        ? "Share your work — people follow members whose posts they find useful."
                        : "Follow practitioners to see their posts in your Following feed."
                  }
                />
              </Card>
            );
          }
          return (
            <List>
              {people.map((person) => (
                <li key={person.id}>
                  <PersonRow person={person} action={<FollowButton userId={person.id} following={tab === "following" || followingIds.has(person.id)} />} />
                </li>
              ))}
            </List>
          );
        })()
      ) : null}
    </div>
  );
}
