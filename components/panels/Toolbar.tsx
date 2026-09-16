"use client";

import type { ReactNode } from "react";

export type Tool = "NODE" | "ELEMENT" | "SELECT";

interface ToolbarProps {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
}

/**
 * Tool icons, on a 20x20 grid.
 *
 * Each one draws what the tool produces rather than an abstract mark: the Node
 * tool shows a survey point with its crosshair, the Element tool shows a member
 * with a joint at each end, and Select shows a pointer over a picked joint. The
 * mockup's bare circle and diagonal line were correct in weight but said little
 * -- a lone line and a lone circle are hard to tell apart at 18px.
 *
 * Hairline strokes with small filled joints, matching the canvas's own drafting
 * language, so the rail and the drawing surface read as one system. Every icon
 * is paired with its text label rather than replacing it -- an icon-only rail
 * would fail touch parity the moment a tooltip became the only way to
 * distinguish two tools.
 */
const ICONS: Record<Tool, ReactNode> = {
  // A survey point: crosshair ticks through a ringed, filled centre.
  NODE: (
    <>
      <line x1="10" y1="1.5" x2="10" y2="4.5" />
      <line x1="10" y1="15.5" x2="10" y2="18.5" />
      <line x1="1.5" y1="10" x2="4.5" y2="10" />
      <line x1="15.5" y1="10" x2="18.5" y2="10" />
      <circle cx="10" cy="10" r="5" />
      <circle cx="10" cy="10" r="1.9" className="icon-fill" />
    </>
  ),
  // A member spanning two joints -- the thing the tool actually draws.
  ELEMENT: (
    <>
      <line x1="4.6" y1="15.4" x2="15.4" y2="4.6" />
      <circle cx="3.6" cy="16.4" r="2.1" className="icon-fill" />
      <circle cx="16.4" cy="3.6" r="2.1" className="icon-fill" />
    </>
  ),
  // A pointer resting on the joint it has picked.
  SELECT: (
    <>
      <circle cx="5.5" cy="5.5" r="2" className="icon-fill" />
      <path
        d="M8.2 7.4 L17.4 11.6 L13.1 12.9 L15.6 17.2 L13.6 18.3 L11.1 14 L8.1 17.2 Z"
        className="icon-fill"
      />
    </>
  ),
};

const TOOLS: { value: Tool; label: string }[] = [
  { value: "NODE", label: "Node" },
  { value: "ELEMENT", label: "Element" },
  { value: "SELECT", label: "Select" },
];

/**
 * Node/Element/Select tool switcher. Plain buttons -- fully tap and click
 * compatible, no hover-only affordance.
 *
 * Supports and Loads are assigned from the properties panel on a selected
 * entity rather than from a rail tool, so they have no button here.
 */
export default function Toolbar({ tool, onToolChange }: ToolbarProps) {
  return (
    <div className="toolbar" role="toolbar" aria-label="Drawing tools">
      {TOOLS.map((t) => (
        <button
          key={t.value}
          type="button"
          className={`toolbar-button${tool === t.value ? " is-active" : ""}`}
          aria-pressed={tool === t.value}
          onClick={() => onToolChange(t.value)}
        >
          <svg
            viewBox="0 0 20 20"
            className="tool-icon"
            aria-hidden="true"
            focusable="false"
          >
            {ICONS[t.value]}
          </svg>
          {t.label}
        </button>
      ))}
    </div>
  );
}
