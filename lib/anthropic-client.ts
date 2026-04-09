import { createAnthropic } from "@ai-sdk/anthropic";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const proxyAgent = process.env.HTTPS_PROXY
  ? new ProxyAgent(process.env.HTTPS_PROXY)
  : undefined;

const baseURL = process.env.ANTHROPIC_BASE_URL
  ? `${process.env.ANTHROPIC_BASE_URL}/v1`
  : undefined;

const apiKey = process.env.ANTHROPIC_API_KEY;

// Custom fetch: routes through proxy and converts x-api-key -> Authorization: Bearer
// (needed for Packy and similar compatible API providers)
const customFetch: typeof fetch = (input, init) => {
  const headers = new Headers((init?.headers as HeadersInit) ?? {});

  if (baseURL && headers.has("x-api-key")) {
    const key = headers.get("x-api-key")!;
    headers.delete("x-api-key");
    if (!headers.has("authorization")) {
      headers.set("authorization", `Bearer ${key}`);
    }
  }

  return undiciFetch(input as Parameters<typeof undiciFetch>[0], {
    ...(init as Parameters<typeof undiciFetch>[1]),
    headers,
    dispatcher: proxyAgent,
  }) as unknown as Promise<Response>;
};

export const anthropic = createAnthropic({
  apiKey,
  baseURL,
  fetch: customFetch,
});
