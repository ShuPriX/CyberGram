import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/shared/legal";
import { APP_NAME } from "@/lib/constants";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Terms of Service",
  description: `The rules for using ${APP_NAME}: accounts, acceptable use, responsible disclosure, job listings, content and moderation.`,
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="10 November 2026"
      intro={`These terms govern your use of ${APP_NAME}. They are written to be read. The operator of this deployment should have them reviewed by counsel for their jurisdiction before launch.`}
    >
      <h2>1. Your account</h2>
      <ul>
        <li>You must be at least 16 and able to enter into this agreement.</li>
        <li>Use your real name or the name you are known by professionally. One person, one account.</li>
        <li>Keep your credentials safe. You are responsible for activity on your account; tell us promptly if you think it has been compromised.</li>
        <li>Do not impersonate another person, organisation or our staff, or use names, badges or symbols that imply verification you do not have.</li>
      </ul>

      <h2>2. Acceptable use</h2>
      <p>{APP_NAME} is for professional exchange about security. You agree not to:</p>
      <ul>
        <li>Share malware, phishing kits, stolen data, credentials, or links intended to compromise other people.</li>
        <li>Publish personal data about others, or details of live, unpatched vulnerabilities in systems you do not own without the owner’s coordination.</li>
        <li>Solicit, offer or coordinate unauthorised access to any system.</li>
        <li>Harass, threaten or discriminate against anyone.</li>
        <li>Spam, scrape, automate account creation or interfere with the service or other members’ use of it.</li>
        <li>Post false or misleading claims about your credentials, employer or achievements.</li>
      </ul>

      <h2>3. Security research and disclosure</h2>
      <p>We welcome write-ups, research and disclosures. Only publish findings you are authorised to share — your own lab work, public programmes whose rules permit it, or issues that have been fixed and coordinated with the owner. You are responsible for what you publish. We may remove content that puts others at risk.</p>

      <h2>4. Achievements and verification</h2>
      <p>Achievements are self-reported unless marked verified. Verification is performed by our team against the evidence you provide and can be withdrawn if a claim turns out to be inaccurate. Submitting false evidence may lead to removal of your account.</p>

      <h2>5. Job listings and hiring</h2>
      <ul>
        <li>Listings must be for genuine, currently open roles at a real organisation, posted by someone authorised to hire for it.</li>
        <li>Never ask candidates for payment, deposits, training fees, or financial or identity documents before a lawful offer of employment.</li>
        <li>Listings must not discriminate unlawfully and must describe the role accurately.</li>
        <li>Recruiters may use applicant information only to assess that person for the role they applied to, and must keep résumés confidential.</li>
        <li>We label each listing as posted by the company, imported, or community-submitted. Imported and community listings link to the employer’s own posting, and we are not a party to any application made there.</li>
        <li>We do not guarantee that any listing will lead to employment, or that any applicant is suitable. Do your own checks.</li>
      </ul>

      <h2>6. Your content</h2>
      <p>You keep ownership of what you post. You grant us a non-exclusive licence to host, display and distribute it within the service, in line with the visibility you choose. You can delete your content at any time; copies may persist briefly in backups.</p>
      <p>You confirm that you have the right to post it and that it does not infringe anyone else’s rights. If you believe content infringes your copyright, <Link href="/contact">contact us</Link> with the details.</p>

      <h2>7. Moderation</h2>
      <p>Members can report content, profiles, listings and organisations. Moderators may remove content, reject listings, decline verification, or suspend accounts that break these terms. Content reported by several members may be hidden while it is reviewed. Where practical we tell you what was actioned and why, and you can <Link href="/contact">contact us</Link> to ask for a decision to be reviewed.</p>

      <h2>8. External links</h2>
      <p>Links in member content lead to sites we do not control. We screen them with automated checks and show the destination before you leave, but we cannot guarantee that any external site is safe.</p>

      <h2>9. Availability and changes</h2>
      <p>We work to keep the service reliable but provide it “as is”, without a guarantee that it will be uninterrupted or error-free. We may change or discontinue features, and will give notice of changes that materially affect you.</p>

      <h2>10. Liability</h2>
      <p>To the extent the law allows, we are not liable for indirect or consequential losses, or for the conduct of other members, employers or third-party sites. Nothing in these terms limits liability that cannot lawfully be limited.</p>

      <h2>11. Ending your use</h2>
      <p>You can close your account at any time from <Link href="/settings">Settings</Link>. We may suspend or close accounts that break these terms.</p>

      <h2>12. Changes to these terms</h2>
      <p>If we change these terms in a way that matters, we will notify members in the app before the change takes effect. Continuing to use {APP_NAME} afterwards means you accept the updated terms.</p>
    </LegalPage>
  );
}
