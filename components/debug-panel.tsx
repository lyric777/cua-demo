"use client";

import { AnimatePresence, motion } from "motion/react";
import { useShallow } from "zustand/shallow";
import type { LucideIcon } from "lucide-react";
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Keyboard,
  KeyRound,
  MousePointer,
  MousePointerClick,
  ScrollText,
  Timer,
} from "lucide-react";
import {
  useEventStore,
  useUIStore,
  selectActionCounts,
} from "@/lib/events/store";
import type {
  AgentStatus,
  ComputerActionType,
  EventStatus,
  ToolEvent,
} from "@/lib/events/types";

// ── Icon map ──────────────────────────────────────────────────────────────────

const ACTION_ICONS: Record<ComputerActionType | "bash", LucideIcon> = {
  screenshot: Camera,
  left_click: MousePointerClick,
  right_click: MousePointerClick,
  double_click: MousePointerClick,
  mouse_move: MousePointer,
  type: Keyboard,
  key: KeyRound,
  wait: Timer,
  scroll: ScrollText,
  left_click_drag: MousePointer,
  middle_click: MousePointerClick,
  triple_click: MousePointerClick,
  bash: ScrollText,
};

// ── Agent status badge ─────────────────────────────────────────────────────────

function AgentStatusBadge({ status }: { status: AgentStatus }) {
  if (status === "idle") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
        idle
      </span>
    );
  }
  if (status === "thinking") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
        <span className="size-1.5 rounded-full bg-blue-500 animate-pulse" />
        thinking
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
      <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
      executing
    </span>
  );
}

// ── Status dot ─────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: EventStatus }) {
  const color = {
    pending: "bg-yellow-400",
    complete: "bg-green-500",
    error: "bg-red-500",
  }[status];
  return <span className={`inline-block size-2 rounded-full shrink-0 ${color}`} />;
}

// ── Single event row ───────────────────────────────────────────────────────────

function EventRow({ event }: { event: ToolEvent }) {
  const key = event.type === "computer" ? event.action : "bash";
  const Icon = ACTION_ICONS[key];

  return (
    <div className="flex items-center gap-2 py-1 px-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-xs">
      <span className="text-zinc-400 shrink-0 w-16 tabular-nums">
        {new Date(event.timestamp).toLocaleTimeString()}
      </span>
      <Icon className="size-3 shrink-0 text-zinc-500" />
      <span className="text-zinc-600 dark:text-zinc-400 font-mono truncate">
        {event.toolCallId.slice(0, 8)}
      </span>
      <StatusDot status={event.status} />
      {event.duration !== undefined && (
        <span className="text-zinc-400 ml-auto shrink-0">{event.duration}ms</span>
      )}
    </div>
  );
}

// ── Debug Panel ────────────────────────────────────────────────────────────────

export function DebugPanel() {
  const isOpen = useUIStore((s) => s.isDebugPanelOpen);
  const toggleDebugPanel = useUIStore((s) => s.toggleDebugPanel);
  const events = useEventStore((s) => s.events);
  const agentStatus = useEventStore((s) => s.agentStatus);
  const actionCounts = useEventStore(useShallow(selectActionCounts));

  const nonZeroCounts = (
    Object.entries(actionCounts) as [ComputerActionType | "bash", number][]
  ).filter(([, count]) => count > 0);

  const reversedEvents = [...events].reverse();

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-700">
      {/* Header */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
        onClick={toggleDebugPanel}
      >
        {isOpen ? (
          <ChevronDown className="size-3.5 text-zinc-400 shrink-0" />
        ) : (
          <ChevronUp className="size-3.5 text-zinc-400 shrink-0" />
        )}
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Debug Panel
        </span>
        <span className="ml-2">
          <AgentStatusBadge status={agentStatus} />
        </span>
        <span className="ml-auto text-xs text-zinc-400">
          {events.length} event{events.length !== 1 ? "s" : ""}
        </span>
      </button>

      {/* Collapsible content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="debug-content"
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            style={{ overflow: "hidden" }}
          >
            <div className="bg-zinc-50 dark:bg-zinc-900 max-h-48 overflow-y-auto">
              {/* Action counts */}
              {nonZeroCounts.length > 0 && (
                <div className="px-3 py-2 flex flex-wrap gap-1 border-b border-zinc-200 dark:border-zinc-700">
                  {nonZeroCounts.map(([action, count]) => (
                    <span
                      key={action}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                    >
                      {action}:<span className="font-semibold">{count}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Event timeline */}
              <div className="py-1">
                {reversedEvents.length === 0 ? (
                  <p className="text-xs text-zinc-400 px-3 py-2">No events yet.</p>
                ) : (
                  reversedEvents.map((event) => (
                    <EventRow key={event.id} event={event} />
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
