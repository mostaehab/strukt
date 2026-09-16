import Link from "next/link";

export const metadata = {
  title: "strukt — see the working, not just the answer",
  description:
    "A structural analysis tool for civil engineering students learning the direct stiffness method. Draw a beam, frame or truss, solve it, and see the equations behind the result.",
};

/**
 * Landing page.
 *
 * Drawn in the app's own visual language rather than in generic marketing
 * shapes: hairline strokes, zero corner-radius, one accent colour, monospace
 * for anything numeric. The hero illustration is a simply supported beam with
 * its own moment diagram — the thing the product actually does, rather than a
 * stock image of a building.
 */

/** Verbatim, and required on every surface (NFR-5, UX-DR8). */
const DISCLAIMER =
  "strukt is a learning tool — not a substitute for licensed/certified professional engineering judgment";

const POINTS = [
  {
    title: "Draw it",
    body: "Place Nodes on a snap-to-grid canvas and connect them. Assign Supports, Materials and Cross-Sections from a real AISC catalogue, then apply point loads or UDLs.",
  },
  {
    title: "Solve it",
    body: "The Direct Stiffness Method runs in your browser, instantly. Bending moment, shear force and normal force diagrams appear with their peaks labelled — plus the reactions at every support.",
  },
  {
    title: "See the working",
    body: "Every other tool hands you a number. Show Steps opens the actual matrices: each member's local stiffness with your values substituted in, how they assemble, and the reduced system that produced the answer.",
  },
];

export default function Landing() {
  return (
    <main className="landing">
      <section className="landing-hero">
        <div className="landing-intro">
          <p className="landing-eyebrow">Structural analysis, shown not told</p>
          <h1 className="landing-title">strukt</h1>
          <p className="landing-lede">
            A 2D structural analysis tool for civil engineering students
            learning the direct stiffness method. Draw a beam, frame or truss,
            solve it, and check your hand calculations against every step.
          </p>
          <Link href="/canvas" className="landing-cta">
            Open the canvas
          </Link>
          <p className="landing-meta">
            No account needed · Runs entirely in your browser
          </p>
        </div>

        {/* The product's own subject matter, drawn in its own language: a
            simply supported beam under a uniform load, with the moment diagram
            it produces. Decorative, so it is hidden from assistive tech — the
            prose beside it already says what it shows. */}
        <svg
          className="landing-figure"
          viewBox="0 0 420 220"
          role="presentation"
          focusable="false"
        >
          <g className="figure-load">
            {[70, 110, 150, 190, 230, 270, 310, 350].map((x) => (
              <line key={x} x1={x} y1="26" x2={x} y2="58" />
            ))}
            <line x1="62" y1="26" x2="358" y2="26" />
            {[70, 110, 150, 190, 230, 270, 310, 350].map((x) => (
              <path key={`h${x}`} d={`M${x - 4} 52 L${x} 62 L${x + 4} 52 Z`} />
            ))}
          </g>

          <line className="figure-beam" x1="60" y1="70" x2="360" y2="70" />

          <g className="figure-support">
            <path d="M60 70 L48 92 L72 92 Z" />
            <line x1="42" y1="92" x2="78" y2="92" />
            <path d="M360 70 L348 92 L372 92 Z" />
            <circle cx="354" cy="97" r="4" />
            <circle cx="366" cy="97" r="4" />
            <line x1="342" y1="103" x2="378" y2="103" />
          </g>

          <circle className="figure-node" cx="60" cy="70" r="4" />
          <circle className="figure-node" cx="360" cy="70" r="4" />

          <line className="figure-axis" x1="60" y1="140" x2="360" y2="140" />
          <path
            className="figure-curve"
            d="M60 140 Q210 212 360 140"
            fill="none"
          />
          <text className="figure-label" x="210" y="204" textAnchor="middle">
            M·max = wL²/8
          </text>
        </svg>
      </section>

      <section className="landing-points">
        {POINTS.map((point, index) => (
          <article key={point.title}>
            <p className="landing-step">{String(index + 1).padStart(2, "0")}</p>
            <h2>{point.title}</h2>
            <p>{point.body}</p>
          </article>
        ))}
      </section>

      <section className="landing-closing">
        <p>
          Built for the moment before an exam when you need to know whether your
          own answer is right.
        </p>
        <Link href="/canvas" className="landing-cta">
          Open the canvas
        </Link>
      </section>

      <footer className="landing-footer">
        <p className="disclaimer-badge">{DISCLAIMER}</p>
      </footer>
    </main>
  );
}
