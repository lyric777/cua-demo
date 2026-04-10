import { describe, it, expect, beforeEach } from "vitest";
import {
  useEventStore,
  useUIStore,
  selectActionCounts,
  selectEventById,
} from "@/lib/events/store";
import type { BashToolEvent, ComputerToolEvent } from "@/lib/events/types";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeComputerEvent(
  overrides: Partial<ComputerToolEvent> = {},
): ComputerToolEvent {
  return {
    id: "evt-1",
    toolCallId: "tc-1",
    timestamp: 1000,
    status: "pending",
    type: "computer",
    action: "screenshot",
    ...overrides,
  };
}

function makeBashEvent(overrides: Partial<BashToolEvent> = {}): BashToolEvent {
  return {
    id: "evt-bash-1",
    toolCallId: "tc-bash-1",
    timestamp: 2000,
    status: "pending",
    type: "bash",
    command: "echo hello",
    ...overrides,
  };
}

// ── Reset store before every test ──────────────────────────────────────────────

beforeEach(() => {
  useEventStore.getState().resetEvents();
  useEventStore.setState({ agentStatus: "idle" });
  useUIStore.setState({ selectedToolCallId: null, isDebugPanelOpen: false });
});

// ── addEvent ───────────────────────────────────────────────────────────────────

describe("addEvent", () => {
  it("appends a computer event to the store", () => {
    const event = makeComputerEvent();
    useEventStore.getState().addEvent(event);

    const { events } = useEventStore.getState();
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(event);
  });

  it("appends a bash event to the store", () => {
    const event = makeBashEvent();
    useEventStore.getState().addEvent(event);

    const { events } = useEventStore.getState();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("bash");
  });

  it("appends multiple events in order", () => {
    useEventStore.getState().addEvent(makeComputerEvent({ id: "a" }));
    useEventStore.getState().addEvent(makeBashEvent({ id: "b" }));

    const { events } = useEventStore.getState();
    expect(events).toHaveLength(2);
    expect(events[0].id).toBe("a");
    expect(events[1].id).toBe("b");
  });
});

// ── updateEvent ────────────────────────────────────────────────────────────────

describe("updateEvent", () => {
  it("updates status and duration on a computer event", () => {
    useEventStore.getState().addEvent(makeComputerEvent());
    useEventStore
      .getState()
      .updateEvent("tc-1", { status: "complete", duration: 350 });

    const event = useEventStore.getState().events[0];
    expect(event.status).toBe("complete");
    expect(event.duration).toBe(350);
  });

  it("sets image result on a computer event", () => {
    useEventStore.getState().addEvent(makeComputerEvent());
    useEventStore.getState().updateEvent("tc-1", {
      status: "complete",
      duration: 100,
      result: { type: "image", data: "base64data" },
    });

    const event = useEventStore.getState().events[0] as ComputerToolEvent;
    expect(event.result).toEqual({ type: "image", data: "base64data" });
  });

  it("sets output result on a bash event", () => {
    useEventStore.getState().addEvent(makeBashEvent());
    useEventStore.getState().updateEvent("tc-bash-1", {
      status: "complete",
      duration: 42,
      result: { output: "hello\n" },
    });

    const event = useEventStore.getState().events[0] as BashToolEvent;
    expect(event.result).toEqual({ output: "hello\n" });
  });

  it("marks a bash event as error with no result", () => {
    useEventStore.getState().addEvent(makeBashEvent());
    useEventStore
      .getState()
      .updateEvent("tc-bash-1", { status: "error", duration: 10 });

    const event = useEventStore.getState().events[0];
    expect(event.status).toBe("error");
    expect(event.duration).toBe(10);
  });

  it("is a no-op for an unknown toolCallId", () => {
    useEventStore.getState().addEvent(makeComputerEvent());
    useEventStore
      .getState()
      .updateEvent("nonexistent", { status: "complete" });

    // Original event is unchanged
    expect(useEventStore.getState().events[0].status).toBe("pending");
  });

  it("does not mutate other events when updating one", () => {
    useEventStore
      .getState()
      .addEvent(makeComputerEvent({ id: "a", toolCallId: "tc-a" }));
    useEventStore
      .getState()
      .addEvent(makeBashEvent({ id: "b", toolCallId: "tc-b" }));

    useEventStore
      .getState()
      .updateEvent("tc-a", { status: "complete", duration: 5 });

    const [a, b] = useEventStore.getState().events;
    expect(a.status).toBe("complete");
    expect(b.status).toBe("pending");
  });
});

// ── resetEvents ────────────────────────────────────────────────────────────────

describe("resetEvents", () => {
  it("clears all events", () => {
    useEventStore.getState().addEvent(makeComputerEvent());
    useEventStore.getState().addEvent(makeBashEvent());
    useEventStore.getState().resetEvents();

    expect(useEventStore.getState().events).toHaveLength(0);
  });
});

// ── setAgentStatus ─────────────────────────────────────────────────────────────

describe("setAgentStatus", () => {
  it("transitions from idle to executing", () => {
    useEventStore.getState().setAgentStatus("executing");
    expect(useEventStore.getState().agentStatus).toBe("executing");
  });

  it("transitions to thinking", () => {
    useEventStore.getState().setAgentStatus("thinking");
    expect(useEventStore.getState().agentStatus).toBe("thinking");
  });

  it("transitions back to idle", () => {
    useEventStore.getState().setAgentStatus("executing");
    useEventStore.getState().setAgentStatus("idle");
    expect(useEventStore.getState().agentStatus).toBe("idle");
  });
});

// ── selectActionCounts ─────────────────────────────────────────────────────────

describe("selectActionCounts", () => {
  it("returns empty object when no events", () => {
    const counts = selectActionCounts(useEventStore.getState());
    expect(counts).toEqual({});
  });

  it("counts screenshot events", () => {
    useEventStore
      .getState()
      .addEvent(makeComputerEvent({ id: "a", toolCallId: "tc-a" }));
    useEventStore
      .getState()
      .addEvent(
        makeComputerEvent({ id: "b", toolCallId: "tc-b", action: "screenshot" }),
      );

    const counts = selectActionCounts(useEventStore.getState());
    expect(counts.screenshot).toBe(2);
  });

  it("counts mixed action types correctly", () => {
    useEventStore
      .getState()
      .addEvent(makeComputerEvent({ id: "a", toolCallId: "tc-a", action: "screenshot" }));
    useEventStore
      .getState()
      .addEvent(makeComputerEvent({ id: "b", toolCallId: "tc-b", action: "left_click" }));
    useEventStore.getState().addEvent(makeBashEvent());

    const counts = selectActionCounts(useEventStore.getState());
    expect(counts.screenshot).toBe(1);
    expect(counts.left_click).toBe(1);
    expect(counts.bash).toBe(1);
  });

  it("does not include action types with zero count", () => {
    useEventStore
      .getState()
      .addEvent(makeComputerEvent({ action: "screenshot" }));
    const counts = selectActionCounts(useEventStore.getState());
    expect(counts.left_click).toBeUndefined();
  });
});

// ── selectEventById ────────────────────────────────────────────────────────────

describe("selectEventById", () => {
  it("returns the matching event by toolCallId", () => {
    const event = makeComputerEvent({ toolCallId: "target-tc" });
    useEventStore.getState().addEvent(event);

    const selector = selectEventById("target-tc");
    const found = selector(useEventStore.getState());
    expect(found).toEqual(event);
  });

  it("returns undefined for a missing toolCallId", () => {
    useEventStore.getState().addEvent(makeComputerEvent({ toolCallId: "real-tc" }));

    const selector = selectEventById("wrong-tc");
    expect(selector(useEventStore.getState())).toBeUndefined();
  });
});

// ── useUIStore ─────────────────────────────────────────────────────────────────

describe("useUIStore", () => {
  it("sets selected tool call id", () => {
    useUIStore.getState().setSelectedToolCallId("tc-abc");
    expect(useUIStore.getState().selectedToolCallId).toBe("tc-abc");
  });

  it("clears selected tool call id", () => {
    useUIStore.getState().setSelectedToolCallId("tc-abc");
    useUIStore.getState().setSelectedToolCallId(null);
    expect(useUIStore.getState().selectedToolCallId).toBeNull();
  });

  it("toggles debug panel open/closed", () => {
    expect(useUIStore.getState().isDebugPanelOpen).toBe(false);
    useUIStore.getState().toggleDebugPanel();
    expect(useUIStore.getState().isDebugPanelOpen).toBe(true);
    useUIStore.getState().toggleDebugPanel();
    expect(useUIStore.getState().isDebugPanelOpen).toBe(false);
  });
});
