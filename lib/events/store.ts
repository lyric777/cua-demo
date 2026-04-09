import { create } from 'zustand';
import type {
  AgentStatus,
  ActionTypeCounts,
  BashToolResult,
  ComputerToolResult,
  EventStatus,
  ToolEvent,
} from './types';

// ── Event Store ────────────────────────────────────────────────────────────────

interface EventState {
  events: ToolEvent[];
  agentStatus: AgentStatus;
}

interface EventActions {
  addEvent: (event: ToolEvent) => void;
  updateEvent: (
    toolCallId: string,
    updates: Partial<Pick<ToolEvent, 'duration'>> & {
      status?: EventStatus;
      result?: ComputerToolResult | BashToolResult;
    },
  ) => void;
  setAgentStatus: (status: AgentStatus) => void;
  resetEvents: () => void;
}

type EventStore = EventState & EventActions;

export const useEventStore = create<EventStore>((set) => ({
  events: [],
  agentStatus: 'idle',

  addEvent: (event) =>
    set((state) => ({ events: [...state.events, event] })),

  updateEvent: (toolCallId, updates) =>
    set((state) => ({
      events: state.events.map((event) => {
        if (event.toolCallId !== toolCallId) return event;

        const base = {
          ...event,
          ...(updates.status !== undefined ? { status: updates.status } : {}),
          ...(updates.duration !== undefined ? { duration: updates.duration } : {}),
        };

        if (updates.result !== undefined) {
          if (event.type === 'computer') {
            return { ...base, result: updates.result as ComputerToolResult } as ToolEvent;
          }
          if (event.type === 'bash') {
            return { ...base, result: updates.result as BashToolResult } as ToolEvent;
          }
        }

        return base as ToolEvent;
      }),
    })),

  setAgentStatus: (status) => set({ agentStatus: status }),

  resetEvents: () => set({ events: [] }),
}));

// ── Derived Selectors ──────────────────────────────────────────────────────────

export function selectActionCounts(state: EventState): ActionTypeCounts {
  const counts = {} as ActionTypeCounts;
  for (const event of state.events) {
    const key = event.type === 'computer' ? event.action : 'bash';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export function selectEventById(
  id: string,
): (state: EventState) => ToolEvent | undefined {
  return (state) => state.events.find((e) => e.id === id);
}

// ── UI Store ───────────────────────────────────────────────────────────────────

interface UIState {
  selectedToolCallId: string | null;
  isDebugPanelOpen: boolean;
}

interface UIActions {
  setSelectedToolCallId: (id: string | null) => void;
  toggleDebugPanel: () => void;
}

type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>((set) => ({
  selectedToolCallId: null,
  isDebugPanelOpen: false,

  setSelectedToolCallId: (id) => set({ selectedToolCallId: id }),

  toggleDebugPanel: () =>
    set((state) => ({ isDebugPanelOpen: !state.isDebugPanelOpen })),
}));
