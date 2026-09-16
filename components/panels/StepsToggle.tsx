"use client";

interface StepsToggleProps {
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * The Show Steps switch (FR-16).
 *
 * `role="switch"` with `aria-checked` rather than a checkbox, which is what
 * UX-DR7 names: a screen reader should announce this as on or off, not as
 * checked.
 *
 * Disabled rather than hidden before a Solve. A control that vanishes and
 * reappears is harder to find than one visibly present but inert, and its
 * presence tells a student the feature exists before they have earned it --
 * EXPERIENCE.md's "disabled (not merely empty)".
 */
export default function StepsToggle({
  checked,
  disabled,
  onChange,
}: StepsToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={`steps-toggle${checked ? " is-on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="steps-toggle-label">Show Steps</span>
      <span className="steps-switch" aria-hidden="true">
        <span className="steps-thumb" />
      </span>
    </button>
  );
}
