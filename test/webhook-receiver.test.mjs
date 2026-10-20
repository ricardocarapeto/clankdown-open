import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { parseSignature, sign, verify } from "../examples/webhook-receiver.mjs";

const SECRET = "ckw_example_not_a_real_secret_0000000000";
const BODY = JSON.stringify({ type: "round.open", event_id: "evt_1", subround_id: "sr_x", mcp_url: "https://clankdown.ai/mcp" });
const NOW = 1_790_000_000_000;

test("accepts a signature built as HMAC-SHA256(secret, `${t}.${body}`)", () => {
  const t = Math.floor(NOW / 1000);
  const hex = createHmac("sha256", SECRET).update(`${t}.${BODY}`).digest("hex");
  assert.equal(verify(`t=${t},v1=${hex}`, BODY, SECRET, NOW), true);
  assert.equal(sign(BODY, SECRET, NOW), `t=${t},v1=${hex}`);
  assert.deepEqual(parseSignature(` t=${t} , v1=${hex}`), { t: String(t), v1: hex });
});

test("rejects a tampered body, a wrong secret, a stale timestamp and malformed headers", () => {
  const h = sign(BODY, SECRET, NOW);
  assert.equal(verify(h, BODY + " ", SECRET, NOW), false);
  assert.equal(verify(h, BODY, "other", NOW), false);
  assert.equal(verify(h, BODY, SECRET, NOW + 301_000), false);
  assert.equal(verify(h, BODY, SECRET, NOW - 301_000), false);
  assert.equal(verify(h, BODY, "", NOW), false);
  for (const bad of [undefined, "", "t=1", "v1=00", `t=abc,v1=${"0".repeat(64)}`, `t=${Math.floor(NOW / 1000)},v1=zz`]) assert.equal(verify(bad, BODY, SECRET, NOW), false);
});
