"use client";

import useStructureStore from "@/store/useStructureStore";

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
  const hasResults = useStructureStore((s) => s.results !== null);

  const blocked = solveErrors.length > 0;

  return (
    <div className="solve-bar">
      <button
        type="button"
        className={`solve-button${blocked ? " solve-button-blocked" : ""}`}
        onClick={solve}
      >
        {blocked ? "Solve — blocked" : "Solve"}
      </button>

      {hasResults && <span className="solve-state">Solved</span>}

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
