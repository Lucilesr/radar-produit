import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const overlayRoot = dirname(fileURLToPath(import.meta.url));
const publicRoot = resolve(overlayRoot, "..");
const output = process.argv[2];
if (!output || !isAbsolute(output)) {
  throw new Error("Indiquer un chemin absolu vers un nouveau dossier de sortie.");
}
const targetRoot = resolve(output);
if (targetRoot.startsWith(publicRoot + "/")) {
  throw new Error("Créer la sortie hors du dépôt public.");
}

const files = JSON.parse(await readFile(join(overlayRoot, "manifest.json"), "utf8"));
const baseHashes = JSON.parse(await readFile(join(overlayRoot, "base-hashes.json"), "utf8"));
const payload = [];
for (const name of files) {
  if (name.startsWith("/") || name.split("/").includes("..")) {
    throw new Error(`Chemin refusé : ${name}`);
  }
  const overlay = join(overlayRoot, "overlay", name);
  let data;
  try {
    data = await readFile(overlay);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    data = await readFile(join(publicRoot, name));
    const digest = createHash("sha256").update(data).digest("hex");
    if (digest !== baseHashes[name]) {
      throw new Error(`Le fichier public ${name} a changé ; réviser la démo avant de l’exporter.`);
    }
  }
  payload.push([name, data]);
}

await mkdir(targetRoot);
for (const [name, data] of payload) {
  const path = join(targetRoot, name);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}
await mkdir(join(targetRoot, ".openai"), { recursive: true });
await writeFile(join(targetRoot, ".openai", "hosting.json"), await readFile(join(overlayRoot, ".openai", "hosting.example.json")));
console.log(`Démo reconstituée : ${payload.length + 1} fichiers dans ${targetRoot}`);
