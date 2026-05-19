#!/usr/bin/env node
/**
 * Curl-style self-test for the Shopping Agent.
 *
 * - Spins up a guest user via POST /internal/users/guest
 * - For each scenario, hits POST /api/chat with a fresh chatId
 * - Parses the SSE-ish data stream into structured events
 * - Prints a per-scenario report: tool calls in order, final text, hallucination heuristics
 *
 * Usage:
 *   node backend/scripts/selftest/run.mjs               # all scenarios
 *   node backend/scripts/selftest/run.mjs --only=phone  # match by tag
 *   BACKEND=http://localhost:4000 MODEL=z-ai/glm-4.5-air:free node backend/scripts/selftest/run.mjs
 */

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const BACKEND = process.env.BACKEND ?? "http://localhost:4000";
const MODEL = process.env.MODEL ?? "z-ai/glm-4.5-air:free";
const TRANSCRIPT_DIR = path.join(process.cwd(), "scripts", "selftest", "transcripts");

const SCENARIOS = [
  { tag: "broad", text: "i need new headphones" },
  { tag: "specific", text: "find airpods pro 2" },
  { tag: "budget", text: "running shoes under 80 dollars" },
  { tag: "compare", text: "compare kindle paperwhite vs basic kindle" },
  { tag: "cheapest", text: "cheapest place to buy logitech mx master 3s" },
  { tag: "gift", text: "gift for dad who likes cooking, under 150" },
  { tag: "phone-old-vs-new", text: "i need a gaming phone under 500 dollars" },
  { tag: "laptop-video", text: "good laptop for video editing under 1200" },
];

async function getGuestUser() {
  const res = await fetch(`${BACKEND}/internal/users/guest`);
  if (!res.ok) {
    throw new Error(`guest provision failed: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  // The route returns the inserted Users row(s).
  const u = Array.isArray(body) ? body[0] : body;
  if (!u?.id) throw new Error(`guest user missing id in response: ${JSON.stringify(body)}`);
  return { id: u.id, email: u.email, type: "guest" };
}

async function runScenario(user, scenario) {
  const chatId = randomUUID();
  const messageId = randomUUID();
  const body = {
    id: chatId,
    message: {
      id: messageId,
      role: "user",
      parts: [{ type: "text", text: scenario.text }],
    },
    selectedChatModel: MODEL,
    selectedVisibilityType: "private",
    selectedAgentId: "track1-shopping",
  };

  const t0 = Date.now();
  const res = await fetch(`${BACKEND}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": user.id,
      "x-user-type": user.type,
      "x-user-email": user.email ?? "",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    return {
      scenario,
      chatId,
      durationMs: Date.now() - t0,
      ok: false,
      status: res.status,
      error: await res.text().catch(() => ""),
      events: [],
      toolCalls: [],
      assistantText: "",
    };
  }

  const events = await readSseStream(res.body);
  const toolCalls = collectToolCalls(events);
  const assistantText = collectAssistantText(events);

  return {
    scenario,
    chatId,
    durationMs: Date.now() - t0,
    ok: true,
    status: res.status,
    events,
    toolCalls,
    assistantText,
  };
}

async function readSseStream(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      // The AI SDK sends SSE lines as "data: {...}" or just JSON per line.
      const data = line.startsWith("data:") ? line.slice(5).trim() : line;
      if (!data || data === "[DONE]") continue;
      try {
        events.push(JSON.parse(data));
      } catch {
        // Non-JSON line — keep raw for debugging
        events.push({ type: "raw", raw: data });
      }
    }
  }
  return events;
}

function collectToolCalls(events) {
  // The AI SDK stream emits: tool-input-start / tool-input-delta / tool-input-available /
  // tool-output-available / tool-output-error. Only the *-start/available events carry
  // toolName; tool-input-delta only has the id. We coalesce by id and drop entries
  // that never received a name.
  const byId = new Map();
  for (const e of events) {
    if (!e || typeof e !== "object") continue;
    const t = e.type;
    if (typeof t !== "string") continue;
    if (!t.startsWith("tool-")) continue;
    const id = e.toolCallId ?? e.id ?? e.toolUseId;
    if (!id) continue;
    let entry = byId.get(id);
    if (!entry) {
      entry = { id, toolName: "", input: undefined, output: undefined, error: undefined, state: "" };
      byId.set(id, entry);
    }
    if (e.toolName) entry.toolName = e.toolName;
    if (t === "tool-input-start" || t === "tool-call-start") {
      entry.state = "input-start";
    } else if (t === "tool-input-available" || t === "tool-call") {
      if (e.input !== undefined) entry.input = e.input;
      entry.state = "input-available";
    } else if (t === "tool-output-available" || t === "tool-result") {
      entry.output = e.output ?? e.result;
      entry.state = "output-available";
    } else if (t === "tool-output-error" || t === "tool-error") {
      entry.error = e.errorText ?? e.error ?? String(e);
      entry.state = "error";
    }
  }
  return Array.from(byId.values()).filter((e) => e.toolName);
}

function collectAssistantText(events) {
  const out = [];
  for (const e of events) {
    if (!e || typeof e !== "object") continue;
    if (e.type === "text-delta" && typeof e.delta === "string") out.push(e.delta);
    if (e.type === "text" && typeof e.text === "string") out.push(e.text);
  }
  return out.join("");
}

function score(report) {
  const fired = report.toolCalls.map((t) => t.toolName);
  const text = report.assistantText.toLowerCase();
  const issues = [];
  const wins = [];

  // Surface stream-level errors first — rate limits aren't logic bugs.
  const streamErrors = (report.events ?? [])
    .filter((e) => e?.type === "error" && e.errorText)
    .map((e) => String(e.errorText));
  for (const err of streamErrors) {
    issues.push(`stream-error: ${err.slice(0, 160)}`);
  }
  const rateLimited = streamErrors.some((e) => /rate.?limit/i.test(e));

  const has = (name) => fired.includes(name);

  if (!has("searchProducts") && !has("clarifyIntent") && !rateLimited) {
    issues.push("never called searchProducts or clarifyIntent");
  }
  if (has("searchProducts")) wins.push("searched catalog");
  if (has("clarifyIntent")) wins.push("clarified before searching");

  if (report.scenario.tag === "broad" && !has("clarifyIntent") && !rateLimited) {
    issues.push("broad request — should have called clarifyIntent first");
  }
  if (
    report.scenario.tag === "compare" &&
    !has("compareProducts") &&
    !rateLimited
  ) {
    issues.push("compare scenario — compareProducts was not called");
  }
  if (
    report.scenario.tag === "cheapest" &&
    !has("compareSellers") &&
    !rateLimited
  ) {
    issues.push("cheapest scenario — compareSellers was not called");
  }
  if (
    (report.scenario.tag === "phone-old-vs-new" ||
      report.scenario.tag === "laptop-video") &&
    !has("assessProductFreshness") &&
    !rateLimited
  ) {
    issues.push("fast-moving category — assessProductFreshness was not called");
  }

  // Check for obvious empty errors
  for (const t of report.toolCalls) {
    if (t.error) issues.push(`tool ${t.toolName} errored: ${String(t.error).slice(0, 120)}`);
    if (
      t.output &&
      typeof t.output === "object" &&
      "error" in t.output &&
      t.output.error
    ) {
      issues.push(
        `tool ${t.toolName} returned error: ${String(t.output.error).slice(0, 120)}`
      );
    }
  }

  if (!report.assistantText.trim() && !rateLimited) {
    issues.push("no assistant text returned");
  } else if (text.startsWith("sure") || text.startsWith("i'd be happy") || text.startsWith("of course")) {
    issues.push("opens with filler phrase");
  }

  // Hard markdown violations — headings (####), HRs, or pipe tables.
  if (/(^|\n)#{1,6}\s/.test(report.assistantText) && !rateLimited) {
    issues.push("uses markdown # headings — UI already renders product cards");
  }
  if (/\n\|.*\|/.test(report.assistantText) && !rateLimited) {
    issues.push("uses markdown pipe tables — should call compareProducts instead");
  }

  return { issues, wins, fired, rateLimited };
}

function summarize(report) {
  const s = score(report);
  return {
    tag: report.scenario.tag,
    text: report.scenario.text,
    chatId: report.chatId,
    durationMs: report.durationMs,
    ok: report.ok,
    fired: s.fired,
    wins: s.wins,
    issues: s.issues,
    textPreview: report.assistantText.slice(0, 280).replace(/\s+/g, " ").trim(),
  };
}

async function main() {
  const arg = process.argv.slice(2).find((a) => a.startsWith("--only="));
  const filter = arg ? arg.slice("--only=".length) : null;
  const scenarios = filter ? SCENARIOS.filter((s) => s.tag.includes(filter)) : SCENARIOS;
  if (scenarios.length === 0) {
    console.error(`no scenarios matched --only=${filter}`);
    process.exit(2);
  }

  await fs.mkdir(TRANSCRIPT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = path.join(TRANSCRIPT_DIR, `run-${stamp}`);
  await fs.mkdir(runDir, { recursive: true });

  console.log(`backend: ${BACKEND}`);
  console.log(`model:   ${MODEL}`);
  console.log(`transcripts: ${runDir}`);

  const user = await getGuestUser();
  console.log(`guest user: ${user.id}\n`);

  const summaries = [];
  for (const s of scenarios) {
    process.stdout.write(`▶ [${s.tag}] ${s.text}\n`);
    let report;
    try {
      report = await runScenario(user, s);
    } catch (e) {
      report = {
        scenario: s,
        chatId: "",
        durationMs: 0,
        ok: false,
        error: String(e),
        events: [],
        toolCalls: [],
        assistantText: "",
      };
    }
    const summary = summarize(report);
    summaries.push(summary);
    await fs.writeFile(
      path.join(runDir, `${s.tag}.json`),
      JSON.stringify(report, null, 2)
    );
    const status = summary.issues.length === 0 ? "✓" : "✗";
    console.log(`  ${status} ${summary.fired.length} tools fired in ${summary.durationMs}ms`);
    console.log(`     fired: ${summary.fired.join(" → ") || "(none)"}`);
    if (summary.wins.length) console.log(`     wins:  ${summary.wins.join(", ")}`);
    if (summary.issues.length) console.log(`     issues:`); for (const issue of summary.issues) console.log(`       - ${issue}`);
    if (summary.textPreview) console.log(`     text:  ${summary.textPreview}`);
    console.log();
  }

  await fs.writeFile(path.join(runDir, "summary.json"), JSON.stringify(summaries, null, 2));
  const passed = summaries.filter((s) => s.issues.length === 0).length;
  console.log(`\n=== ${passed} / ${summaries.length} scenarios clean ===`);
  if (passed < summaries.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
