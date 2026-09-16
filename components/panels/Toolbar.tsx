"use client";

import type { ReactNode } from "react";

export type Tool = "NODE" | "ELEMENT" | "SELECT";

interface ToolbarProps {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
}

/**
 * Tool icons, traced from `mockups/key-canvas.html:234-239`.
 *
 * Stroked rather than filled, on a 20x20 grid, so they read as drafting marks
 * at the same weight as the canvas itself. Each is paired with its text label
 * rather than replacing it -- an icon-only rail would fail the touch-parity
 * rule the moment a tooltip became the only way to tell two tools apart.
 */
const ICONS: Record<Tool, ReactNode> = {
  NODE: <circle cx="10" cy="10" r="5" />,
  ELEMENT: <line x1="3" y1="17" x2="17" y2="3" />,
  SELECT: <path d="M3 3 L9 17 L11 11 L17 9 Z" />,
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
