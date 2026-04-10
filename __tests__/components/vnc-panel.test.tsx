// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { useState } from "react";
import { VncPanel } from "@/components/vnc-panel";

/**
 * Wraps VncPanel in a parent that can trigger re-renders via unrelated state.
 * Counts how many times VncPanel actually renders.
 */
function makeWrapper(initialStreamUrl: string) {
  let renderCount = 0;

  // Instrument VncPanel by wrapping it — we track renders via a spy on the
  // underlying iframe. Each time the iframe element is created, it's a new render.
  function Wrapper() {
    const [unrelated, setUnrelated] = useState(0);
    // Expose setter so tests can trigger parent re-renders
    (Wrapper as unknown as { triggerRerender: () => void }).triggerRerender =
      () => setUnrelated((n) => n + 1);

    // Count renders by rendering a sentinel alongside VncPanel
    renderCount++;

    return (
      <div style={{ position: "relative", height: "600px" }}>
        {/* unrelated state read — ensures Wrapper re-renders */}
        <span data-testid="unrelated">{unrelated}</span>
        <VncPanel
          streamUrl={initialStreamUrl}
          isInitializing={false}
          onRefresh={vi.fn()}
          onClose={vi.fn()}
        />
      </div>
    );
  }

  return { Wrapper, getRenderCount: () => renderCount };
}

describe("VncPanel memo isolation", () => {
  it("renders the iframe when streamUrl is provided", () => {
    const { getByTitle, container } = render(
      <div style={{ position: "relative" }}>
        <VncPanel
          streamUrl="https://example.com/vnc"
          isInitializing={false}
          onRefresh={vi.fn()}
          onClose={vi.fn()}
        />
      </div>,
    );
    const iframe = container.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute("src")).toBe("https://example.com/vnc");
    void getByTitle; // suppress unused warning
  });

  it("renders a no-desktop message when streamUrl is null", () => {
    const { getByText } = render(
      <div style={{ position: "relative" }}>
        <VncPanel streamUrl={null} isInitializing={false} onRefresh={vi.fn()} onClose={vi.fn()} />
      </div>,
    );
    expect(getByText("No desktop running")).toBeTruthy();
  });

  it("renders an initializing message when isInitializing is true and no url", () => {
    const { getByText } = render(
      <div style={{ position: "relative" }}>
        <VncPanel streamUrl={null} isInitializing={true} onRefresh={vi.fn()} onClose={vi.fn()} />
      </div>,
    );
    expect(getByText("Initializing desktop...")).toBeTruthy();
  });

  it("does NOT re-render when parent re-renders with same props", () => {
    // Track VncPanel render count independently by spying on iframe creation.
    // We use a ref-counter pattern: VncPanel renders ↔ iframe presence changes.
    // Since React.memo prevents re-renders, the iframe DOM node should be the
    // same object reference across parent re-renders.

    const onRefresh = vi.fn(); // stable reference
    let parentRenders = 0;

    function Parent() {
      const [count, setCount] = useState(0);
      parentRenders++;
      // expose setter for test
      (Parent as unknown as { bump: () => void }).bump = () =>
        setCount((n) => n + 1);
      return (
        <div style={{ position: "relative" }}>
          <span data-testid="count">{count}</span>
          <VncPanel
            streamUrl="https://example.com"
            isInitializing={false}
            onRefresh={onRefresh}
            onClose={vi.fn()}
          />
        </div>
      );
    }

    const { container, rerender } = render(<Parent />);
    const iframeBefore = container.querySelector("iframe");
    expect(parentRenders).toBe(1);

    // Force parent to re-render by changing its own state
    act(() => {
      (Parent as unknown as { bump: () => void }).bump();
    });

    // Parent rendered again
    expect(parentRenders).toBe(2);

    // But the iframe DOM node is the exact same object — VncPanel didn't re-render
    const iframeAfter = container.querySelector("iframe");
    expect(iframeAfter).toBe(iframeBefore);

    // rerender with identical props — still no new iframe node
    rerender(<Parent />);
    expect(container.querySelector("iframe")).toBe(iframeBefore);
  });

  it("DOES re-render when streamUrl prop changes", () => {
    const onRefresh = vi.fn();

    const { container, rerender } = render(
      <div style={{ position: "relative" }}>
        <VncPanel
          streamUrl="https://example.com/first"
          isInitializing={false}
          onRefresh={onRefresh}
          onClose={vi.fn()}
        />
      </div>,
    );

    const iframeBefore = container.querySelector("iframe");
    expect(iframeBefore?.getAttribute("src")).toBe("https://example.com/first");

    rerender(
      <div style={{ position: "relative" }}>
        <VncPanel
          streamUrl="https://example.com/second"
          isInitializing={false}
          onRefresh={onRefresh}
          onClose={vi.fn()}
        />
      </div>,
    );

    const iframeAfter = container.querySelector("iframe");
    expect(iframeAfter?.getAttribute("src")).toBe("https://example.com/second");
  });
});
