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
 * A Truss carries axial force only, so it offers no BMD or SFD -- FR-12 and
 * FR-13 both scope those to a Frame or Beam. Offering them disabled would
 * imply a Solve could fill them in.
 */
export function viewsFor(isTruss: boolean): WorkspaceView[] {
  return isTruss
    ? ["MODEL", "axial"]
    : ["MODEL", "moment", "shear", "axial"];
}

interface ViewSwitchProps {
  view: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
  isTruss: boolean;
  /** Diagrams are unavailable until a Solve succeeds. */
  solved: boolean;
}

export default function ViewSwitch({
  view,
  onViewChange,
  isTruss,
  solved,
}: ViewSwitchProps) {
  const options = viewsFor(isTruss).map((value) =>
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
