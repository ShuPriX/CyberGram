/**
 * Runs once when the server process starts, before it accepts requests.
 * Database preparation and the optional in-process scheduler are wired up here.
 *
 * The import must stay inside the `NEXT_RUNTIME === "nodejs"` block: bundlers use that exact
 * shape to leave Node-only modules (database drivers, the filesystem) out of the edge build.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { bootstrap } = await import("./server/bootstrap");
    await bootstrap();
  }
}
