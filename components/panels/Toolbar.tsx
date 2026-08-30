"use client";

export type Tool = "NODE" | "ELEMENT" | "SELECT";

interface ToolbarProps {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
}

const TOOLS: { value: Tool; label: string }[] = [
  { value: "NODE", label: "Node" },
  { value: "ELEMENT", label: "Element" },
  { value: "SELECT", label: "Select" },
];

/**
 * Node/Element/Select tool switcher. Plain buttons -- fully tap and click
 * compatible, no hover-only affordance.
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
          {t.label}
        </button>
      ))}
    </div>
  );
}
