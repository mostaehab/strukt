// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import StiffnessMatrix from "./StiffnessMatrix";

/**
 * These exist because the first version shipped broken and looked fine to the
 * suite: the LaTeX was built with normal string literals, so `\times` became a
 * tab and `\begin` a backspace. KaTeX could not parse that, and with
 * `throwOnError: false` it renders the broken source rather than throwing --
 * so the failure reached the screen looking like output, while tests that only
 * checked for a labelled element still passed.
 */

const MATRIX = [
  [1.1e8, 0, -1.1e8],
  [0, 2.8e5, 1.26e6],
  [-1.1e8, 1.26e6, 7.55e6],
];

afterEach(cleanup);

describe("StiffnessMatrix", () => {
  it("produces real KaTeX output, not an error node", () => {
    const { container } = render(
      <StiffnessMatrix matrix={MATRIX} label="test matrix" />,
    );
    // KaTeX marks a parse failure with this class instead of throwing.
    expect(container.querySelector(".katex-error")).toBeNull();
    expect(container.querySelector(".katex")).not.toBeNull();
  });

  it("never leaks LaTeX source into the visible output", () => {
    const { container } = render(
      <StiffnessMatrix matrix={MATRIX} label="test matrix" />,
    );
    // The visible layer only. KaTeX also emits a MathML annotation carrying
    // the original TeX, which is deliberate -- screen readers and copy-paste
    // both use it -- so asserting over the whole subtree would fail on a
    // correctly rendered matrix.
    const visible = container.querySelector(".katex-html")?.textContent ?? "";
    expect(visible).not.toBe("");
    // The exact symptom of the bug this guards: unparsed source on screen.
    expect(visible).not.toContain("bmatrix");
    expect(visible).not.toContain("times");
    expect(visible).not.toContain("\\");
    // What should be there instead: the multiplication sign itself.
    expect(visible).toContain("×");
  });

  it("keeps the TeX annotation for assistive tech and copy-paste", () => {
    const { container } = render(
      <StiffnessMatrix matrix={MATRIX} label="test matrix" />,
    );
    const annotation = container.querySelector("annotation")?.textContent ?? "";
    expect(annotation).toContain("\\begin{bmatrix}");
  });

  it("emits no control characters from mangled escapes", () => {
    const { container } = render(
      <StiffnessMatrix matrix={MATRIX} label="test matrix" />,
    );
    // \t and \b are what a normal string literal turns \times and \begin into.
    expect(container.innerHTML).not.toMatch(/[\t\b]/);
  });

  it("renders every value in the matrix", () => {
    const { container } = render(
      <StiffnessMatrix matrix={[[1.1e8, 0]]} label="test matrix" />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("1.10");
    expect(text).toContain("0");
  });

  it("writes exponents without a redundant plus sign", () => {
    const { container } = render(
      <StiffnessMatrix matrix={[[1.1e8]]} label="test matrix" />,
    );
    expect(container.textContent).not.toContain("+8");
  });

  it("shows an exact zero as a plain 0, not in exponential form", () => {
    const { container } = render(
      <StiffnessMatrix matrix={[[0]]} label="test matrix" />,
    );
    expect(container.textContent).not.toContain("10");
  });

  it("labels itself for assistive tech, since the SVG carries no text", () => {
    const { container } = render(
      <StiffnessMatrix matrix={MATRIX} label="Local stiffness for E1" />,
    );
    const node = container.querySelector('[role="img"]');
    expect(node?.getAttribute("aria-label")).toBe("Local stiffness for E1");
  });
});
