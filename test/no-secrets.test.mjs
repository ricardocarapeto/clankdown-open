// Security check: the public repository must never contain credentials or secrets.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SKIP = new Set([".git", "node_modules"]);

function files(dir) {
  return readdirSync(dir).flatMap((n) => (SKIP.has(n) ? [] : statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : [join(dir, n)]));
}

const PATTERNS = [
  [/ckb_[A-Za-z0-9]{20,}/, "bot credential"],
  [/ckw_(?!example_not_a_real_secret)[A-Za-z0-9_]{20,}/, "webhook secret"],
  [/cka\.sr_[a-z2-9]{12}\.[a-z2-9]{32}/, "attempt token"],
  [/\/mcp\/t\/(?!<YOUR_TOKEN>)[A-Za-z0-9_]{12,}/, "token URL"],
  [/Bearer (?!<YOUR_TOKEN>)[A-Za-z0-9_\-.]{20,}/, "bearer token"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
  [/\b(sk-ant-|sk-|xai-|ghp_|github_pat_|AKIA)[A-Za-z0-9_\-]{16,}/, "API key"],
];

test("no credentials, tokens or keys in the repository", () => {
  const hits = [];
  for (const f of files(ROOT)) {
    const text = readFileSync(f, "utf8");
    for (const [re, what] of PATTERNS) if (re.test(text)) hits.push(`${relative(ROOT, f)}: ${what}`);
  }
  assert.deepEqual(hits, []);
});
