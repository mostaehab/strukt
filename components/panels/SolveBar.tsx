"use client";

import useStructureStore from "@/store/useStructureStore";
import ThemeToggle from "@/components/ui/ThemeToggle";

/**
 * The Solve control and the banner explaining a refused attempt.
 *
 * Sits above the canvas and below the toolbar, which is where EXPERIENCE.md
 * puts the error banner -- the same place every time, so a student never has
 * to hunt for it.
 *
 * The button is never disabled-and-silent: it stays operable whatever the
 * structure looks like, and pressing it always produces either results or an
 * explanation. It reports `Solve — blocked` only *after* an attempt has been
 * refused, because evaluating solvability continuously would label an empty
 * canvas blocked before the student had begun drawing on it.
 */
export default function SolveBar() {
  const solve = useStructureStore((s) => s.solve);
  const solveErrors = useStructureStore((s) => s.solveErrors);
  const clearAll = useStructureStore((s) => s.clearAll);
  const isEmpty = useStructureStore(
    (s) => s.nodes.length === 0 && s.elements.length === 0,
  );

  const blocked = solveErrors.length > 0;

  // Clearing throws away every Node, Element and Load at once and there is no
  // undo, so it confirms first and names what it takes -- the same rule the
  // Node and Element deletes follow (FR-3).
  const handleClear = () => {
    if (isEmpty) return;
    if (!window.confirm("Clear the workspace? This deletes every Node, Element and Load, and can't be undone.")) {
      return;
    }
    clearAll();
  };

  return (
    <div className="solve-bar">
      <button
        type="button"
        className={`solve-button${blocked ? " solve-button-blocked" : ""}`}
        onClick={solve}
      >
        {blocked ? "Solve — blocked" : "Solve"}
      </button>

      <ThemeToggle />

      {/* Destructive, so it sits apart from Solve and reads as an outline
          rather than a filled button -- DESIGN.md's button-danger-outline.
          Disabled only when there is genuinely nothing to clear, which is a
          statement of fact rather than a hidden precondition. */}
      <button
        type="button"
        className="clear-button"
        onClick={handleClear}
        disabled={isEmpty}
      >
        Clear workspace
      </button>

      {/* The solved state is reported once, in the results head, where the
          mockup puts it -- showing it here as well would say the same thing
          twice in two places. */}

      {/*
        Always present, so the region exists before it has anything to say --
        an aria-live region added to the DOM at the same moment as its content
        is not reliably announced.
      */}
      <div className="error-banner-region" role="status" aria-live="polite">
        {blocked && (
          <div className="error-banner">
            {solveErrors.map((error) => (
              <p key={`${error.code}-${error.nodeId ?? error.elementId ?? ""}`}>
                {error.message}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
