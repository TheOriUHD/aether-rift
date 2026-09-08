import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = join(import.meta.dirname, "..");
const dir = join(root, "assets/b64");
if (!existsSync(dir)) process.exit(0);

/** @type {Map<string, string[]>} */
const parts = new Map();

function walk(current, prefix = "") {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const rel = prefix + entry.name;
    if (entry.isDirectory()) {
      walk(join(current, entry.name), rel + "/");
      continue;
    }
    const text = readFileSync(join(current, entry.name), "utf8").replace(/\s+/g, "");
    const part = rel.match(/^(.*)\.b64(?:\.part(\d{2}))?$/);
    if (!part) continue;
    const outRel = part[1];
    const idx = part[2] ? Number(part[2]) : 0;
    const list = parts.get(outRel) ?? [];
    list[idx] = text;
    parts.set(outRel, list);
  }
}

walk(dir);

for (const [outRel, chunks] of parts) {
  const out = join(root, outRel);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, Buffer.from(chunks.join(""), "base64"));
}
