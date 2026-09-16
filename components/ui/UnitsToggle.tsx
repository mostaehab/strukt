"use client";

import useUnitStore, { type UnitSystem } from "@/store/useUnitStore";

/**
 * Option labels name the units themselves rather than just the system, so a
 * student can see what they are switching to without having to know which
 * convention "Imperial" implies here.
 */
const SYSTEMS: { value: UnitSystem; label: string }[] = [
  { value: "SI", label: "SI — kN, m" },
  { value: "IMPERIAL", label: "Imperial — kip, ft" },
];

/**
 * SI / Imperial selector (FR-20).
 *
 * A dropdown by explicit request. `components.units-toggle` specifies a
 * segmented control with an underlined active state, so this is a deliberate
 * divergence from the design spine rather than an oversight -- noted here so a
 * later reader does not "fix" it back.
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
    <div className="units-toggle">
      <label htmlFor="unit-system">Units</label>
      <select
        id="unit-system"
        className="units-select"
        value={system}
        onChange={(event) => setSystem(event.target.value as UnitSystem)}
      >
        {SYSTEMS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
