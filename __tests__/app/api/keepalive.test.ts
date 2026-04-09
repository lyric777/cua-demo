import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/keepalive/route";

// Mock the sandbox utils module
vi.mock("@/lib/sandbox/utils", () => ({
  keepAliveSandbox: vi.fn(),
}));

import { keepAliveSandbox } from "@/lib/sandbox/utils";
const mockKeepAlive = vi.mocked(keepAliveSandbox);

function makeRequest(url: string): Request {
  return new Request(url);
}

describe("GET /api/keepalive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 if sandboxId is missing", async () => {
    const req = makeRequest("http://localhost/api/keepalive");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 with alive:true when sandbox is running", async () => {
    mockKeepAlive.mockResolvedValue(true);
    const req = makeRequest(
      "http://localhost/api/keepalive?sandboxId=sb-abc123",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { alive: boolean };
    expect(body.alive).toBe(true);
    expect(mockKeepAlive).toHaveBeenCalledWith("sb-abc123");
  });

  it("returns 410 with alive:false when sandbox has expired", async () => {
    mockKeepAlive.mockResolvedValue(false);
    const req = makeRequest(
      "http://localhost/api/keepalive?sandboxId=sb-expired",
    );
    const res = await GET(req);
    expect(res.status).toBe(410);
    const body = await res.json() as { alive: boolean };
    expect(body.alive).toBe(false);
  });

  it("decodes URL-encoded sandboxId correctly", async () => {
    mockKeepAlive.mockResolvedValue(true);
    const encoded = encodeURIComponent("sb/with spaces");
    const req = makeRequest(
      `http://localhost/api/keepalive?sandboxId=${encoded}`,
    );
    await GET(req);
    expect(mockKeepAlive).toHaveBeenCalledWith("sb/with spaces");
  });
});
