import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
/**
 * Set by `scripts/next.mjs` when the project lives on a filesystem without symlink or junction
 * support (exFAT, FAT32, some network shares). Module resolution then skips symlink lookups,
 * which otherwise fail there with EISDIR.
 */
const noSymlinks = process.env.NEXT_NO_SYMLINKS === "1";

/**
 * Static security headers applied to every response.
 * The Content-Security-Policy is nonce-based and therefore set per request in `src/proxy.ts`.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), browsing-topics=()",
  },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // `NEXT_OUTPUT=standalone` is set by the Dockerfile to produce a minimal production image.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  // Native / filesystem-bound packages must never be bundled.
  serverExternalPackages: [
    "@electric-sql/pglite",
    "pg",
    "@node-rs/argon2",
    "sharp",
    "nodemailer",
    "ioredis",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "1mb",
    },
  },
  ...(noSymlinks
    ? {
        webpack(config: { resolve: { symlinks?: boolean }; cache?: unknown }) {
          config.resolve.symlinks = false;
          // The on-disk build cache cannot snapshot dependencies on these filesystems; keep it in memory.
          config.cache = { type: "memory" };
          return config;
        },
      }
    : {}),
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        // Never cache authenticated API responses in shared caches.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
