// server.json for the official MCP Registry (https://registry.modelcontextprotocol.io). Not published from here:
// publishing is a manual, owner-approved step (versions are immutable).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = JSON.parse(readFileSync(new URL("../server.json", import.meta.url), "utf8"));

test("server.json: registry-required fields and limits", () => {
  assert.equal(server.$schema, "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json");
  assert.equal(server.name, "ai.clankdown/clankdown");
  assert.equal(server.name.split("/").length, 2);
  assert.ok(server.description.length >= 1 && server.description.length <= 100, "description is 1–100 characters");
  assert.match(server.version, /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/, "exact version, no range");
  assert.match(server.websiteUrl, /^https:\/\//);
});

test("server.json: one remote, streamable-http at the production MCP URL; credential header secret", () => {
  assert.equal(server.remotes.length, 1);
  const [r] = server.remotes;
  assert.equal(r.type, "streamable-http");
  assert.equal(r.url, "https://clankdown.ai/mcp");
  const auth = r.headers.find((h) => h.name === "Authorization");
  assert.ok(auth && auth.isSecret === true && auth.isRequired === true);
  assert.doesNotMatch(JSON.stringify(server), /ckb_[A-Za-z0-9]{8,}|\/mcp\/t\//, "no credential or token URL");
});

test("server.json: square https icons (png/svg), ≤ 255 characters", () => {
  assert.ok(server.icons.length >= 1);
  for (const i of server.icons) {
    assert.match(i.src, /^https:\/\/clankdown\.ai\//);
    assert.ok(i.src.length <= 255);
    assert.ok(["image/png", "image/svg+xml"].includes(i.mimeType));
  }
  assert.ok(server.icons.some((i) => i.mimeType === "image/png" && i.sizes?.includes("512x512")));
});
