// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import LoadGlyph from "./LoadGlyph";
import {
  LOAD_HEAD_HALO_SCALE,
  loadGlyphGeometry,
  udlGlyphGeometry,
} from "./loadGlyphGeometry";
import { LOAD_HALO_Z_OFFSET } from "./canvasConstants";

// drei's <Line> needs WebGL and <Html> needs a live r3f context, neither of
// which jsdom has. Both are stubbed as plain elements that publish what the
// component passed them -- so what gets tested here is the wiring from the
// geometry module into three's props, which every other test mocks away.
vi.mock("@react-three/drei", () => ({
  Line: ({
    points,
    color,
    lineWidth,
  }: {
    points: [number, number, number][];
    color: string;
    lineWidth: number;
  }) => (
    <span
      data-testid="line"
      data-points={points.map((p) => p.join(",")).join(" | ")}
      data-color={color}
      data-line-width={String(lineWidth)}
    />
  ),
  Html: ({
    position,
    children,
  }: {
    position: [number, number, number];
    children: ReactNode;
  }) => (
    <span data-testid="html-label" data-position={position.join(",")}>
      {children}
    </span>
  ),
}));

const DOWN: [number, number] = [0, -1];
const ACCENT = "#2f6fed";
const BACKGROUND = "#eef1f5";

/** r3f primitives render as unknown DOM elements; array props stringify. */
function heads() {
  return Array.from(document.querySelectorAll("mesh"));
}

function lines() {
  return screen.getAllByTestId("line");
}

function tuple(value: string | null): number[] {
  return (value ?? "").split(",").map(Number);
}

afterEach(cleanup);

describe("LoadGlyph, concentrated", () => {
  // The bug this exists to catch: `position` and `rotation` are both
  // [number, number, number], so swapping them type-checks and every mocked
  // test still passes, while every arrowhead renders detached and unrotated.
  it("gives the head its own position and its own rotation", () => {
    render(
      <LoadGlyph
        kind="concentrated"
        target={[2, 3]}
        direction={DOWN}
        color={ACCENT}
        haloColor={BACKGROUND}
        label="5 kN"
      />,
    );

    const glyph = loadGlyphGeometry(2, 3, DOWN);
    // Halo first, then the head itself.
    const [halo, head] = heads();

    expect(tuple(head.getAttribute("position"))).toEqual(glyph.head.position);
    expect(tuple(head.getAttribute("rotation"))).toEqual(glyph.head.rotation);
    expect(tuple(head.getAttribute("position"))).not.toEqual(
      glyph.head.rotation,
    );

    // The halo sits at the same point, fractionally further back.
    const haloPosition = tuple(halo.getAttribute("position"));
    expect(haloPosition[0]).toBeCloseTo(glyph.head.position[0], 12);
    expect(haloPosition[1]).toBeCloseTo(glyph.head.position[1], 12);
    expect(haloPosition[2]).toBeCloseTo(
      glyph.head.position[2] - LOAD_HALO_Z_OFFSET,
      12,
    );
    expect(tuple(halo.getAttribute("rotation"))).toEqual(glyph.head.rotation);
    expect(halo.getAttribute("scale")).toBe(String(LOAD_HEAD_HALO_SCALE));
  });

  // Declarative, like ElementLine's <planeGeometry>: r3f creates the buffer
  // and disposes it on unmount. An imperatively built geometry handed in as a
  // prop leaks one GPU buffer per Load added and removed.
  it("lets r3f own the head buffer rather than building one per Load", () => {
    render(
      <LoadGlyph
        kind="concentrated"
        target={[0, 0]}
        direction={DOWN}
        color={ACCENT}
        haloColor={BACKGROUND}
        label="5 kN"
      />,
    );

    const geometries = document.querySelectorAll("bufferGeometry");
    expect(geometries).toHaveLength(heads().length);
    for (const mesh of heads()) {
      expect(mesh.querySelector("bufferGeometry")).not.toBeNull();
      expect(mesh.getAttribute("geometry")).toBeNull();
    }
  });

  it("draws the shaft from the geometry's tail to its head base", () => {
    render(
      <LoadGlyph
        kind="concentrated"
        target={[2, 3]}
        direction={DOWN}
        color={ACCENT}
        haloColor={BACKGROUND}
        label="5 kN"
      />,
    );

    const glyph = loadGlyphGeometry(2, 3, DOWN);
    expect(lines()).toHaveLength(1);
    expect(lines()[0].dataset.points).toBe(
      [glyph.shaftStart.join(","), glyph.shaftEnd.join(",")].join(" | "),
    );
    expect(lines()[0].dataset.color).toBe(ACCENT);
  });

  it("labels the tail with the text it was given", () => {
    render(
      <LoadGlyph
        kind="concentrated"
        target={[2, 3]}
        direction={DOWN}
        color={ACCENT}
        haloColor={BACKGROUND}
        label="5 kN"
      />,
    );

    const label = screen.getByTestId("html-label");
    expect(label.textContent).toBe("5 kN");
    expect(label.dataset.position).toBe(
      loadGlyphGeometry(2, 3, DOWN).labelPosition.join(","),
    );
  });

  it("colours the head in the Load colour and the halo in the background", () => {
    render(
      <LoadGlyph
        kind="concentrated"
        target={[0, 0]}
        direction={DOWN}
        color={ACCENT}
        haloColor={BACKGROUND}
        label="5 kN"
      />,
    );

    const materials = Array.from(document.querySelectorAll("meshBasicMaterial"));
    expect(materials[0].getAttribute("color")).toBe(BACKGROUND);
    expect(materials[1].getAttribute("color")).toBe(ACCENT);
  });

  it("offsets a stacked Load exactly as the geometry says", () => {
    render(
      <LoadGlyph
        kind="concentrated"
        target={[0, 0]}
        direction={DOWN}
        color={ACCENT}
        haloColor={BACKGROUND}
        label="5 kN"
        stackIndex={1}
      />,
    );

    const glyph = loadGlyphGeometry(0, 0, DOWN, 1);
    expect(tuple(heads()[1].getAttribute("position"))).toEqual(
      glyph.head.position,
    );
  });
});

describe("LoadGlyph, UDL", () => {
  it("draws a spine over the member and one arrow per tick", () => {
    render(
      <LoadGlyph
        kind="udl"
        start={[0, 0]}
        end={[4, 0]}
        direction={DOWN}
        color={ACCENT}
        haloColor={BACKGROUND}
        label="2 kN/m"
      />,
    );

    const glyph = udlGlyphGeometry(0, 0, 4, 0, DOWN);
    // One spine plus one shaft per arrow.
    expect(lines()).toHaveLength(glyph.arrows.length + 1);
    expect(lines()[0].dataset.points).toBe(
      [glyph.spineStart.join(","), glyph.spineEnd.join(",")].join(" | "),
    );
    // Head and halo per arrow.
    expect(heads()).toHaveLength(glyph.arrows.length * 2);
  });

  it("places every arrow head where the geometry put it", () => {
    render(
      <LoadGlyph
        kind="udl"
        start={[0, 0]}
        end={[4, 0]}
        direction={DOWN}
        color={ACCENT}
        haloColor={BACKGROUND}
        label="2 kN/m"
      />,
    );

    const glyph = udlGlyphGeometry(0, 0, 4, 0, DOWN);
    // Every second mesh is a head; the one before it is its halo.
    const headPositions = heads()
      .filter((_, index) => index % 2 === 1)
      .map((mesh) => tuple(mesh.getAttribute("position")));
    expect(headPositions).toEqual(glyph.arrows.map((a) => a.head.position));

    const rotations = heads()
      .filter((_, index) => index % 2 === 1)
      .map((mesh) => tuple(mesh.getAttribute("rotation")));
    expect(rotations).toEqual(glyph.arrows.map((a) => a.head.rotation));
  });

  it("labels the middle of the spine", () => {
    render(
      <LoadGlyph
        kind="udl"
        start={[0, 0]}
        end={[4, 0]}
        direction={DOWN}
        color={ACCENT}
        haloColor={BACKGROUND}
        label="2 kN/m"
      />,
    );

    expect(screen.getByTestId("html-label").dataset.position).toBe(
      udlGlyphGeometry(0, 0, 4, 0, DOWN).labelPosition.join(","),
    );
  });
});
