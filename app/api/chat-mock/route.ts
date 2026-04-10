// Mock /api/chat — returns a pre-baked AI SDK data stream without calling Anthropic.
// Mimics a real agent session: text → screenshot → click → type → key → screenshot → bash → text.

export const maxDuration = 30;

// Tiny 1×1 black PNG in base64 (placeholder for screenshot results)
const FAKE_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII=";

function line(chunk: string) {
  return `${chunk}\n`;
}

// AI SDK data stream protocol lines
function textPart(text: string) {
  return line(`0:${JSON.stringify(text)}`);
}

function toolCallStart(toolCallId: string, toolName: string) {
  return line(
    `b:${JSON.stringify({ toolCallId, toolName })}`
  );
}

function toolCallDelta(toolCallId: string, argsTextDelta: string) {
  return line(
    `c:${JSON.stringify({ toolCallId, argsTextDelta })}`
  );
}

function toolResult(toolCallId: string, toolName: string, args: unknown, result: unknown) {
  return line(
    `a:${JSON.stringify({ toolCallId, toolName, args, result })}`
  );
}

function finishMessage(finishReason = "tool-calls", usage = { promptTokens: 120, completionTokens: 80 }) {
  return line(`e:${JSON.stringify({ finishReason, usage, isContinued: false })}`);
}

function finalFinish() {
  return line(`d:${JSON.stringify({ finishReason: "stop", usage: { promptTokens: 400, completionTokens: 200 } })}`);
}

async function* generateStream() {
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Unique prefix per request so each session gets fresh tool call IDs
  // (prevents trackedToolCallsRef from skipping re-runs of the mock)
  const pfx = Math.random().toString(36).slice(2, 7);
  // ── Turn 1: text + screenshot ────────────────────────────────────────────
  yield textPart("I'll help you navigate to Wikipedia. Let me take a screenshot first to see the current state of the browser.");
  await delay(600);

  const ss1Id = `${pfx}-screenshot-1`;
  yield toolCallStart(ss1Id, "computer");
  yield toolCallDelta(ss1Id, JSON.stringify({ action: "screenshot" }));
  await delay(1500);
  yield toolResult(ss1Id, "computer", { action: "screenshot" }, { type: "image", data: FAKE_PNG });
  yield finishMessage();

  // ── Turn 2: text + left_click ────────────────────────────────────────────
  yield textPart("I can see Google Chrome is open. I'll click on the address bar.");
  await delay(600);

  const clickId = `${pfx}-click-1`;
  yield toolCallStart(clickId, "computer");
  yield toolCallDelta(clickId, JSON.stringify({ action: "left_click", coordinate: [530, 118] }));
  await delay(1500);
  yield toolResult(clickId, "computer", { action: "left_click", coordinate: [530, 118] }, { type: "text", text: "Left clicked at 530, 118" });
  yield finishMessage();

  // ── Turn 3: type + key ───────────────────────────────────────────────────
  yield textPart("Now I'll type the URL.");
  await delay(400);

  const typeId = `${pfx}-type-1`;
  yield toolCallStart(typeId, "computer");
  yield toolCallDelta(typeId, JSON.stringify({ action: "type", text: "wikipedia.org" }));
  await delay(1200);
  yield toolResult(typeId, "computer", { action: "type", text: "wikipedia.org" }, { type: "text", text: "Typed: wikipedia.org" });

  const keyId = `${pfx}-key-1`;
  yield toolCallStart(keyId, "computer");
  yield toolCallDelta(keyId, JSON.stringify({ action: "key", text: "Return" }));
  await delay(1000);
  yield toolResult(keyId, "computer", { action: "key", text: "Return" }, { type: "text", text: "Pressed key: Return" });
  yield finishMessage();

  // ── Turn 4: screenshot ───────────────────────────────────────────────────
  yield textPart("Let me take another screenshot to confirm Wikipedia loaded.");
  await delay(800);

  const ss2Id = `${pfx}-screenshot-2`;
  yield toolCallStart(ss2Id, "computer");
  yield toolCallDelta(ss2Id, JSON.stringify({ action: "screenshot" }));
  await delay(1500);
  yield toolResult(ss2Id, "computer", { action: "screenshot" }, { type: "image", data: FAKE_PNG });
  yield finishMessage();

  // ── Turn 5: bash ─────────────────────────────────────────────────────────
  yield textPart("I'll also run a quick bash command to verify the environment.");
  await delay(600);

  const bashId = `${pfx}-bash-1`;
  yield toolCallStart(bashId, "bash");
  yield toolCallDelta(bashId, JSON.stringify({ command: "echo 'Wikipedia loaded successfully' && date" }));
  await delay(1500);
  yield toolResult(bashId, "bash", { command: "echo 'Wikipedia loaded successfully' && date" }, "Wikipedia loaded successfully\nFri Apr 10 13:30:00 UTC 2026");
  yield finishMessage();

  // ── Final text ───────────────────────────────────────────────────────────
  await delay(200);
  yield textPart("Done! I've successfully navigated to wikipedia.org and confirmed the page loaded. You can click on any of the tool call cards above to inspect the details.");
  yield finalFinish();
}

export async function POST() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of generateStream()) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "x-vercel-ai-data-stream": "v1",
    },
  });
}
