# CyberGram

A professional network and career platform built exclusively for the cybersecurity community: a domain-organised feed, profiles built around achievements with evidence, communities, a learning hub, and a hiring hub that only shows roles that are open today.

## What is in the box

| Area | What it does |
| --- | --- |
| Accounts | Email + password (Argon2id), GitHub / Google sign-in, email verification, password reset, session management, account closure |
| Feed | Posts, long-form articles, comments, likes, reposts, bookmarks, hashtags, mentions, attachments, four feed modes |
| Profiles | Experience, education, projects, skills, achievements with a verification workflow, per-member privacy controls |
| Network | Follows, request-based connections, direct messages, notifications with per-type preferences |
| Jobs | Search and filters, India / US / remote landing pages, saved jobs, applications with status history, alerts, private résumés |
| Hiring | Organisation pages, recruiter portal, applicant pipeline, candidate discovery (verified organisations, opt-in members) |
| Job ingestion | Greenhouse, Lever, Ashby, JSON and RSS sources; daily sync, de-duplication, automatic expiry, review queue |
| Community | Topic communities, learning roadmaps with progress, curated resources, events |
| Admin | Reports, job review, verification queues, job sources, members, categories, contact inbox, audit log |

Two rules shape the product. **Nothing is fabricated:** there are no invented members, companies, listings or statistics, and demo data is opt-in, labelled and refused in production. **Provenance is always shown:** every job says whether it was posted by the company, imported from the employer's feed, or submitted by a member.

## Stack

Next.js 16 (App Router, server actions) · React 19 · TypeScript · Tailwind CSS v4 · Drizzle ORM · PostgreSQL (embedded PGlite for local development) · Radix UI.

## Getting started

Requires Node.js 20.12 or newer.

```bash
npm ci
cp .env.example .env.local
```

Fill in `.env.local`. For local development the only values you need are `APP_SECRET`, `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`; leave `DATABASE_URL` empty to use the embedded database stored in `./.data`.

```bash
npm run db:seed   # migrations, reference data and the first administrator
npm run dev       # http://localhost:3000
```

Email is not delivered in development. Verification and reset emails are written to `./.data/outbox` and shown at `/dev/outbox`.

### Demo data (optional)

```bash
npm run db:seed:demo    # six fictional members, three organisations, ten jobs
npm run db:purge-demo   # removes all of it
```

Set `SEED_DEMO_PASSWORD` first. Demo members and organisations carry “(Demo)” in their names, demo jobs show a Demo badge, and none of it is indexable or marked verified.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Development server, production build, production server |
| `npm run typecheck` / `lint` | TypeScript and ESLint |
| `npm run db:generate` | Generate a migration after changing `src/db/schema` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Reference data and the administrator account |
| `npm run cron:daily` | Job-feed sync, listing expiry, job alerts, housekeeping |
| `npm run jobs:sync` | Synchronise every enabled job source now |

## Keeping jobs current

The jobs section fills and refreshes on its own; no organisation has to register. Listings reach the hub three ways:

- **Employer job boards (automatic).** `src/db/seed/sources.ts` lists about a hundred employers' public job boards, read through the public job-board APIs of Greenhouse, Lever and Ashby. They are installed by `npm run db:seed`, re-read every twelve hours, and only security practitioner roles are kept (sales, marketing and similar roles at security vendors are filtered out). Manage them under **Admin → Job sources**.
- **Organisations** that register can post roles directly and track applicants.
- **Members** can submit a role they found; a moderator checks it against the employer's posting.

Run `npm run jobs:sync` once after seeding to fill the board immediately. After that the built-in scheduler keeps it current: it is on by default (`ENABLE_INTERNAL_SCHEDULER=true`) and checks every 15 minutes for sources that are due. When running several instances, turn it off and call the endpoint from an external scheduler instead:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-host/api/cron/daily
```

Each run synchronises sources that are due, closes roles that have disappeared from their source or passed their deadline, sends job alerts and purges expired sessions and tokens. Every step is idempotent, so running it hourly is safe.

Only add sources you are permitted to use. Each source records its authorisation basis, nothing is scraped from web pages, and imported listings always link back to the employer's own posting.

## Design

Black, diamond white and signal orange, with hard edges and no gradients, blur or drop shadows on cards. Headings use Chakra Petch, text uses IBM Plex Sans and labels use JetBrains Mono; the fonts are downloaded at build time and served from the app's own origin. Black is the default theme and the diamond-white theme is one click away in the header. Colour tokens live at the top of `src/app/globals.css`.

## Production checklist

- `APP_URL` is `https://…` and `APP_SECRET` is at least 32 random characters. The server refuses to start otherwise.
- `DATABASE_URL` points at PostgreSQL. Run `npm run db:migrate` as a release step.
- `SMTP_URL` is set so verification and security emails are delivered.
- `STORAGE_DRIVER=s3` with an S3-compatible bucket for uploads.
- `CLAMAV_HOST` is set and `UPLOAD_REQUIRE_SCAN=true` so uploads are scanned.
- `REDIS_URL` is set when running more than one instance, so rate limits are shared.
- `CRON_SECRET` is set and a scheduler calls `/api/cron/daily`.
- `TRUSTED_PROXY_HOPS` matches the number of proxies in front of the app.
- Have the Privacy Policy and Terms of Service reviewed for your jurisdiction.

## Security model

- **Authentication:** Argon2id hashes, breached-password check (k-anonymity), login rate limits with lockout, server-side sessions stored as hashes in `__Host-` cookies, single-use hashed tokens for verification and reset.
- **Authorisation:** every server action re-validates the session and checks capabilities server-side. What a member may do for an organisation comes from `company_members`, never from the platform role alone.
- **Input and output:** all input is validated with Zod. Member content is never rendered as HTML — short text is tokenised into React nodes and Markdown is rendered with raw HTML disabled.
- **Browser:** nonce-based Content-Security-Policy per request, frame denial, strict referrer and permissions policies, HSTS in production.
- **Uploads:** type detected from bytes, per-slot allow-lists, static active-content checks, optional ClamAV scan, images re-encoded to strip metadata. Résumés are private to their owner and the hiring team they were sent to.
- **Links:** external links in member content pass through `/leaving`, which shows the real destination and any warning signs. Job feeds are fetched through an SSRF-hardened client.
- **Moderation:** reports, automatic hiding at a report threshold, scam-pattern screening for job listings, and an append-only audit log.

## Project layout

```
src/app            Routes: (marketing), (auth), (app), api
src/components     UI primitives and feature components
src/db             Schema, migrations runner, seeds
src/lib            Auth, security, storage, mail, job classification, validation
src/server         Server actions, queries and background services
scripts            Migrations, seeding, scheduled work
drizzle            SQL migrations
```

## Running from an exFAT or FAT32 drive

Those filesystems cannot create symbolic links, which Next.js's default bundler needs. `npm run dev` and `npm run build` detect this and switch to the webpack bundler automatically; you will see a one-line notice when that happens. Builds are slower there, so an NTFS, APFS or ext4 drive is recommended for day-to-day development.
