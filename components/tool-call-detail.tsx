"use client";

import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useEventStore, useUIStore, selectEventById } from "@/lib/events/store";
import type { ComputerToolEvent, BashToolEvent } from "@/lib/events/types";

function StatusBadge({ status }: { status: "pending" | "complete" | "error" }) {
  const styles = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    complete: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    error: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}

function ComputerDetail({ event }: { event: ComputerToolEvent }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Computer Action</h2>
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-xs font-mono text-zinc-700 dark:text-zinc-300">
          {event.action}
        </span>
        <StatusBadge status={event.status} />
      </div>

      {event.duration !== undefined && (
        <p className="text-xs text-zinc-500">Duration: {event.duration}ms</p>
      )}
      {event.coordinate !== undefined && (
        <p className="text-xs text-zinc-500">
          Position: ({event.coordinate[0]}, {event.coordinate[1]})
        </p>
      )}
      {event.text !== undefined && (
        <p className="text-xs text-zinc-500">Text: {event.text}</p>
      )}

      {event.result && (
        <div className="mt-2">
          {event.result.type === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:image/png;base64,${event.result.data}`}
              className="w-full rounded"
              alt="Screenshot result"
            />
          )}
          {event.result.type === "text" && (
            <pre className="bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 p-3 rounded text-xs font-mono overflow-auto max-h-48 whitespace-pre-wrap">
              {event.result.text}
            </pre>
          )}
          {event.result.type === "error" && (
            <p className="text-red-600 dark:text-red-400 text-xs">{event.result.error}</p>
          )}
        </div>
      )}
    </div>
  );
}

function BashDetail({ event }: { event: BashToolEvent }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Bash Command</h2>
        <StatusBadge status={event.status} />
      </div>

      <pre className="bg-zinc-900 text-green-400 p-3 rounded text-xs font-mono overflow-auto max-h-32">
        {event.command}
      </pre>

      {event.duration !== undefined && (
        <p className="text-xs text-zinc-500">Duration: {event.duration}ms</p>
      )}

      {event.result && (
        <div className="mt-2">
          {"output" in event.result ? (
            <pre className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 p-3 rounded text-xs font-mono overflow-auto max-h-48 whitespace-pre-wrap">
              {event.result.output}
            </pre>
          ) : (
            <pre className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 p-3 rounded text-xs font-mono overflow-auto max-h-48 whitespace-pre-wrap">
              {event.result.error}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export function ToolCallDetail() {
  const selectedToolCallId = useUIStore((s) => s.selectedToolCallId);
  const setSelectedToolCallId = useUIStore((s) => s.setSelectedToolCallId);
  const event = useEventStore(selectEventById(selectedToolCallId ?? ""));

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setSelectedToolCallId(null)}
        >
          <motion.div
            className="relative bg-white dark:bg-zinc-900 rounded-xl p-4 max-w-2xl max-h-[80vh] overflow-auto shadow-2xl mx-4 w-full"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-3 right-3 p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              onClick={() => setSelectedToolCallId(null)}
              aria-label="Close"
            >
              <X className="size-4" />
            </button>

            {event.type === "computer" ? (
              <ComputerDetail event={event} />
            ) : (
              <BashDetail event={event} />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
