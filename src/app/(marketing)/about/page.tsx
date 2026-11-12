import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/shared/json-ld";
import { LegalPage } from "@/components/shared/legal";
import { APP_NAME } from "@/lib/constants";
import { breadcrumbLd, pageMetadata, platformOrganizationLd } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: `About ${APP_NAME}`,
  description: `${APP_NAME} is a professional network and career platform built exclusively for cybersecurity: a place to share work, build credibility with evidence, and find current, honestly-sourced jobs.`,
  path: "/about",
});

export default function AboutPage() {
  return (
    <LegalPage
      title={`About ${APP_NAME}`}
      intro="A professional network and career platform built exclusively for the people who defend, break and build secure systems."
    >
      <JsonLd data={platformOrganizationLd()} />
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "About", path: "/about" }])} />

      <h2>Why it exists</h2>
      <p>
        Security work is hard to show on a general-purpose network. A CTF placement, a coordinated disclosure, a detection you wrote or a talk you gave says more about you than a job
        title — but those rarely fit a standard profile, and the people who can judge them are scattered across a dozen platforms.
      </p>
      <p>
        {APP_NAME} brings that together: a feed organised by security domain, profiles built around achievements with evidence, communities for focused discussion, and a hiring hub
        that only shows roles that are open today.
      </p>

      <h2>What we hold ourselves to</h2>
      <ul>
        <li>
          <strong>No invented activity.</strong> We do not fabricate members, companies, job listings, statistics or testimonials. Anything created for demonstration is labelled as
          demo data and never appears in production.
        </li>
        <li>
          <strong>Honest sourcing for jobs.</strong> Every listing says whether it was posted by the company, imported from the employer’s own feed, or submitted by a member. Imported
          roles are re-checked daily and removed when they close.
        </li>
        <li>
          <strong>Verification means something.</strong> Achievements and organisations are self-reported until a person on our team has checked the evidence. We never mark anything
          verified automatically.
        </li>
        <li>
          <strong>Responsible disclosure only.</strong> Share what you are authorised to share. Live targets, credentials, personal data and unpatched details without coordination
          do not belong here.
        </li>
        <li>
          <strong>Your data is yours.</strong> You control who sees your profile, whether search engines index it, whether recruiters can find you, and who can message you. Résumés
          are private and only reach employers you apply to.
        </li>
      </ul>

      <h2>Who it is for</h2>
      <p>
        Students and career changers finding their first role; analysts, engineers, testers and researchers sharing their work; and security teams, consultancies and startups that
        want to hire people who can show what they have done.
      </p>

      <h2>How the hiring hub stays current</h2>
      <p>
        Roles reach the hub in three ways. Organisations post them directly through a company page. Administrators connect employers’ public job boards and feeds that we are
        permitted to use, which are synchronised at least once a day. Members can submit a role they found, which a moderator checks against the employer’s own posting. Listings
        expire automatically, and a role that disappears from its source is closed the next time we check.
      </p>

      <h2>Get involved</h2>
      <p>
        <Link href="/register">Create a profile</Link>, <Link href="/jobs">browse open roles</Link>, or <Link href="/companies/new">add your organisation</Link>. Questions, press
        and partnership enquiries are welcome through the <Link href="/contact">contact page</Link>.
      </p>
    </LegalPage>
  );
}
