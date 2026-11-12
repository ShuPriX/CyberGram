import { AtSign, BriefcaseBusiness, CalendarDays, Code, ExternalLink, Globe, GraduationCap, Link2, Lock, Mail, MapPin, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FeedList } from "@/components/feed/feed-list";
import { ConnectButton, FollowButton, MessageButton } from "@/components/people/person";
import { AchievementItem } from "@/components/profile/achievements";
import { ProfileReport } from "@/components/profile/profile-report";
import { SkillBadges } from "@/components/shared/fields";
import { JsonLd } from "@/components/shared/json-ld";
import { EXTERNAL_LINK_PROPS, RichText } from "@/components/shared/rich-text";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, Section } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { APP_NAME, countryName, EMPLOYMENT_TYPE_LABELS, ROLE_LABELS } from "@/lib/constants";
import { leavingHref } from "@/lib/security/link-safety";
import { absoluteUrl, pageMetadata } from "@/lib/seo";
import { displayHost, formatCount, formatDate } from "@/lib/utils";
import { getProfileByUsername } from "@/server/queries/people";
import { getFeed } from "@/server/queries/posts";
import { getCategoryNames } from "@/server/queries/taxonomy";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const username = (await params).username.toLowerCase();
  // Built for an anonymous visitor: private and members-only profiles expose nothing here.
  const data = await getProfileByUsername(username, null);
  if (!data) return { title: "Member not found", robots: { index: false, follow: false } };
  if (data.access !== "full") return { title: data.user.name, robots: { index: false, follow: false } };
  return pageMetadata({
    title: `${data.user.name}${data.profile.headline ? ` — ${data.profile.headline}` : ""}`,
    description: data.profile.bio?.slice(0, 200) ?? `${data.user.name} is on ${APP_NAME}, the professional network for cybersecurity.`,
    path: `/u/${data.user.username}`,
    type: "profile",
    noindex: !data.profile.indexable,
  });
}

function ExternalLinkRow({ href, icon, label }: { href: string; icon: React.ReactNode; label?: string }) {
  return (
    <a href={leavingHref(href)} className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-primary [&_svg]:size-4" {...EXTERNAL_LINK_PROPS}>
      {icon}
      {label ?? displayHost(href)}
    </a>
  );
}

const period = (start: string, end: string | null, current: boolean) => `${formatDate(start, "monthYear")} – ${current || !end ? "Present" : formatDate(end, "monthYear")}`;

export default async function ProfilePage({ params }: Props) {
  const username = (await params).username.toLowerCase();
  const viewer = await getCurrentUser();
  const data = await getProfileByUsername(username, viewer ? { id: viewer.id, role: viewer.role } : null);
  if (!data) notFound();
  const { user, profile, relationship } = data;
  const isSelf = relationship.isSelf;
  const limited = data.access === "limited";
  const place = [profile.location, countryName(profile.country)].filter(Boolean).join(", ");

  const header = (
    <Card className="overflow-hidden">
      <div className="aspect-[4/1] max-h-52 w-full bg-primary-soft">
        {profile.coverFileId && !limited ? <img src={`/api/files/${profile.coverFileId}`} alt="" className="size-full object-cover" /> : null}
      </div>
      <div className="px-5 pb-5">
        <div className="-mt-10 flex flex-wrap items-end justify-between gap-3 sm:-mt-12">
          <Avatar name={user.name} fileId={profile.avatarFileId} size="2xl" className="border-4 border-card bg-card" />
          <div className="flex flex-wrap items-center gap-2 pb-1">
            {isSelf ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/profile/edit">
                  <Pencil /> Edit profile
                </Link>
              </Button>
            ) : viewer ? (
              <>
                <ConnectButton userId={user.id} name={user.name} relationship={relationship} />
                <FollowButton userId={user.id} following={relationship.following} />
                {profile.messagePolicy !== "none" ? <MessageButton userId={user.id} /> : null}
                <ProfileReport userId={user.id} />
              </>
            ) : (
              <Button asChild size="sm">
                <Link href={`/login?next=/u/${user.username}`}>Sign in to connect</Link>
              </Button>
            )}
          </div>
        </div>
        <div className="mt-3">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">
            {user.name}
            {user.role === "moderator" || user.role === "admin" || user.role === "super_admin" ? <Badge variant="info">{ROLE_LABELS[user.role]}</Badge> : null}
            {data.showOpenToWork ? <Badge variant="success">Open to work</Badge> : null}
          </h1>
          <p className="text-[13px] text-subtle">@{user.username}{relationship.followsYou ? " · Follows you" : ""}</p>
          {profile.headline && !limited ? <p className="mt-1.5 text-[14.5px] leading-snug">{profile.headline}</p> : null}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground">
            {!limited && (profile.currentTitle || profile.currentCompany) ? (
              <span className="inline-flex items-center gap-1.5">
                <BriefcaseBusiness className="size-4" aria-hidden="true" />
                {[profile.currentTitle, profile.currentCompany].filter(Boolean).join(" at ")}
              </span>
            ) : null}
            {place && !limited ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden="true" /> {place}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden="true" /> Joined {formatDate(user.createdAt, "monthYear")}
            </span>
          </div>
          <p className={limited ? "hidden" : "mt-2.5 flex flex-wrap gap-x-4 text-[13px]"}>
            <span><strong className="font-semibold">{formatCount(profile.connectionCount)}</strong> <span className="text-muted-foreground">connections</span></span>
            <span><strong className="font-semibold">{formatCount(profile.followerCount)}</strong> <span className="text-muted-foreground">followers</span></span>
            <span><strong className="font-semibold">{formatCount(profile.followingCount)}</strong> <span className="text-muted-foreground">following</span></span>
          </p>
        </div>
      </div>
    </Card>
  );

  if (limited) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4">
        {header}
        <Card>
          <EmptyState
            icon={Lock}
            title={profile.visibility === "private" ? "This profile is visible to connections only" : "Sign in to view this profile"}
            description={profile.visibility === "private" ? `Connect with ${user.name.split(" ")[0]} to see their experience, achievements and posts.` : `${user.name.split(" ")[0]} shares their profile with CyberGram members.`}
            action={
              !viewer ? (
                <Button asChild>
                  <Link href={`/login?next=/u/${user.username}`}>Sign in</Link>
                </Button>
              ) : undefined
            }
          />
        </Card>
      </div>
    );
  }

  const [activity, categories] = await Promise.all([
    getFeed({ viewer: viewer ? { id: viewer.id, role: viewer.role } : null, authorId: user.id, limit: 6 }),
    getCategoryNames(),
  ]);
  const links = [
    profile.website && <ExternalLinkRow key="w" href={profile.website} icon={<Globe />} />,
    profile.githubUrl && <ExternalLinkRow key="g" href={profile.githubUrl} icon={<Code />} label="GitHub" />,
    profile.linkedinUrl && <ExternalLinkRow key="l" href={profile.linkedinUrl} icon={<Link2 />} label="LinkedIn" />,
    profile.twitterUrl && <ExternalLinkRow key="t" href={profile.twitterUrl} icon={<AtSign />} label="X / Twitter" />,
  ].filter(Boolean);
  const showEmail = profile.showEmail && viewer !== null;

  return (
    <div className="mx-auto grid max-w-[1600px] gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      {profile.visibility === "public" && profile.indexable ? (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "ProfilePage",
            dateCreated: user.createdAt.toISOString(),
            mainEntity: {
              "@type": "Person",
              name: user.name,
              alternateName: user.username,
              description: profile.headline ?? undefined,
              jobTitle: profile.currentTitle ?? undefined,
              worksFor: profile.currentCompany ? { "@type": "Organization", name: profile.currentCompany } : undefined,
              url: absoluteUrl(`/u/${user.username}`),
              image: profile.avatarFileId ? absoluteUrl(`/api/files/${profile.avatarFileId}`) : undefined,
              sameAs: [profile.website, profile.githubUrl, profile.linkedinUrl, profile.twitterUrl].filter(Boolean),
            },
          }}
        />
      ) : null}

      <div className="min-w-0 space-y-4">
        {header}

        {profile.bio ? (
          <Section title="About">
            <RichText text={profile.bio} className="text-[14px] leading-relaxed" />
          </Section>
        ) : isSelf ? (
          <Section title="About">
            <p className="text-[13px] text-muted-foreground">
              Tell people what you work on and what you are looking for.{" "}
              <Link href="/profile/edit" className="font-medium text-primary hover:underline">Add a bio</Link>
            </p>
          </Section>
        ) : null}

        {data.achievements.length > 0 || isSelf ? (
          <Section
            title="Achievements"
            description="Self-reported unless marked verified. Verified items were checked by a moderator against their evidence link."
            action={isSelf ? <Button asChild variant="outline" size="sm"><Link href="/achievements">Manage</Link></Button> : undefined}
          >
            {data.achievements.length > 0 ? (
              <ul className="space-y-5">
                {data.achievements.map((achievement) => (
                  <li key={achievement.id}>
                    <AchievementItem achievement={achievement} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-muted-foreground">Add certifications, CTF placements, CVEs, bounties and talks — each with an evidence link.</p>
            )}
          </Section>
        ) : null}

        {data.experiences.length > 0 ? (
          <Section title="Experience">
            <ul className="space-y-5">
              {data.experiences.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                    <BriefcaseBusiness className="size-[18px]" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[14px] font-semibold leading-snug">{item.title}</h3>
                    <p className="text-[13px]">
                      {item.company}
                      {item.employmentType ? ` · ${EMPLOYMENT_TYPE_LABELS[item.employmentType]}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {period(item.startDate, item.endDate, item.isCurrent)}
                      {item.location ? ` · ${item.location}` : ""}
                    </p>
                    {item.description ? <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">{item.description}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {data.projects.length > 0 ? (
          <Section title="Projects">
            <ul className="space-y-5">
              {data.projects.map((project) => (
                <li key={project.id}>
                  <h3 className="text-[14px] font-semibold">{project.name}</h3>
                  {project.description ? <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">{project.description}</p> : null}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                    {project.repoUrl ? <ExternalLinkRow href={project.repoUrl} icon={<Code />} /> : null}
                    {project.url ? <ExternalLinkRow href={project.url} icon={<ExternalLink />} /> : null}
                    {project.tags.map((tag) => (
                      <Badge key={tag} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {data.educations.length > 0 ? (
          <Section title="Education">
            <ul className="space-y-5">
              {data.educations.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                    <GraduationCap className="size-[18px]" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[14px] font-semibold leading-snug">{item.school}</h3>
                    <p className="text-[13px]">{[item.degree, item.field].filter(Boolean).join(", ")}</p>
                    {item.startYear || item.endYear ? <p className="text-xs text-muted-foreground">{[item.startYear, item.endYear].filter(Boolean).join(" – ")}</p> : null}
                    {item.description ? <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">{item.description}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <section aria-labelledby="activity" className="space-y-3">
          <h2 id="activity" className="px-1 text-[15px] font-semibold">Activity</h2>
          <FeedList
            initial={activity}
            request={{ authorId: user.id }}
            context={{ viewer: viewer ? { name: viewer.name, avatarFileId: viewer.avatarFileId } : null, categories }}
            emptyTitle={isSelf ? "You have not posted yet" : "No posts yet"}
            emptyDescription={isSelf ? "Share a write-up, a project or a question from your feed." : `When ${user.name.split(" ")[0]} posts, it will appear here.`}
          />
        </section>
      </div>

      <aside className="min-w-0 space-y-4">
        {profile.skills.length > 0 ? (
          <Section title="Skills">
            <SkillBadges skills={profile.skills} />
          </Section>
        ) : null}
        {profile.domains.length > 0 ? (
          <Section title="Domains">
            <ul className="flex flex-wrap gap-1.5">
              {profile.domains.map((slug) => (
                <li key={slug}>
                  <Link href={`/explore/${slug}`} className="inline-flex rounded-md bg-primary-soft px-2 py-0.5 text-xs font-medium leading-5 text-primary-soft-foreground hover:opacity-80">
                    {categories[slug] ?? slug}
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
        {links.length > 0 || showEmail ? (
          <Section title="Links">
            <div className="flex flex-col gap-2.5">
              {links}
              {showEmail ? (
                <a href={`mailto:${user.email}`} className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-primary">
                  <Mail className="size-4" aria-hidden="true" /> {user.email}
                </a>
              ) : null}
            </div>
          </Section>
        ) : null}
        {profile.yearsExperience !== null ? (
          <Section title="Experience level">
            <p className="text-[13px] text-muted-foreground">
              {profile.yearsExperience === 0 ? "Student or early career" : `${profile.yearsExperience} year${profile.yearsExperience === 1 ? "" : "s"} in security`}
            </p>
          </Section>
        ) : null}
      </aside>
    </div>
  );
}
