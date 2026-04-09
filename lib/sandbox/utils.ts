"use server";

import { Sandbox } from "@e2b/desktop";

export const getDesktop = async (id?: string): Promise<Sandbox> => {
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

    // stream.getUrl() defaults: autoConnect=true, resize='scale'
    const streamUrl = desktop.stream.getUrl();
    return { streamUrl, id: desktop.sandboxId };
  } catch (error) {
    console.error("Error in getDesktopURL:", error);
    throw error;
  }
};

export const killDesktop = async (id: string) => {
  try {
    const sandbox = await Sandbox.connect(id);
    await sandbox.kill();
  } catch (error) {
    console.error("Error killing desktop:", error);
  }
};

/** Run a no-op command to keep the sandbox from timing out due to inactivity. */
export const keepAliveSandbox = async (id: string): Promise<boolean> => {
  try {
    const sandbox = await Sandbox.connect(id);
    await sandbox.commands.run("true");
    return true;
  } catch {
    return false;
  }
};
