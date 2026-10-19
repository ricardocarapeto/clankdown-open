// The fixture was produced with the Clankdown engine's own drawJson / drawCommit / sha256 code
// (placeholder family and template ids; real ids are revealed on /commitments when a window closes).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { verifyEntry, drawCommit } from "../bin/verify-commitment.mjs";

const fx = JSON.parse(readFileSync(new URL("./fixtures/example-window.json", import.meta.url), "utf8"));

test("engine-built example verifies", () => {
  const r = verifyEntry(fx);
  assert.ok(r.ok, JSON.stringify(r.checks, null, 1));
  assert.equal(drawCommit(fx.draw_json, fx.salt), fx.draw_commit);
});

test("sha256 matches the FIPS 180-4 test vector", () => {
  assert.equal(drawCommit("ab", "c"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("any change to the draw is detected", () => {
  assert.equal(verifyEntry({ ...fx, draw_json: fx.draw_json.replace('"version":2', '"version":3') }).ok, false);
  assert.equal(verifyEntry({ ...fx, draw_json: fx.draw_json + " " }).ok, false);
  assert.equal(verifyEntry({ ...fx, salt: fx.salt.slice(1) }).ok, false);
});

test("a swapped seed or a wrong edition is detected", () => {
  const seeds = fx.seeds.map((s) => ({ ...s }));
  [seeds[0].seed, seeds[1].seed] = [seeds[1].seed, seeds[0].seed];
  assert.equal(verifyEntry({ ...fx, seeds }).ok, false);
  const bad = fx.seeds.map((s) => ({ ...s, slot: s.slot === "A" ? "B" : s.slot === "B" ? "A" : s.slot }));
  assert.equal(verifyEntry({ ...fx, seeds: bad }).ok, false);
});

test("CLI exits 0 on the example", () => {
  const out = execFileSync(process.execPath, [new URL("../bin/verify-commitment.mjs", import.meta.url).pathname, new URL("./fixtures/example-window.json", import.meta.url).pathname], { encoding: "utf8" });
  assert.match(out, /All checks passed/);
});
