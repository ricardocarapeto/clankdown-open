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
