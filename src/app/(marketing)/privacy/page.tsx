import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/shared/legal";
import { APP_NAME } from "@/lib/constants";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description: `How ${APP_NAME} collects, uses, shares and protects personal data, and the controls members have over it.`,
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="10 November 2026"
      intro={`This policy explains what ${APP_NAME} collects, why, who can see it and the choices you have. It describes how the product actually behaves; the operator of this deployment should have it reviewed against the laws that apply to them before launch.`}
    >
      <h2>1. What we collect</h2>
      <h3>Information you give us</h3>
      <ul>
        <li><strong>Account:</strong> your name, email address, handle and password. Passwords are stored only as Argon2id hashes; we cannot read them.</li>
        <li><strong>Profile:</strong> headline, bio, location, experience, education, projects, skills, achievements, links and images you choose to add.</li>
        <li><strong>Content:</strong> posts, articles, comments, messages, reports and anything you upload.</li>
        <li><strong>Hiring:</strong> résumés you upload, applications you submit, saved jobs and job alerts. If you manage an organisation: its page, listings and notes on applicants.</li>
      </ul>
      <h3>Information collected automatically</h3>
      <ul>
        <li><strong>Security logs:</strong> IP address, browser type and time for sign-ins and sensitive actions, kept to detect abuse and investigate incidents.</li>
        <li><strong>A session cookie:</strong> one strictly necessary, HTTP-only cookie that keeps you signed in. We do not use advertising or cross-site tracking cookies.</li>
      </ul>
      <h3>Sign-in with GitHub or Google</h3>
      <p>If you use a provider to sign in, we receive your name, verified email address and the provider’s identifier for your account. We do not receive your password or access to your repositories, mail or files.</p>

      <h2>2. How we use it</h2>
      <ul>
        <li>To provide the service: show your profile and content, deliver messages and notifications, and process applications.</li>
        <li>To personalise your feed and job suggestions using the domains and skills on your profile.</li>
        <li>To keep the platform safe: rate limiting, spam and scam detection, link screening, file scanning and moderation.</li>
        <li>To send transactional email — verification, password reset, security alerts — and the notification emails you have enabled.</li>
      </ul>
      <p>We do not sell personal data, and we do not use your content to train third-party models.</p>

      <h2>3. Who can see what</h2>
      <ul>
        <li><strong>Your profile</strong> follows the visibility you choose: public, members only or connections only. You decide whether search engines may index it.</li>
        <li><strong>Posts</strong> are public or connections-only, as you set for each post. Posts in communities are public.</li>
        <li><strong>Résumés</strong> are private. A file is available only to you and to the hiring team of an organisation you send it to with an application.</li>
        <li><strong>Open to work</strong> is shown publicly or only to recruiters at verified organisations, as you choose.</li>
        <li><strong>Candidate discovery</strong> is opt-in and limited to recruiters at organisations our team has verified.</li>
        <li><strong>Direct messages</strong> are visible to the participants. Moderators only see a message when it has been reported.</li>
        <li><strong>Your email address</strong> is hidden unless you choose to show it to signed-in members.</li>
      </ul>

      <h2>4. Sharing</h2>
      <p>We share personal data only with: employers you apply to (your profile, the résumé you chose and your note); infrastructure providers that host the service, store files and deliver email on our behalf, under contract; and authorities when the law requires it.</p>

      <h2>5. Uploads</h2>
      <p>Images are re-encoded when uploaded, which removes embedded metadata such as GPS location. Files are checked by type and scanned for malware; files that fail are rejected and not stored.</p>

      <h2>6. Retention</h2>
      <ul>
        <li>Profile and content are kept until you delete them or close your account.</li>
        <li>When you close your account, your profile data, experience, achievements and sessions are deleted and your posts are hidden. A minimal record is kept so that reports, moderation decisions and security logs remain intact.</li>
        <li>Security and audit logs are kept for a limited period for investigation, then removed.</li>
        <li>Expired sessions and used verification tokens are purged automatically.</li>
      </ul>

      <h2>7. Your choices and rights</h2>
      <ul>
        <li>Edit your profile and delete your content at any time.</li>
        <li>Change visibility, indexing, messaging and recruiter settings under <Link href="/settings/privacy">Settings → Privacy</Link>.</li>
        <li>Choose which notifications you receive under <Link href="/settings/notifications">Settings → Notifications</Link>.</li>
        <li>Review and end active sessions under <Link href="/settings/security">Settings → Security</Link>.</li>
        <li>Close your account under <Link href="/settings">Settings → Account</Link>.</li>
      </ul>
      <p>Depending on where you live, you may also have rights to access, correct, export or erase your data, or to object to certain uses. Use the <Link href="/contact">contact page</Link> and choose “Privacy or data request”.</p>

      <h2>8. Security</h2>
      <p>We protect accounts with strong password hashing, breached-password checks, rate limiting, server-side sessions and encrypted transport. No system is perfectly secure; if we learn of a breach affecting your data we will tell you and the relevant authorities as the law requires.</p>

      <h2>9. Children</h2>
      <p>{APP_NAME} is a professional service and is not directed at children under 16. We do not knowingly collect their data.</p>

      <h2>10. Changes</h2>
      <p>If we make material changes to this policy we will notify members in the app before they take effect.</p>
    </LegalPage>
  );
}
