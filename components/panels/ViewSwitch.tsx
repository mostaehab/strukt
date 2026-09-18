"use client";

import type { DiagramKind } from "@/engine/diagrams";

/**
 * Switches the workspace between the model and each diagram.
 *
 * `EXPERIENCE.md` resolves the PRD's "results view" as *not* a separate
 * destination -- there is no route for results independent of the Project they
 * belong to. This is that decision kept: one screen, one URL, with the main
 * area showing either what you drew or what it solved to. Nothing here
 * navigates.
 *
 * A radiogroup rather than tabs: the diagrams are not panels of one document,
 * they are alternative renderings of the same structure, and only one can be
 * true of the area at a time.
 */

export type WorkspaceView = "MODEL" | DiagramKind;

interface ViewOption {
  value: WorkspaceView;
  label: string;
  /** Spoken name, since "BMD" is an initialism a screen reader spells out. */
  description: string;
}

const MODEL_OPTION: ViewOption = {
  value: "MODEL",
  label: "Model",
  description: "Model",
};

const DIAGRAM_OPTIONS: Record<DiagramKind, ViewOption> = {
  moment: { value: "moment", label: "BMD", description: "Bending moment diagram" },
  shear: { value: "shear", label: "SFD", description: "Shear force diagram" },
  axial: { value: "axial", label: "NFD", description: "Normal force diagram" },
};

/**
 * Which views this structure has, by whether the diagram exists at all.
 *
 * A Truss loaded only at its joints has no bending anywhere -- every member is
 * a two-force member -- so a BMD and an SFD would be flat zero lines dressed
 * up as results. Load a member between its joints and that stops being true:
 * the member spans its two pins as a simply supported beam and has both.
 *
 * So the question is not "is this a Truss" but "is there any bending", which
 * is also the honest reading of FR-12/FR-13 scoping them to a structure that
 * has one.
 */
export function viewsFor(hasBending: boolean): WorkspaceView[] {
  return hasBending
    ? ["MODEL", "moment", "shear", "axial"]
    : ["MODEL", "axial"];
}

interface ViewSwitchProps {
  view: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
  /** Whether any member bends -- see `viewsFor`. */
  hasBending: boolean;
  /** Diagrams are unavailable until a Solve succeeds. */
  solved: boolean;
}

export default function ViewSwitch({
  view,
  onViewChange,
  hasBending,
  solved,
}: ViewSwitchProps) {
  const options = viewsFor(hasBending).map((value) =>
    value === "MODEL" ? MODEL_OPTION : DIAGRAM_OPTIONS[value],
  );

  return (
    <div className="view-switch" role="radiogroup" aria-label="Workspace view">
      {options.map((option) => {
        const isModel = option.value === "MODEL";
        // Disabled rather than hidden, so the diagrams are visibly a thing
        // this structure will have once it solves.
        const disabled = !isModel && !solved;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={view === option.value}
            aria-label={option.description}
            disabled={disabled}
            className="view-switch-option"
            onClick={() => onViewChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
