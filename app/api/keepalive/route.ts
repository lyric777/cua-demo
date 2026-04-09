import { keepAliveSandbox } from "@/lib/sandbox/utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sandboxId = searchParams.get("sandboxId");

  if (!sandboxId) {
    return new Response("No sandboxId provided", { status: 400 });
  }

  const alive = await keepAliveSandbox(sandboxId);
  return new Response(JSON.stringify({ alive }), {
    status: alive ? 200 : 410,
    headers: { "Content-Type": "application/json" },
  });
}
