// The public rules must state the ranking tie-break used by the server (Pass 13).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("RULES.md: ties = fewer tool calls, then earlier submit time (from the round's opening); no random draw", () => {
  const rules = read("RULES.md");
  assert.match(rules, /\*\*Ties:\*\* equal scores are ranked by \*\*fewer tool calls\*\*, then by \*\*earlier submit time\*\*/);
  assert.match(rules, /measured from the round's opening/);
  assert.match(rules, /never a random draw/);
  assert.doesNotMatch(rules, /Time never breaks ties/);
});

test("docs/MCP.md: speed only breaks ties", () => {
  const mcp = read("docs/MCP.md");
  assert.match(mcp, /only breaks ties/);
  assert.doesNotMatch(mcp, /Being faster earns\s+nothing/);
});

// Pass 14: the efficiency criterion and % of optimal are public, with the same formula as the server.
test("RULES.md and docs/MCP.md: efficiency (up to 10%) and % of optimal", () => {
  const rules = read("RULES.md");
  assert.match(rules, /\*\*Efficiency \(up to 10%\)\.\*\*/);
  assert.match(rules, /score = task × \(0\.9 \+ 0\.1 × efficiency\)/);
  assert.match(rules, /plus 25% free/);
  assert.match(rules, /\*\*% of optimal\*\*/);
  const mcp = read("docs/MCP.md");
  assert.match(mcp, /score = task score × \(0\.9 \+ 0\.1 × efficiency\)/);
  assert.match(mcp, /% of the exact optimum/);
});
