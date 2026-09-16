// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Landing from "./page";

const DISCLAIMER =
  "strukt is a learning tool — not a substitute for licensed/certified professional engineering judgment";

afterEach(cleanup);

describe("Landing page", () => {
  it("names the product and what it is for", () => {
    render(<Landing />);
    screen.getByRole("heading", { level: 1, name: "strukt" });
    expect(document.body.textContent).toContain("direct stiffness method");
  });

  it("routes to the canvas, which is no longer the entry point", () => {
    render(<Landing />);
    const links = screen.getAllByRole("link", { name: /open the canvas/i });
    // Offered at the top and again at the end, so a reader never has to scroll
    // back to act.
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const link of links) {
      expect(link.getAttribute("href")).toBe("/canvas");
    }
  });

  it("states the learning-tool claim verbatim (NFR-5)", () => {
    render(<Landing />);
    // Persistent and in-product, never a modal or a toast.
    screen.getByText(DISCLAIMER);
  });

  it("leads with what the tool actually does, in order", () => {
    render(<Landing />);
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(headings).toEqual(["Draw it", "Solve it", "See the working"]);
  });

  it("hides the decorative figure from assistive tech", () => {
    const { container } = render(<Landing />);
    const svg = container.querySelector("svg");
    // The prose beside it already says what it shows, so announcing it twice
    // would be noise.
    expect(svg?.getAttribute("role")).toBe("presentation");
  });
});
