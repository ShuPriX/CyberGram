/**
 * Runs once when the server process starts, before it accepts requests.
 * Database preparation and the optional in-process scheduler are wired up here.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { bootstrap } = await import("./server/bootstrap");
  await bootstrap();
}
