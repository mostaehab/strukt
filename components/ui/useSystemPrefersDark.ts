"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-color-scheme: dark)";

/**
 * Not every environment has `matchMedia`: jsdom omits it entirely, and it is
 * absent during server rendering. Treating that as "no dark preference" keeps
 * the app on its light default rather than throwing, which is the same answer
 * a browser with no preference expressed would give.
 */
function mediaQuery(): MediaQueryList | null {
  if (typeof window === "undefined") return null;
  if (typeof window.matchMedia !== "function") return null;
  return window.matchMedia(QUERY);
}

function subscribe(onChange: () => void) {
  const media = mediaQuery();
  if (!media) return () => {};
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getSnapshot() {
  return mediaQuery()?.matches ?? false;
}

/** The server has no OS preference; light is the neutral assumption. */
function getServerSnapshot() {
  return false;
}

/**
 * The OS colour-scheme preference, as a live value.
 *
 * `useSyncExternalStore` rather than an effect writing state: the preference is
 * an external store, and subscribing to it this way keeps "Auto" tracking a
 * change made while the app is open without tearing during a render.
 */
export default function useSystemPrefersDark(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
