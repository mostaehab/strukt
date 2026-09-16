"use client";

import { useMemo } from "react";
import useThemeStore, { resolveTheme } from "@/store/useThemeStore";
import useSystemPrefersDark from "@/components/ui/useSystemPrefersDark";

/**
 * Bridges the CSS colour tokens into three.js.
 *
 * r3f cannot read CSS custom properties -- a material takes a colour value,
 * not a `var()`. Rather than keeping a second copy of the palette in JS (which
 * is what was here before, and which quietly stayed light while the rest of
 * the app went dark), this reads the resolved values off the document. Since
 * `useThemeStore` writes `data-theme` in its action rather than an effect, the
 * attribute is already current when this runs.
 *
 * The fallbacks are not decoration: `getComputedStyle` returns empty strings
 * before styles resolve and during server rendering, and an empty string handed
 * to three.js throws rather than degrading.
 */

export interface CanvasColors {
  background: string;
  ink: string;
  accent: string;
  grid: string;
}

const LIGHT_FALLBACK: CanvasColors = {
  background: "#eef1f5",
  ink: "#10151c",
  accent: "#2f6fed",
  grid: "#c3cad4",
};

const DARK_FALLBACK: CanvasColors = {
  background: "#12161c",
  ink: "#e7edf2",
  accent: "#6d97f2",
  grid: "#2b323c",
};

function readToken(styles: CSSStyleDeclaration, name: string, fallback: string) {
  const value = styles.getPropertyValue(name).trim();
  return value === "" ? fallback : value;
}

export default function useCanvasColors(): CanvasColors {
  const choice = useThemeStore((s) => s.choice);
  const systemPrefersDark = useSystemPrefersDark();
  const resolved = resolveTheme(choice, systemPrefersDark);

  return useMemo(() => {
    const fallback = resolved === "dark" ? DARK_FALLBACK : LIGHT_FALLBACK;
    if (typeof document === "undefined") return fallback;

    const styles = getComputedStyle(document.documentElement);
    return {
      background: readToken(styles, "--strukt-canvas-background", fallback.background),
      ink: readToken(styles, "--strukt-canvas-ink", fallback.ink),
      accent: readToken(styles, "--strukt-color-accent-primary", fallback.accent),
      grid: readToken(styles, "--strukt-canvas-grid", fallback.grid),
    };
    // Keyed on the resolved theme, not the choice: switching the OS preference
    // while on Auto changes the tokens without changing the choice.
  }, [resolved]);
}
