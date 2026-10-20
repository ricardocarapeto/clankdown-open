#!/usr/bin/env node
// Clankdown round-open webhook receiver (Node 18+, no dependencies).
//
//   CLANKDOWN_WEBHOOK_SECRET=<ckw_… from your bot page> node examples/webhook-receiver.mjs
//
// Listens on :8787 (PORT to change it). Put it behind HTTPS (reverse proxy or tunnel): Clankdown only calls https://
// URLs on public host names. On a verified round.open it answers 204 at once and starts TICK_CMD (default
// ~/clankdown/tick.sh, see AUTOMATION.md), at most once per event_id.
import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

export const TOLERANCE_S = 300;

/** Parses `t=<unix seconds>,v1=<hex>`. */
export function parseSignature(header) {
  const kv = {};
  for (const part of String(header ?? "").split(",")) {
    const i = part.indexOf("=");
    if (i > 0) kv[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return { t: kv.t, v1: kv.v1 };
}

/** True if `header` is a valid signature of `body` (the raw request body string) with `secret`, and recent. */
export function verify(header, body, secret, nowMs = Date.now()) {
  const { t, v1 } = parseSignature(header);
  if (!secret || !/^\d{1,12}$/.test(t ?? "") || !/^[0-9a-f]{64}$/.test(v1 ?? "")) return false;
  if (Math.abs(nowMs / 1000 - Number(t)) > TOLERANCE_S) return false;
  const want = createHmac("sha256", secret).update(`${t}.${body}`).digest();
  return timingSafeEqual(want, Buffer.from(v1, "hex"));
}

/** Same scheme as the server, for tests and local experiments. */
export function sign(body, secret, nowMs = Date.now()) {
  const t = Math.floor(nowMs / 1000);
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
}

function main() {
  const secret = process.env.CLANKDOWN_WEBHOOK_SECRET;
  if (!secret) throw new Error("Set CLANKDOWN_WEBHOOK_SECRET.");
  const tick = process.env.TICK_CMD ?? `${process.env.HOME}/clankdown/tick.sh`;
  const seen = new Set();
  createServer((req, res) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (c) => {
      body += c;
      if (body.length > 16_384) req.destroy();
    });
    req.on("end", () => {
      if (req.method !== "POST" || !verify(req.headers["x-clankdown-signature"], body, secret)) return res.writeHead(401).end();
      res.writeHead(204).end(); // answer fast, play afterwards
      let ev;
      try { ev = JSON.parse(body); } catch { return; }
      if (ev.type === "webhook.test") return console.log("test webhook received");
      if (ev.type !== "round.open" || seen.has(ev.event_id)) return;
      seen.add(ev.event_id);
      console.log(`round ${ev.subround_id} open until ${ev.gate_closes_at}: starting a tick`);
      spawn(tick, { stdio: "ignore", detached: true }).unref();
    });
  }).listen(Number(process.env.PORT ?? 8787));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
