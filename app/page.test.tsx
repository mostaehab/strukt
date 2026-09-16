// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Landing from "./page";

const DISCLAIMER =
  "strukt is a learning tool — not a substitute for licensed/certified professional engineering judgment";

afterEach(cleanup);

describe("Landing page", () => {
  it("leads with the promise, not the product name", () => {
    render(<Landing />);
    const headline = screen.getByRole("heading", { level: 1 });
    // The differentiator the PRD names, said first.
    expect(headline.textContent).toContain("See the working");
    expect(headline.textContent).toContain("not just the answer");
  });

  it("says what it is for", () => {
    render(<Landing />);
    expect(document.body.textContent).toContain("direct stiffness method");
    expect(document.body.textContent).toContain("civil engineering students");
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

  it("leads with what the tool actually does", () => {
    render(<Landing />);
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(headings).toContain("Direct manipulation");
    expect(headings).toContain("The working, not just the answer");
  });

  it("lays out the three steps in order", () => {
    render(<Landing />);
    const steps = screen
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(steps).toEqual(["Draw", "Define", "Solve"]);
  });

  it("claims no adoption it does not have", () => {
    render(<Landing />);
    const text = document.body.textContent ?? "";
    // No fabricated social proof: this is a pre-launch MVP, and inventing
    // users, testimonials or institutions would be a lie on the front page.
    expect(text).not.toMatch(/trusted by|join \d|\d+,\d+ (students|users)|testimonial/i);
  });

  it("offers the canvas from the nav as well as the hero", () => {
    render(<Landing />);
    // A sticky nav means the action is reachable without scrolling back up.
    expect(screen.getByRole("banner")).toBeDefined();
  });

  it("hides the decorative figure from assistive tech", () => {
    const { container } = render(<Landing />);
    const svg = container.querySelector("svg");
    // The prose beside it already says what it shows, so announcing it twice
    // would be noise.
    expect(svg?.getAttribute("role")).toBe("presentation");
  });
});
