import { describe, expect, it } from "vitest";
import { layoutLabels, type LabelCandidate } from "./labelLayout";

/** Mirrors the module's own box metrics, so a drift in either side shows up. */
function boxOf(label: { x: number; y: number; text: string; fontSize: number }) {
  const width = label.text.length * label.fontSize * 0.6;
  return {
    left: label.x - width / 2,
    right: label.x + width / 2,
    top: label.y - label.fontSize * 0.8,
    bottom: label.y + label.fontSize * 0.25,
  };
}

function anyOverlap(labels: ReturnType<typeof layoutLabels>): boolean {
  for (let i = 0; i < labels.length; i += 1) {
    for (let j = i + 1; j < labels.length; j += 1) {
      const a = boxOf(labels[i]);
      const b = boxOf(labels[j]);
      if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) {
        return true;
      }
    }
  }
  return false;
}

function candidate(overrides: Partial<LabelCandidate> = {}): LabelCandidate {
  return {
    id: "a",
    x: 0,
    y: 0,
    text: "-22.5 kN·m",
    fontSize: 4,
    pushX: 0,
    pushY: -1,
    priority: 0,
    ...overrides,
  };
}

describe("layoutLabels", () => {
  it("separates two labels asking for the same point", () => {
    const placed = layoutLabels([
      candidate({ id: "a", text: "11.2 kN·m" }),
      candidate({ id: "b", text: "30.0 kN" }),
    ]);
    expect(placed).toHaveLength(2);
    expect(anyOverlap(placed)).toBe(false);
  });

  it("drops a repeat of the same value at the same joint", () => {
    // Two members meeting at a joint each label it, and at a continuous joint
    // they agree. The second is repetition, not information.
    const placed = layoutLabels([
      candidate({ id: "a", x: 0, y: 0 }),
      candidate({ id: "b", x: 1, y: 1 }),
    ]);
    expect(placed).toHaveLength(1);
  });

  it("keeps the same value when it occurs somewhere else entirely", () => {
    const placed = layoutLabels([
      candidate({ id: "a", x: 0, y: 0 }),
      candidate({ id: "b", x: 400, y: 300 }),
    ]);
    expect(placed).toHaveLength(2);
  });

  it("leaves the first label exactly where it asked to be", () => {
    // Nothing moves unless it has to: the formula placement is the correct one
    // and displacement is a concession.
    const placed = layoutLabels([candidate({ x: 12, y: -30 })]);
    expect(placed[0].x).toBe(12);
    expect(placed[0].y).toBe(-30);
  });

  it("moves a label along its own axis, never sideways off it", () => {
    const placed = layoutLabels([
      candidate({ id: "a", text: "AAAA" }),
      candidate({ id: "b", text: "BBBB", pushX: 0, pushY: -1 }),
    ]);
    const moved = placed.find((l) => l.id === "b")!;
    // Displaced along its own vector only: x is untouched.
    expect(moved.x).toBe(0);
    expect(moved.y).not.toBe(0);
  });

  it("keeps values and yields the member name when both cannot fit", () => {
    const placed = layoutLabels([
      candidate({ id: "value-1", text: "-22.5 kN·m", priority: 0 }),
      candidate({ id: "name-1", text: "E1", priority: 1, pushX: 1, pushY: 0 }),
    ]);
    const value = placed.find((l) => l.id === "value-1")!;
    // The number holds its place; the name is the one that gives way.
    expect(value.x).toBe(0);
    expect(value.y).toBe(0);
    expect(anyOverlap(placed)).toBe(false);
  });

  it("resolves a dense pile without leaving any pair overlapping", () => {
    // A stress case rather than a real structure: twelve distinct labels all
    // asking for the same few square units.
    const crowded = Array.from({ length: 12 }, (_, i) =>
      candidate({
        id: `c${i}`,
        text: `${i}.${i} kN`,
        x: (i % 3) * 2,
        y: Math.floor(i / 3) * 2,
        pushX: 0,
        pushY: -1,
      }),
    );
    const placed = layoutLabels(crowded);
    expect(anyOverlap(placed)).toBe(false);
    // Nothing silently vanishes while there is still room to place it.
    expect(placed.length).toBe(12);
  });

  it("returns nothing for nothing", () => {
    expect(layoutLabels([])).toEqual([]);
  });
});
