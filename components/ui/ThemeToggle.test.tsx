// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ThemeToggle from "./ThemeToggle";
import useThemeStore, { resolveTheme } from "@/store/useThemeStore";

function option(name: string) {
  return screen.getByRole("button", { name });
}

beforeEach(() => {
  useThemeStore.getState().setChoice("system");
  document.documentElement.removeAttribute("data-theme");
});

afterEach(cleanup);

describe("resolveTheme", () => {
  it("honours an explicit choice whichever way the OS leans", () => {
    // The bug this fixes: on a dark-mode machine there was no way to get light.
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("follows the OS on Auto", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("ThemeToggle", () => {
  it("offers Auto, Light and Dark, starting on Auto", () => {
    render(<ThemeToggle />);
    expect(option("Auto").getAttribute("aria-pressed")).toBe("true");
    expect(option("Light").getAttribute("aria-pressed")).toBe("false");
    expect(option("Dark").getAttribute("aria-pressed")).toBe("false");
  });

  it("sets data-theme when a theme is pinned", () => {
    render(<ThemeToggle />);
    fireEvent.click(option("Dark"));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    fireEvent.click(option("Light"));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("removes the attribute on Auto, which is what lets the OS decide", () => {
    render(<ThemeToggle />);
    fireEvent.click(option("Dark"));
    fireEvent.click(option("Auto"));
    // Absence, not data-theme="system": the media query only applies when no
    // explicit choice is present.
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("writes the attribute before the store settles, so no frame is stale", () => {
    render(<ThemeToggle />);
    // setChoice applies the DOM change itself rather than deferring to an
    // effect -- the canvas reads the resolved tokens during render.
    useThemeStore.getState().setChoice("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("names the resolved theme for assistive tech", () => {
    render(<ThemeToggle />);
    // jsdom has no matchMedia, so Auto resolves light here.
    expect(screen.getByRole("group").getAttribute("aria-label")).toBe(
      "Theme — currently light",
    );
    fireEvent.click(option("Dark"));
    expect(screen.getByRole("group").getAttribute("aria-label")).toBe(
      "Theme — currently dark",
    );
  });

  it("marks exactly one option pressed at a time", () => {
    render(<ThemeToggle />);
    fireEvent.click(option("Dark"));
    const pressed = ["Auto", "Light", "Dark"].filter(
      (name) => option(name).getAttribute("aria-pressed") === "true",
    );
    expect(pressed).toEqual(["Dark"]);
  });
});
