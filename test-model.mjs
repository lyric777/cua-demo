/**
 * 测试 packyapi 上的模型是否可用
 * 用法: node test-model.mjs
 * 需要 .env.local 中有 ANTHROPIC_API_KEY 和 ANTHROPIC_BASE_URL
 */
import { readFileSync, existsSync } from "fs";

// 手动解析 .env.local
function loadEnv() {
  const file = ".env.local";
  if (!existsSync(file)) {
    console.error("❌ 找不到 .env.local，请先创建");
    process.exit(1);
  }
  for (const line of readFileSync(file, "utf-8").split("\n")) {
    const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

loadEnv();

const MODEL = "claude-sonnet-4-5-20250929";
const BASE_URL = process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com";
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error("❌ ANTHROPIC_API_KEY 未设置");
  process.exit(1);
}

console.log(`📡 Base URL : ${BASE_URL}`);
console.log(`🤖 Model   : ${MODEL}`);
console.log("📤 发送测试请求...\n");

// ① 先测试普通对话（最省 token）
const body = JSON.stringify({
  model: MODEL,
  max_tokens: 10,
  messages: [{ role: "user", content: "Hi" }],
});

const res = await fetch(`${BASE_URL}/v1/messages`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${API_KEY}`,
    "anthropic-version": "2023-06-01",
  },
  body,
});

const data = await res.json();

if (!res.ok) {
  console.error(`❌ 普通对话请求失败 (${res.status})`);
  console.error(JSON.stringify(data, null, 2));
  process.exit(1);
}

console.log(`✅ 普通对话 OK (${res.status})`);
console.log(`   回复: ${data.content?.[0]?.text ?? "(空)"}`);
console.log(`   input_tokens: ${data.usage?.input_tokens}, output_tokens: ${data.usage?.output_tokens}\n`);

// ② 测试 computer use beta（带 beta header + computer tool）
const bodyWithTool = JSON.stringify({
  model: MODEL,
  max_tokens: 10,
  tools: [
    {
      type: "computer_20250124",
      name: "computer",
      display_width_px: 1024,
      display_height_px: 768,
    },
  ],
  messages: [{ role: "user", content: "Take a screenshot" }],
});

const res2 = await fetch(`${BASE_URL}/v1/messages`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${API_KEY}`,
    "anthropic-version": "2023-06-01",
    "anthropic-beta": "computer-use-2025-01-22",
  },
  body: bodyWithTool,
});

const data2 = await res2.json();

if (!res2.ok) {
  console.error(`❌ Computer use 请求失败 (${res2.status})`);
  console.error(JSON.stringify(data2, null, 2));
  process.exit(1);
}

console.log(`✅ Computer use OK (${res2.status})`);
console.log(`   stop_reason: ${data2.stop_reason}`);
console.log(`   input_tokens: ${data2.usage?.input_tokens}, output_tokens: ${data2.usage?.output_tokens}`);
console.log("\n🎉 模型支持普通对话 + computer use，可以直接在 app 里用！");
