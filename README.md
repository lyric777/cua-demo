<a href="https://ai-sdk-computer-use.vercel.app">
  <h1 align="center">AI SDK Computer Use Demo</h1>
</a>

<p align="center">
  An open-source AI chatbot demonstrating computer use capabilities with Anthropic Claude Sonnet 4.5, Vercel Sandboxes, and the AI SDK by Vercel.
</p>

<p align="center">
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#how-it-works"><strong>How It Works</strong></a> ·
  <a href="#deploy-your-own"><strong>Deploy Your Own</strong></a> ·
  <a href="#running-locally"><strong>Running Locally</strong></a>
</p>
<br/>

## Features

- Streaming text responses powered by the [AI SDK](https://sdk.vercel.ai/docs).
- Anthropic Claude Sonnet 4.5 with [computer use](https://sdk.vercel.ai/docs/guides/computer-use) and bash tool capabilities.
- Remote desktop environment running in a [Vercel Sandbox](https://vercel.com/docs/vercel-sandbox) with Chrome, a window manager, and VNC streaming.
- [shadcn/ui](https://ui.shadcn.com/) components for a modern, responsive UI powered by [Tailwind CSS](https://tailwindcss.com).
- Built with the latest [Next.js](https://nextjs.org) App Router.

## How It Works

The app spins up a Vercel Sandbox from a pre-built snapshot that includes:

- **Xvnc** — a virtual X11 display server
- **openbox** — a lightweight window manager
- **noVNC + websockify** — streams the desktop to the browser via WebSocket
- **Google Chrome** — auto-launched so the AI agent has a browser ready
- **xdotool + ImageMagick** — for mouse/keyboard control and screenshots

When a user sends a message, Claude uses the `computer` tool (screenshot, click, type, scroll) and the `bash` tool (run shell commands) to interact with the sandbox desktop. The noVNC stream is displayed in a resizable iframe alongside the chat.

### Architecture

```
User ↔ Next.js Chat UI ↔ AI SDK ↔ Claude Sonnet 4.5
                                        ↓
                                  Vercel Sandbox
                              ┌─────────────────────┐
                              │  Xvnc (:99)         │
                              │  openbox             │
                              │  Chrome              │
                              │  websockify → noVNC  │
                              └─────────────────────┘
                                        ↓
                              noVNC iframe in browser
```

## Deploy Your Own

You can deploy your own version to Vercel by clicking the button below:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?project-name=AI+SDK+Computer+Use+Demo&repository-name=ai-sdk-computer-use&repository-url=https%3A%2F%2Fgithub.com%2Fvercel-labs%2Fai-sdk-computer-use&demo-title=AI+SDK+Computer+Use+Demo&demo-url=https%3A%2F%2Fai-sdk-computer-use.vercel.app%2F&demo-description=A+chatbot+application+built+with+Next.js+demonstrating+Anthropic+Claude+Sonnet+4.5+computer+use+capabilities+with+Vercel+Sandboxes&env=ANTHROPIC_API_KEY,SANDBOX_SNAPSHOT_ID)

## Running Locally

### Prerequisites

- Node.js 18+
- A [Vercel](https://vercel.com) account (for Sandbox access)
- An [Anthropic API key](https://console.anthropic.com/)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up Vercel credentials

Install the [Vercel CLI](https://vercel.com/docs/cli) and link your project:

```bash
pnpm install -g vercel
vercel link
vercel env pull
```

This creates a `.env.local` file with `VERCEL_OIDC_TOKEN` for Sandbox authentication.

Alternatively, set `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, and `VERCEL_PROJECT_ID` manually in your `.env.local`.

### 3. Create a sandbox snapshot

The snapshot pre-installs the desktop environment (Xvnc, Chrome, openbox, noVNC, xdotool, ImageMagick) so sandboxes boot in seconds.

```bash
npx tsx lib/sandbox/create-snapshot.ts
```

This takes ~10 minutes. When done, it outputs a snapshot ID. Add it to your `.env.local`:

```
SANDBOX_SNAPSHOT_ID=snap_xxxxxxxxxxxxx
```

### 4. Add your Anthropic API key

```
ANTHROPIC_API_KEY=sk-ant-...
```

### 5. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to use the computer use agent.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude |
| `SANDBOX_SNAPSHOT_ID` | Yes | Vercel Sandbox snapshot with the desktop environment |
| `VERCEL_OIDC_TOKEN` | Yes* | Auto-set by `vercel env pull` for Sandbox auth |
| `VERCEL_TOKEN` | Alt* | Alternative to OIDC — a Vercel personal access token |
| `VERCEL_TEAM_ID` | Alt* | Required with `VERCEL_TOKEN` |
| `VERCEL_PROJECT_ID` | Alt* | Required with `VERCEL_TOKEN` |

\* Either `VERCEL_OIDC_TOKEN` (via `vercel env pull`) or the `VERCEL_TOKEN` + team/project IDs are required for Sandbox authentication.

## Part 1 Architecture Notes

### State Management

All agent activity is tracked through two [Zustand](https://github.com/pmndrs/zustand) stores:

**`useEventStore`** — the event pipeline:
- Every tool call (`computer` or `bash`) dispatches a typed `ToolEvent` into the store as it enters `state: "call"`, then gets updated with result + duration when it transitions to `state: "result"`.
- Events use TypeScript discriminated unions (`ComputerToolEvent | BashToolEvent`) so there is no `any` casting anywhere in the pipeline.
- `agentStatus` (`idle | thinking | executing`) is derived from the AI SDK `status` field and updated alongside events.

**`useUIStore`** — lightweight UI state:
- `selectedToolCallId` — which tool call card is currently expanded in the right-panel overlay.
- `isDebugPanelOpen` — whether the collapsible debug panel is visible.

Actions are read via `useEventStore.getState()` inside `useEffect` callbacks rather than as hook subscriptions. This avoids including the actions themselves in the effect dependency array, which would cause infinite re-render loops.

`selectActionCounts` (a plain selector function that returns a `Record<ActionType, number>`) is wrapped with Zustand's `useShallow` to prevent a new object reference on every render from triggering unnecessary updates in the debug panel.

### VNC Component Isolation

The VNC iframe lives inside a `React.memo`-wrapped component (`VncPanel`) with a custom comparator:

```ts
(prev, next) =>
  prev.streamUrl === next.streamUrl &&
  prev.isInitializing === next.isInitializing &&
  prev.onRefresh === next.onRefresh &&
  prev.onClose === next.onClose
```

This means the iframe **never re-renders** while Claude is streaming chat or tool results — only a genuine change to the desktop URL or initializing state triggers a re-render. The `onRefresh` and `onClose` callbacks are both created with `useCallback` (keyed on `sandboxId`) so their references stay stable between renders.

### Keepalive

A `setInterval` heartbeat in `page.tsx` pings `GET /api/keepalive` every 120 seconds while a sandbox is active. This resets the e2b inactivity timer and prevents the desktop from being paused mid-session.
