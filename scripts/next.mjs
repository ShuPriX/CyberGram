// Launches `next dev` / `next build`.
//
// Next.js bundles with Turbopack by default, which links native packages into `.next` using
// symlinks (junctions on Windows). Some filesystems cannot create them — exFAT, FAT32 and
// certain network shares — and the build then fails. This launcher checks whether the project
// directory supports links and, only when it does not, falls back to the webpack bundler with
// symlink resolution turned off. On ordinary filesystems it runs Next.js exactly as usual.
import { spawn } from "node:child_process";
import { mkdirSync, rmdirSync, symlinkSync, unlinkSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

function supportsLinks() {
  const dir = path.resolve(".next");
  const link = path.join(dir, `.link-check-${process.pid}`);
  try {
    mkdirSync(dir, { recursive: true });
    symlinkSync(path.resolve("node_modules"), link, "junction");
  } catch {
    return false;
  }
  try {
    unlinkSync(link);
  } catch {
    try {
      rmdirSync(link);
    } catch {
      /* a leftover link inside .next is harmless */
    }
  }
  return true;
}

const [command = "dev", ...rest] = process.argv.slice(2);
const args = [command, ...rest];
const env = { ...process.env };
const explicit = rest.some((arg) => arg === "--webpack" || arg === "--turbopack" || arg === "--turbo");

if (!explicit && (command === "dev" || command === "build") && !supportsLinks()) {
  console.warn("[cybergram] This drive does not support symbolic links; using the webpack bundler instead of Turbopack.");
  args.push("--webpack");
  env.NEXT_NO_SYMLINKS = "1";
  const shim = path.resolve("scripts", "fs-no-symlinks.cjs").split(path.sep).join("/");
  env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ""} --require "${shim}"`.trim();
}

const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, ...args], { stdio: "inherit", env });
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
