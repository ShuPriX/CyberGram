import { JOB_CATEGORIES, type EmploymentType, type ExperienceLevel, type JobCategorySlug } from "./constants";

/**
 * Search landing pages under /cybersecurity-jobs/<slug>. Each pins a set of job filters and
 * carries its own title and copy. They are real, filterable listings — never doorway pages —
 * and are only included in the sitemap while they have open roles.
 */
export type JobLanding = {
  slug: string;
  /** Short label for chips and links. */
  short: string;
  title: string;
  heading: string;
  description: string;
  featured?: boolean;
  filters: {
    country?: string;
    remote?: boolean;
    categories?: JobCategorySlug[];
    levels?: ExperienceLevel[];
    types?: EmploymentType[];
    earlyCareerOnly?: boolean;
  };
};

const BASE: JobLanding[] = [
  {
    slug: "india",
    short: "Jobs in India",
    title: "Cybersecurity Jobs in India",
    heading: "Cybersecurity jobs in India",
    description: "Current cybersecurity openings across India — Bengaluru, Hyderabad, Pune, Mumbai, Delhi NCR, Chennai and remote — for SOC analysts, penetration testers, cloud and application security engineers, and GRC roles.",
    featured: true,
    filters: { country: "IN" },
  },
  {
    slug: "usa",
    short: "Jobs in the USA",
    title: "Cybersecurity Jobs in the USA",
    heading: "Cybersecurity jobs in the United States",
    description: "Open cybersecurity roles in the United States: security engineering, SOC, incident response, cloud security, application security, red team and GRC, including remote US positions.",
    featured: true,
    filters: { country: "US" },
  },
  {
    slug: "remote",
    short: "Remote",
    title: "Remote Cybersecurity Jobs",
    heading: "Remote cybersecurity jobs",
    description: "Fully remote cybersecurity roles from organisations hiring across borders — SOC, detection engineering, penetration testing, cloud security, AppSec and GRC.",
    featured: true,
    filters: { remote: true },
  },
  {
    slug: "internships",
    short: "Internships",
    title: "Cybersecurity Internships",
    heading: "Cybersecurity internships",
    description: "Cybersecurity internships and apprenticeships for students and recent graduates in SOC, VAPT, cloud security, application security and GRC.",
    featured: true,
    filters: { types: ["internship", "apprenticeship"] },
  },
  {
    slug: "entry-level",
    short: "Entry-level",
    title: "Entry-Level Cybersecurity Jobs",
    heading: "Entry-level and fresher cybersecurity jobs",
    description: "Cybersecurity roles for freshers, students and career changers: trainee SOC analysts, junior penetration testers, graduate security engineers and associate GRC analysts.",
    featured: true,
    filters: { earlyCareerOnly: true },
  },
];

// One landing per role family, e.g. /cybersecurity-jobs/soc-analyst.
const BY_CATEGORY: JobLanding[] = JOB_CATEGORIES.filter((c) => c.slug !== "other").map((category) => ({
  slug: category.slug,
  short: category.name,
  title: `${category.name} Jobs`,
  heading: `${category.name} jobs`,
  description: `Open ${category.plural.toLowerCase()} roles from security teams and consultancies, re-checked daily against their source. Filter by country, experience level and work arrangement.`,
  featured: ["soc-analyst", "penetration-tester", "cloud-security-engineer", "application-security-engineer", "grc-analyst"].includes(category.slug),
  filters: { categories: [category.slug] },
}));

export const JOB_LANDINGS: JobLanding[] = [...BASE, ...BY_CATEGORY];

export function getJobLanding(slug: string): JobLanding | undefined {
  return JOB_LANDINGS.find((landing) => landing.slug === slug);
}
