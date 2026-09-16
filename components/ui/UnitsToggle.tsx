"use client";

import useUnitStore, { type UnitSystem } from "@/store/useUnitStore";

const SYSTEMS: { value: UnitSystem; label: string }[] = [
  { value: "SI", label: "SI" },
  { value: "IMPERIAL", label: "Imperial" },
];

/**
 * SI / Imperial switch (FR-20).
 *
 * A segmented control with an underlined active state, which is what
 * `components.units-toggle` specifies -- not a filled pill.
 *
 * Changing it converts what is displayed and nothing else: the stored values
 * stay SI (AD-4), so switching back and forth cannot drift what was entered,
 * and because the preference lives outside the structure store it cannot clear
 * a solved result.
 */
export default function UnitsToggle() {
  const system = useUnitStore((s) => s.system);
  const setSystem = useUnitStore((s) => s.setSystem);

  return (
    <div className="units-toggle" role="group" aria-label="Unit system">
      {SYSTEMS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`theme-option${system === option.value ? " is-active" : ""}`}
          aria-pressed={system === option.value}
          onClick={() => setSystem(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
