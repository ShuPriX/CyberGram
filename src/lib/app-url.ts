/**
 * The app's public origin, without a trailing slash.
 *
 * Dependency-free so the request proxy, metadata and server configuration can all share it.
 * `APP_URL` is authoritative. When it is not set, the address a hosting platform assigns to
 * the service is used (Render exposes it as `RENDER_EXTERNAL_URL`), so a first deployment
 * works before a custom domain exists. Set `APP_URL` once the site has its own domain.
 */
export const APP_ORIGIN = (process.env.APP_URL?.trim() || process.env.RENDER_EXTERNAL_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
