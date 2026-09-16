"use client";

import useThemeStore, {
  resolveTheme,
  type ThemeChoice,
} from "@/store/useThemeStore";
import useSystemPrefersDark from "./useSystemPrefersDark";

const CHOICES: { value: ThemeChoice; label: string }[] = [
  { value: "system", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/**
 * Light / dark switch (UX-DR10).
 *
 * A segmented control with an underlined active state, matching the
 * units-toggle pattern DESIGN.md specifies -- not a filled pill, and not an
 * icon-only button whose current state you have to infer.
 *
 * Auto is the default and a real option, not an absence of one: it tracks the
 * OS live. Light and dark pin the theme, which is what makes a dark-mode
 * machine escapable.
 */
export default function ThemeToggle() {
  const choice = useThemeStore((s) => s.choice);
  const setChoice = useThemeStore((s) => s.setChoice);
  const systemPrefersDark = useSystemPrefersDark();
  const resolved = resolveTheme(choice, systemPrefersDark);

  return (
    <div
      className="theme-toggle"
      role="group"
      aria-label={`Theme — currently ${resolved}`}
    >
      {CHOICES.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`theme-option${choice === option.value ? " is-active" : ""}`}
          aria-pressed={choice === option.value}
          onClick={() => setChoice(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
