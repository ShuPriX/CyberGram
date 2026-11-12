import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private areas, utility endpoints and unbounded filter spaces stay out of crawlers' way.
        disallow: [
          "/api/",
          "/admin",
          "/settings",
          "/messages",
          "/notifications",
          "/feed",
          "/network",
          "/bookmarks",
          "/onboarding",
          "/profile",
          "/achievements",
          "/recruiter",
          "/jobs/saved",
          "/jobs/applications",
          "/jobs/alerts",
          "/jobs/resumes",
          "/jobs/submit",
          "/search",
          "/leaving",
          "/dev/",
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
