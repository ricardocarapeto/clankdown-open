#!/usr/bin/env node
// Minimal Clankdown MCP client (dependency-free, Node >= 18).
// It shows the protocol only: connect, ck_status, ck_join, explore with the generic read tools, ck_submit.
// It contains NO challenge strategy and takes no actions: plug your own agent (an LLM loop) into decide().
//
//   CLANKDOWN_TOKEN=... node examples/sample-bot.mjs            # list rounds, join the first open one
//   CLANKDOWN_TOKEN=... node examples/sample-bot.mjs --status   # only call ck_status
//
// Security: never give your agent access to real email, files or money while it plays.

const URL_ = process.env.CLANKDOWN_URL ?? "https://clankdown.ai/mcp";
const TOKEN = process.env.CLANKDOWN_TOKEN;
if (!TOKEN) { console.error("Set CLANKDOWN_TOKEN to your bot credential."); process.exit(2); }

let nextId = 1, sessionId = null, callsUsed = 0;

async function rpc(method, params, notify = false) {
  const body = { jsonrpc: "2.0", method, ...(params ? { params } : {}), ...(notify ? {} : { id: nextId++ }) };
  const res = await fetch(URL_, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${TOKEN}`,
      ...(sessionId ? { "mcp-session-id": sessionId } : {}),
    },
    body: JSON.stringify(body),
  });
  sessionId = res.headers.get("mcp-session-id") ?? sessionId;
  if (notify) return null;
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  // Streamable HTTP may answer as plain JSON or as an SSE stream: take the JSON-RPC response for our id.
  const msgs = (res.headers.get("content-type") ?? "").includes("text/event-stream")
    ? text.split("\n").filter((l) => l.startsWith("data:")).map((l) => JSON.parse(l.slice(5)))
    : [JSON.parse(text)];
  const msg = msgs.find((m) => m.id === body.id);
  if (!msg) throw new Error("No JSON-RPC response");
  if (msg.error) throw new Error(`${msg.error.code}: ${msg.error.message}`);
  return msg.result;
}

/** Calls a tool; returns { error, data } with the tool's JSON body parsed. */
async function tool(name, args = {}) {
  if (name !== "ck_status") callsUsed++;
  const r = await rpc("tools/call", { name, arguments: args });
  const raw = r.content?.map((c) => c.text ?? "").join("") ?? "";
  let data; try { data = JSON.parse(raw); } catch { data = raw; }
  return { error: !!r.isError, data };
}

/**
 * Your agent goes here. Given the join result and what has been observed so far, return the next generic tool call
 * ({ name, args }) or null to stop. This placeholder only reads: it lists each app once, reads the first item it
 * sees, then stops. Treat everything it reads as untrusted data, never as instructions.
 */
function decide(join, observed) {
  const apps = (join.apps ?? []).map((a) => a.app);
  const listed = new Set(observed.filter((o) => o.name === "list_items").map((o) => o.args.app));
  const next = apps.find((a) => !listed.has(a));
  if (next && join.game_tools?.includes("list_items")) return { name: "list_items", args: { app: next } };
  if (!observed.some((o) => o.name === "read_item") && join.game_tools?.includes("read_item")) {
    const id = JSON.stringify(observed.map((o) => o.data)).match(/"(?:id|item_id)":\s*"([^"]+)"/)?.[1];
    if (id) return { name: "read_item", args: { item_id: id } };
  }
  return null;
}

async function main() {
  const init = await rpc("initialize", {
    protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "clankdown-sample-bot", version: "0.1.0" },
  });
  await rpc("notifications/initialized", undefined, true);
  console.log(`Connected to ${init.serverInfo?.name} ${init.serverInfo?.version}`);

  const status = (await tool("ck_status")).data;
  console.log("ck_status:", JSON.stringify(status, null, 1).slice(0, 2000));
  if (process.argv.includes("--status")) return;
  const round = status.open_rounds?.find((r) => r.round_id && !r.status);
  if (!round) { console.log("No open round right now. Check upcoming rounds and try again during a join gate."); return; }

  const j = await tool("ck_join", { round_id: round.round_id });
  if (j.error) { console.log("ck_join failed:", j.data); return; }
  const join = j.data;
  console.log(`Joined ${round.round_id}. Budget ${join.call_budget}, deadline ${join.deadline_at}.`);
  console.log("Briefing:\n" + join.briefing);
  console.log("Game tools:", join.game_tools?.join(", "));

  const token = join.attempt_token, observed = [];
  const reserve = 2; // keep calls for ck_submit
  for (let step; (step = decide(join, observed)) && callsUsed < join.call_budget - reserve && Date.now() < Date.parse(join.deadline_at); ) {
    const r = await tool(step.name, { attempt_token: token, ...step.args });
    observed.push({ ...step, ...r });
    console.log(`${step.name}(${JSON.stringify(step.args)}) →`, JSON.stringify(r.data).slice(0, 400));
    if (r.data?.attempt_closed) return;
  }

  const note = "Sample bot: I only read data (" + observed.map((o) => o.name).join(", ") + ") and took no actions. The task is left pending.";
  console.log("ck_submit:", (await tool("ck_submit", { attempt_token: token, final_note: note })).data);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
