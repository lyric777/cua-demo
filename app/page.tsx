"use client";

import { PreviewMessage } from "@/components/message";
import { DebugPanel } from "@/components/debug-panel";
import { VncPanel } from "@/components/vnc-panel";
import { ToolCallDetail } from "@/components/tool-call-detail";
import { useScrollToBottom } from "@/lib/use-scroll-to-bottom";
import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/input";
import { toast } from "sonner";
import { DeployButton, ProjectInfo } from "@/components/project-info";
import { AISDKLogo } from "@/components/icons";
import { PromptSuggestions } from "@/components/prompt-suggestions";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ABORTED } from "@/lib/utils";
import { useEventStore } from "@/lib/events/store";
import type {
  ComputerActionType,
  ComputerToolEvent,
  BashToolEvent,
} from "@/lib/events/types";

export default function Chat() {
  const [desktopContainerRef, desktopEndRef] = useScrollToBottom();
  const [mobileContainerRef, mobileEndRef] = useScrollToBottom();

  const [isInitializing, setIsInitializing] = useState(true);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [sandboxId, setSandboxId] = useState<string | null>(null);

  const trackedToolCallsRef = useRef<Set<string>>(new Set());
  const startTimesRef = useRef<Record<string, number>>({});

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    stop: stopGeneration,
    append,
    setMessages,
  } = useChat({
    api: "/api/chat",
    id: sandboxId ?? undefined,
    body: {
      sandboxId,
    },
    maxSteps: 30,
    onError: (error) => {
      console.error(error);
      toast.error("There was an error", {
        description: "Please try again later.",
        richColors: true,
        position: "top-center",
      });
    },
  });

  const stop = () => {
    stopGeneration();

    const lastMessage = messages.at(-1);
    const lastMessageLastPart = lastMessage?.parts.at(-1);
    if (
      lastMessage?.role === "assistant" &&
      lastMessageLastPart?.type === "tool-invocation"
    ) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          ...lastMessage,
          parts: [
            ...lastMessage.parts.slice(0, -1),
            {
              ...lastMessageLastPart,
              toolInvocation: {
                ...lastMessageLastPart.toolInvocation,
                state: "result",
                result: ABORTED,
              },
            },
          ],
        },
      ]);
    }
  };

  const isLoading = status !== "ready";

  const refreshDesktop = useCallback(async () => {
    try {
      setIsInitializing(true);
      const params = sandboxId ? `?sandboxId=${encodeURIComponent(sandboxId)}` : "";
      const res = await fetch(`/api/desktop${params}`);
      if (!res.ok) throw new Error(await res.text());
      const { streamUrl: url, id } = await res.json();
      setStreamUrl(url);
      setSandboxId(id);
    } catch (err) {
      console.error("Failed to refresh desktop:", err);
    } finally {
      setIsInitializing(false);
    }
  }, [sandboxId]);

  // Kill desktop on page close
  useEffect(() => {
    if (!sandboxId) return;

    const killDesktop = () => {
      if (!sandboxId) return;

      navigator.sendBeacon(
        `/api/kill-desktop?sandboxId=${encodeURIComponent(sandboxId)}`,
      );
    };

    // Detect iOS / Safari
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    // Choose exactly ONE event handler based on the browser
    if (isIOS || isSafari) {
      window.addEventListener("pagehide", killDesktop);

      return () => {
        window.removeEventListener("pagehide", killDesktop);
        killDesktop();
      };
    } else {
      window.addEventListener("beforeunload", killDesktop);

      return () => {
        window.removeEventListener("beforeunload", killDesktop);
        killDesktop();
      };
    }
  }, [sandboxId]);

  // Keepalive heartbeat: ping sandbox every 2 minutes to prevent idle timeout
  useEffect(() => {
    if (!sandboxId) return;
    const interval = setInterval(() => {
      fetch(`/api/keepalive?sandboxId=${encodeURIComponent(sandboxId)}`).catch(
        () => {/* best-effort, ignore errors */}
      );
    }, 120_000);
    return () => clearInterval(interval);
  }, [sandboxId]);

  useEffect(() => {
    const init = async () => {
      try {
        setIsInitializing(true);
        const params = sandboxId ? `?sandboxId=${encodeURIComponent(sandboxId)}` : "";
        const res = await fetch(`/api/desktop${params}`);
        if (!res.ok) throw new Error(await res.text());
        const { streamUrl: url, id } = await res.json();
        setStreamUrl(url);
        setSandboxId(id);
      } catch (err) {
        console.error("Failed to initialize desktop:", err);
        toast.error("Failed to initialize desktop");
      } finally {
        setIsInitializing(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wire tool call events into the event store
  useEffect(() => {
    const { addEvent, updateEvent, setAgentStatus } = useEventStore.getState();
    for (const message of messages) {
      for (const part of message.parts ?? []) {
        if (part.type !== "tool-invocation") continue;
        const { toolInvocation } = part;
        const { toolCallId, toolName } = toolInvocation;

        if (
          !trackedToolCallsRef.current.has(toolCallId) &&
          toolInvocation.state === "call"
        ) {
          trackedToolCallsRef.current.add(toolCallId);
          startTimesRef.current[toolCallId] = Date.now();

          if (toolName === "computer") {
            const computerArgs = toolInvocation.args as {
              action: ComputerActionType;
              coordinate?: [number, number];
              text?: string;
              duration?: number;
              scroll_direction?: string;
              scroll_amount?: number;
              start_coordinate?: [number, number];
            };
            const event: ComputerToolEvent = {
              id: crypto.randomUUID(),
              toolCallId,
              timestamp: Date.now(),
              status: "pending",
              type: "computer",
              action: computerArgs.action,
              ...(computerArgs.coordinate !== undefined && {
                coordinate: computerArgs.coordinate,
              }),
              ...(computerArgs.text !== undefined && { text: computerArgs.text }),
              ...(computerArgs.scroll_direction !== undefined && {
                scroll_direction: computerArgs.scroll_direction,
              }),
              ...(computerArgs.scroll_amount !== undefined && {
                scroll_amount: computerArgs.scroll_amount,
              }),
              ...(computerArgs.start_coordinate !== undefined && {
                start_coordinate: computerArgs.start_coordinate,
              }),
            };
            addEvent(event);
          } else if (toolName === "bash") {
            const bashArgs = toolInvocation.args as { command: string };
            const event: BashToolEvent = {
              id: crypto.randomUUID(),
              toolCallId,
              timestamp: Date.now(),
              status: "pending",
              type: "bash",
              command: bashArgs.command,
            };
            addEvent(event);
          }

          setAgentStatus("executing");
        } else if (
          trackedToolCallsRef.current.has(toolCallId) &&
          toolInvocation.state === "result"
        ) {
          const storeEvent = useEventStore
            .getState()
            .events.find((e) => e.toolCallId === toolCallId);

          if (storeEvent?.status === "pending") {
            const startTime = startTimesRef.current[toolCallId] ?? Date.now();
            const duration = Date.now() - startTime;

            if (toolInvocation.result === ABORTED) {
              updateEvent(toolCallId, { status: "error", duration });
            } else if (toolName === "computer") {
              const rawResult = toolInvocation.result as
                | { type: "image"; data: string }
                | { type: "text"; text: string };
              const result =
                rawResult.type === "image"
                  ? { type: "image" as const, data: rawResult.data }
                  : { type: "text" as const, text: rawResult.text };
              updateEvent(toolCallId, { status: "complete", duration, result });
            } else if (toolName === "bash") {
              const rawResult = toolInvocation.result as string;
              updateEvent(toolCallId, {
                status: "complete",
                duration,
                result: { output: rawResult },
              });
            }
          }
        }
      }
    }
  }, [messages]);

  // Sync agent status from chat status
  useEffect(() => {
    const { setAgentStatus } = useEventStore.getState();
    if (status === "ready") {
      setAgentStatus("idle");
    } else if (status === "streaming") {
      const { agentStatus } = useEventStore.getState();
      if (agentStatus !== "executing") setAgentStatus("thinking");
    }
  }, [status]);

  return (
    <div className="flex h-dvh relative">
      {/* Mobile/tablet banner */}
      <div className="flex items-center justify-center fixed left-1/2 -translate-x-1/2 top-5 shadow-md text-xs mx-auto rounded-lg h-8 w-fit bg-blue-600 text-white px-3 py-2 text-left z-50 xl:hidden">
        <span>Headless mode</span>
      </div>

      {/* Resizable Panels — desktop only */}
      <div className="w-full hidden xl:block">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Chat Panel — LEFT */}
          <ResizablePanel
            defaultSize={40}
            minSize={25}
            className="flex flex-col border-r border-zinc-200"
          >
            <div className="bg-white py-4 px-4 flex justify-between items-center">
              <AISDKLogo />
              <DeployButton />
            </div>

            <div
              className="flex-1 space-y-6 py-4 overflow-y-auto px-4"
              ref={desktopContainerRef}
            >
              {messages.length === 0 ? <ProjectInfo /> : null}
              {messages.map((message, i) => (
                <PreviewMessage
                  message={message}
                  key={message.id}
                  isLoading={isLoading}
                  status={status}
                  isLatestMessage={i === messages.length - 1}
                />
              ))}
              <div ref={desktopEndRef} className="pb-2" />
            </div>

            {messages.length === 0 && (
              <PromptSuggestions
                disabled={isInitializing}
                submitPrompt={(prompt: string) =>
                  append({ role: "user", content: prompt })
                }
              />
            )}
            <DebugPanel />
            <div className="bg-white">
              <form onSubmit={handleSubmit} className="p-4">
                <Input
                  handleInputChange={handleInputChange}
                  input={input}
                  isInitializing={isInitializing}
                  isLoading={isLoading}
                  status={status}
                  stop={stop}
                />
              </form>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* VNC Panel — RIGHT */}
          <ResizablePanel
            defaultSize={60}
            minSize={35}
            className="bg-black relative"
          >
            <VncPanel
              streamUrl={streamUrl}
              isInitializing={isInitializing}
              onRefresh={refreshDesktop}
            />
            <ToolCallDetail />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Mobile View (Chat Only) */}
      <div className="w-full xl:hidden flex flex-col">
        <div className="bg-white py-4 px-4 flex justify-between items-center">
          <AISDKLogo />
          <DeployButton />
        </div>

        <div
          className="flex-1 space-y-6 py-4 overflow-y-auto px-4"
          ref={mobileContainerRef}
        >
          {messages.length === 0 ? <ProjectInfo /> : null}
          {messages.map((message, i) => (
            <PreviewMessage
              message={message}
              key={message.id}
              isLoading={isLoading}
              status={status}
              isLatestMessage={i === messages.length - 1}
            />
          ))}
          <div ref={mobileEndRef} className="pb-2" />
        </div>

        {messages.length === 0 && (
          <PromptSuggestions
            disabled={isInitializing}
            submitPrompt={(prompt: string) =>
              append({ role: "user", content: prompt })
            }
          />
        )}
        <div className="bg-white">
          <form onSubmit={handleSubmit} className="p-4">
            <Input
              handleInputChange={handleInputChange}
              input={input}
              isInitializing={isInitializing}
              isLoading={isLoading}
              status={status}
              stop={stop}
            />
          </form>
        </div>
      </div>
    </div>
  );
}
