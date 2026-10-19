#!/usr/bin/env node
// verify-commitment — check a Clankdown /commitments entry against its revealed draw, salt and seeds.
// Dependency-free (Node >= 18). Hash scheme, exactly as the engine publishes it:
//   draw:  sha256_hex(draw_json + salt)   (the revealed JSON byte-for-byte as shown, then the salt, no separator, UTF-8)
//   seed:  sha256_hex(seed)
//   a seed starting with "e<N>." belongs to edition N and must match the slot's "edition" in the revealed draw;
//   a seed without that prefix must belong to a slot without an edition.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const sha256Hex = (s) => createHash("sha256").update(s, "utf8").digest("hex");
export const drawCommit = (drawJson, salt) => sha256Hex(`${drawJson}${salt}`);
export const seedEdition = (seed) => { const m = /^e(\d+)\./.exec(seed); return m ? Number(m[1]) : undefined; };

/**
 * entry: { draw_json, salt, draw_commit, seeds?: [{ slot, seed, seed_commit }] }
 * Returns { ok, checks: [{ name, ok, detail }] }.
 */
export function verifyEntry(entry) {
  const checks = [];
  const add = (name, ok, detail = "") => checks.push({ name, ok: !!ok, detail });
  const norm = (h) => String(h ?? "").trim().toLowerCase();
  if (typeof entry.draw_json !== "string" || typeof entry.salt !== "string") {
    add("input", false, "draw_json and salt must be strings (copy them exactly as shown on /commitments)");
    return { ok: false, checks };
  }
  const got = drawCommit(entry.draw_json, entry.salt);
  add("draw commitment", got === norm(entry.draw_commit), `sha256(draw_json + salt) = ${got}`);
  let draw = null;
  try { draw = JSON.parse(entry.draw_json); } catch { add("draw JSON parses", false, "draw_json is not valid JSON"); }
  if (draw) {
    const okShape = draw.v === 1 && Array.isArray(draw.slots) && draw.slots.length === draw.k;
    add("draw format", okShape, `v=${draw.v}, k=${draw.k}, slots=${Array.isArray(draw.slots) ? draw.slots.length : "?"}`);
    const slotsSeen = new Set((draw.slots ?? []).map((s) => s.slot));
    add("distinct slots", slotsSeen.size === (draw.slots ?? []).length);
  }
  for (const s of entry.seeds ?? []) {
    const h = sha256Hex(String(s.seed));
    add(`seed ${s.slot ?? "?"} commitment`, h === norm(s.seed_commit), `sha256(seed) = ${h}`);
    if (draw && s.slot) {
      const slot = (draw.slots ?? []).find((x) => x.slot === s.slot);
      const e = seedEdition(String(s.seed));
      add(`seed ${s.slot} edition`, !!slot && (slot.edition ?? undefined) === e,
        slot ? `seed edition ${e ?? "none"}, draw edition ${slot.edition ?? "none"}` : "slot not in draw");
    }
  }
  return { ok: checks.every((c) => c.ok), checks };
}

function usage() {
  console.log(`Usage:
  verify-commitment <entry.json>
  verify-commitment --draw-json '<json>' --salt <salt> --commit <hash> [--seed <slot>:<seed>:<seed_commit> ...]

entry.json: { "draw_json": "...", "salt": "...", "draw_commit": "...", "seeds": [{ "slot": "A", "seed": "...", "seed_commit": "..." }] }
Copy every value exactly as shown on https://clankdown.ai/commitments once the window has closed.`);
}

function main(argv) {
  if (!argv.length || argv.includes("-h") || argv.includes("--help")) { usage(); return argv.length ? 0 : 2; }
  let entry;
  if (!argv[0].startsWith("--")) entry = JSON.parse(readFileSync(argv[0], "utf8"));
  else {
    entry = { seeds: [] };
    for (let i = 0; i < argv.length; i += 2) {
      const [k, v] = [argv[i], argv[i + 1]];
      if (k === "--draw-json") entry.draw_json = v;
      else if (k === "--salt") entry.salt = v;
      else if (k === "--commit") entry.draw_commit = v;
      else if (k === "--seed") { const [slot, seed, seed_commit] = v.split(":"); entry.seeds.push({ slot, seed, seed_commit }); }
      else { console.error(`Unknown option ${k}`); usage(); return 2; }
    }
  }
  const r = verifyEntry(entry);
  for (const c of r.checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.detail ? `  (${c.detail})` : ""}`);
  console.log(r.ok ? "\nAll checks passed: nothing changed after the commitment." : "\nMISMATCH: at least one check failed.");
  return r.ok ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main(process.argv.slice(2));
