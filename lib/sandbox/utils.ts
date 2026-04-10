"use server";

import type { Sandbox } from "@e2b/desktop";

// Use dynamic import so Node.js loads the ESM build (dist/index.mjs) of e2b,
// which supports chalk@5. Static import causes webpack to emit require() which
// loads the CJS build and then fails to require() chalk (ESM-only).
const getSandboxClass = async (): Promise<typeof Sandbox> => {
  const { Sandbox } = await import("@e2b/desktop");
  return Sandbox;
};

export const getDesktop = async (id?: string): Promise<Sandbox> => {
  const Sandbox = await getSandboxClass();
  if (id) {
    try {
      return await Sandbox.connect(id);
    } catch {
      // Sandbox expired or not found — fall through to create a new one
    }
  }

  const desktop = await Sandbox.create({ timeoutMs: 2600000 });

  // Start the VNC stream
  await desktop.stream.start();

  // Launch Chrome so the AI has a browser ready
  await desktop.launch("google-chrome");

  // Wait for Chrome to open
  await desktop.wait(3000);

  return desktop;
};

export const getDesktopURL = async (id?: string) => {
  const Sandbox = await getSandboxClass();
  try {
    if (id) {
      try {
        const desktop = await Sandbox.connect(id);
        // Reconstruct stable stream URL from sandbox host (stream already running in sandbox)
        const streamUrl = `https://${desktop.getHost(6080)}/vnc.html?autoconnect=true&resize=scale&reconnect=true`;
        return { streamUrl, id: desktop.sandboxId };
      } catch {
        // Sandbox expired or not found — fall through to create a new one
      }
    }

    const desktop = await Sandbox.create({ timeoutMs: 2600000 });
    await desktop.stream.start();
    await desktop.launch("google-chrome");
    await desktop.wait(3000);

    const streamUrl = desktop.stream.getUrl();
    return { streamUrl, id: desktop.sandboxId };
  } catch (error) {
    console.error("[desktop] Error in getDesktopURL:", String(error));
    throw error;
  }
};

export const killDesktop = async (id: string) => {
  const Sandbox = await getSandboxClass();
  try {
    const sandbox = await Sandbox.connect(id);
    await sandbox.kill();
  } catch (error) {
    // Sandbox already gone — not an error worth logging
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("not found") && !message.includes("NotFound")) {
      console.error("Error killing desktop:", error);
    }
  }
};

/** Run a no-op command to keep the sandbox from timing out due to inactivity. */
export const keepAliveSandbox = async (id: string): Promise<boolean> => {
  const Sandbox = await getSandboxClass();
  try {
    const sandbox = await Sandbox.connect(id);
    await sandbox.commands.run("true");
    return true;
  } catch {
    return false;
  }
};
