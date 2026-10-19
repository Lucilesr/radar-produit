// Applique uniquement les migrations à la base de démonstration locale.
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
for (const name of readdirSync("drizzle").filter(name => /^\d+.*\.sql$/.test(name)).sort()) {
  const result = spawnSync(process.execPath, ["--import", "./scripts/sites-env.mjs", "./node_modules/wrangler/bin/wrangler.js", "d1", "execute", "DB", "--local", "--config", "dist/server/wrangler.json", "--persist-to", ".wrangler/state", "--file", `drizzle/${name}`], { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
