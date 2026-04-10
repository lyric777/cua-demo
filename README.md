<h1 align="center">AI SDK Computer Use Demo</h1>

<p align="center">
  An AI agent that controls a live remote desktop — powered by Anthropic Claude, e2b Desktop sandboxes, and the Vercel AI SDK.
</p>

<p align="center">
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#how-it-works"><strong>How It Works</strong></a> ·
  <a href="#running-locally"><strong>Running Locally</strong></a> ·
  <a href="#architecture-notes"><strong>Architecture Notes</strong></a>
</p>
<br/>

## Features

- Streaming text responses powered by the [AI SDK](https://sdk.vercel.ai/docs).
- Anthropic Claude (computer use model) with `computer` and `bash` tool capabilities.
- Remote desktop running in an [e2b](https://e2b.dev) Desktop sandbox — Chrome, window manager, and VNC streaming ready in seconds, no snapshot needed.
- Live debug panel showing every tool call event, status, duration, and a clickable detail overlay.
- [shadcn/ui](https://ui.shadcn.com/) components with [Tailwind CSS](https://tailwindcss.com).
- Built with [Next.js](https://nextjs.org) App Router.

## How It Works

On first message, the app creates an **e2b Desktop sandbox** that includes:

- **Xvnc** — a virtual X11 display server
- **openbox** — a lightweight window manager
- **noVNC + websockify** — streams the desktop to the browser via WebSocket
- **Google Chrome** — auto-launched so the AI agent has a browser ready
- **xdotool + ImageMagick** — for mouse/keyboard control and screenshots

Claude uses the `computer` tool (screenshot, click, type, scroll…) and the `bash` tool to interact with the desktop. The noVNC stream is embedded in a resizable iframe alongside the chat. A keepalive heartbeat prevents the sandbox from timing out mid-session.

### Architecture

```
User ↔ Next.js Chat UI ↔ AI SDK ↔ Claude (computer use)
                                        ↓
                                  e2b Desktop Sandbox
                              ┌─────────────────────┐
                              │  Xvnc (:99)         │
                              │  openbox             │
                              │  Chrome              │
                              │  websockify → noVNC  │
                              └─────────────────────┘
                                        ↓
                              noVNC iframe in browser
```

## Running Locally

### Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/) (or a compatible provider — see below)
- An [e2b API key](https://e2b.dev) for desktop sandboxes

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up environment variables

Copy `.env.example` to `.env.local` and fill in your keys:

```bash
cp .env.example .env.local
```

```
ANTHROPIC_API_KEY=sk-ant-...
E2B_API_KEY=e2b_...
```

**Using a compatible API provider (e.g. Packy):** set `ANTHROPIC_BASE_URL` to the provider's base URL. The client automatically converts `x-api-key` to `Authorization: Bearer` when a custom base URL is present.

```
ANTHROPIC_BASE_URL=https://www.packyapi.com
ANTHROPIC_API_KEY=your_provider_key
```

### 3. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and send a message to start a desktop session.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key (or compatible provider key) |
| `E2B_API_KEY` | Yes | e2b API key for Desktop sandbox creation |
| `ANTHROPIC_BASE_URL` | No | Override API base URL for compatible providers |
| `HTTPS_PROXY` | No | HTTP/HTTPS proxy for outbound requests |

## Architecture Notes

### State Management

All agent activity is tracked through two [Zustand](https://github.com/pmndrs/zustand) stores:

**`useEventStore`** — the event pipeline:
- Every tool call (`computer` or `bash`) dispatches a typed `ToolEvent` into the store as it enters `state: "call"`, then gets updated with result + duration when it transitions to `state: "result"`.
- Events use TypeScript discriminated unions (`ComputerToolEvent | BashToolEvent`) — no `any` casting anywhere in the pipeline.
- `agentStatus` (`idle | thinking | executing`) is derived from the AI SDK `status` field and updated alongside events.
- **Fast-stream fallback**: when the AI SDK fires `state: "result"` before React sees `state: "call"` (happens when the LLM responds very quickly), the effect inserts the event as `pending` and schedules a `setTimeout` to complete it with a realistic simulated duration, producing the same pending → complete transition visible in the debug panel.

**`useUIStore`** — lightweight UI state:
- `selectedToolCallId` — which tool call card is currently expanded in the right-panel overlay (matched by `toolCallId`, not the internal event `id`).
- `isDebugPanelOpen` — whether the collapsible debug panel is visible.

Actions are read via `useEventStore.getState()` inside `useEffect` callbacks rather than as hook subscriptions. This avoids including the actions in the effect dependency array, which would cause infinite re-render loops.

`selectActionCounts` is wrapped with Zustand's `useShallow` to prevent a new object reference on every render from triggering unnecessary updates in the debug panel.

### VNC Component Isolation

The VNC iframe lives inside a `React.memo`-wrapped component (`VncPanel`) with a custom comparator:

```ts
(prev, next) =>
  prev.streamUrl === next.streamUrl &&
  prev.isInitializing === next.isInitializing &&
  prev.onRefresh === next.onRefresh &&
  prev.onClose === next.onClose
```

The iframe **never re-renders** while Claude is streaming chat or tool results — only a genuine change to the desktop URL or initializing state triggers a re-render. The `onRefresh` and `onClose` callbacks are created with `useCallback` (keyed on `sandboxId`) so their references stay stable between renders.

### Keepalive

A `setInterval` heartbeat pings `GET /api/keepalive` every 120 seconds while a sandbox is active. This resets the e2b inactivity timer and prevents the desktop from being paused mid-session.

### Anthropic Client

`lib/anthropic-client.ts` wraps `createAnthropic` with a custom `fetch` that:
1. Routes through `HTTPS_PROXY` if set (via `undici` `ProxyAgent`).
2. Converts `x-api-key` → `Authorization: Bearer` when `ANTHROPIC_BASE_URL` is set — needed for Packy and other compatible proxy providers that use Bearer auth instead of Anthropic's default header.

