import { create } from "zustand";

/**
 * Theme preference (UX-DR10).
 *
 * Three states, not two: "system" is a real choice and the default, so a
 * student who has never touched the control still tracks their OS. Picking
 * light or dark pins it -- which is the part that was missing, because without
 * an explicit choice there is no way off a dark-mode machine.
 *
 * Deliberately not persisted: UX-DR10 specifies a client-side switch with no
 * per-user preference stored in v1.
 */
export type ThemeChoice = "system" | "light" | "dark";

/** What the choice resolves to once the OS preference is known. */
export type ResolvedTheme = "light" | "dark";

interface ThemeState {
  choice: ThemeChoice;
  setChoice: (choice: ThemeChoice) => void;
}

/**
 * Writes the choice onto `<html data-theme>`, where tokens.css reads it.
 *
 * Done in the action rather than an effect so the attribute is already current
 * by the time anything re-renders -- an effect would leave one frame in which
 * the canvas, which reads the resolved tokens during render, still saw the old
 * theme.
 *
 * "system" removes the attribute rather than setting a value: its absence is
 * exactly what lets the media query apply, and is what Auto means.
 */
function applyChoice(choice: ThemeChoice) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
}

const useThemeStore = create<ThemeState>((set) => ({
  choice: "system",
  setChoice: (choice) => {
    applyChoice(choice);
    set({ choice });
  },
}));

/** Resolves a choice against the OS preference. Pure, so it is testable. */
export function resolveTheme(
  choice: ThemeChoice,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (choice === "light") return "light";
  if (choice === "dark") return "dark";
  return systemPrefersDark ? "dark" : "light";
}

export default useThemeStore;
