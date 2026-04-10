import { getDesktopURL } from "@/lib/sandbox/utils";

export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sandboxId = searchParams.get("sandboxId") ?? undefined;

  try {
    const result = await getDesktopURL(sandboxId);
    return Response.json(result);
  } catch (error) {
    console.error("[desktop route] Error:", String(error));
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to initialize desktop" },
      { status: 500 }
    );
  }
}
