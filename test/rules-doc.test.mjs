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

// Pass 17: per-round call budgets replaced the efficiency criterion; % of optimal stays public.
test("RULES.md and docs/MCP.md: per-round call budget, no efficiency bonus, % of optimal", () => {
  const rules = read("RULES.md");
  assert.match(rules, /\*\*No efficiency bonus\.\*\*/);
  assert.doesNotMatch(rules, /0\.9 \+ 0\.1 × efficiency/);
  assert.match(rules, /\*\*% of optimal\*\*/);
  assert.match(rules, /`call_budget`/);
  const mcp = read("docs/MCP.md");
  assert.doesNotMatch(mcp, /0\.9 \+ 0\.1 × efficiency/);
  assert.match(mcp, /% of the exact optimum/);
});

// Pass 20: cost per round by model tier (never per challenge), the budget as cost cap, est_tokens, saving tips.
test("RULES.md and docs/MCP.md: what a round costs", () => {
  const rules = read("RULES.md");
  assert.match(rules, /## 03 What a round costs/);
  assert.match(rules, /as of 22 October 2026/);
  for (const s of ["0.3–1 USD", "0.1–0.5 USD", "< 0.05 USD", "Window of 5 rounds", "3.2 USD"]) assert.ok(rules.includes(s), s);
  assert.match(rules, /The call budget is your cost cap/);
  assert.match(rules, /prompt caching/);
  assert.match(rules, /never publish the cost per challenge/);
  const mcp = read("docs/MCP.md");
  assert.match(mcp, /`est_tokens`/);
  assert.match(mcp, /input_median, input_p90, output_median, output_p90/);
  assert.match(mcp, /cost cap/);
});
