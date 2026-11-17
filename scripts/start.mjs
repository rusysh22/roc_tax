import { cpSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Next standalone output omits static assets; copy them for local production QA.
const build = new URL("../apps/web/.next/", import.meta.url);
cpSync(
  new URL("static/", build),
  new URL("standalone/apps/web/.next/static/", build),
  { recursive: true },
);
process.env.HOSTNAME = process.env.BIND_HOST ?? "127.0.0.1";
process.env.PORT ??= "3000";
process.chdir(fileURLToPath(new URL("standalone/apps/web/", build)));
await import(new URL("standalone/apps/web/server.js", build).href);
