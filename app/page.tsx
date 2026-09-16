import Link from "next/link";
import "./landing.css";

export const metadata = {
  title: "strukt — see the working, not just the answer",
  description:
    "A structural analysis tool for civil engineering students learning the direct stiffness method. Draw a beam, frame or truss, solve it, and see the equations behind the result.",
};

/**
 * Landing page.
 *
 * Modern technical-SaaS layout — generous vertical rhythm, a sticky nav, a
 * gradient-lit hero, hover-lifting cards — but built on the app's own sharp
 * geometry rather than the rounded, pastel default. Zero corner-radius is the
 * brand's most distinctive quality (it comes from drafting), so softening it
 * here would make arriving at the canvas feel like a different product.
 *
 * Nothing on this page claims adoption it does not have: no testimonials, no
 * user counts, no university logos. The credibility comes from showing the
 * thing working.
 */

/** Verbatim, and required on every surface (NFR-5, UX-DR8). */
const DISCLAIMER =
  "strukt is a learning tool — not a substitute for licensed/certified professional engineering judgment";

/** Factual capabilities, each one shipped and checkable in the app. */
const CAPABILITIES = [
  "Truss · Frame · Beam",
  "AISC W-shape catalogue",
  "SI & Imperial",
  "BMD · SFD · NFD",
  "Runs in-browser",
];

const FEATURES = [
  {
    title: "Direct manipulation",
    body: "Place Nodes on a snap-to-grid canvas and connect them. Supports, Materials and Cross-Sections come from real catalogue data — no dialog boxes, no setup wizard.",
    icon: (
      <>
        <line x1="10" y1="1.5" x2="10" y2="4.5" />
        <line x1="10" y1="15.5" x2="10" y2="18.5" />
        <line x1="1.5" y1="10" x2="4.5" y2="10" />
        <line x1="15.5" y1="10" x2="18.5" y2="10" />
        <circle cx="10" cy="10" r="5" />
        <circle cx="10" cy="10" r="1.9" className="icon-fill" />
      </>
    ),
  },
  {
    title: "Answers in a click",
    body: "The Direct Stiffness Method runs client-side, instantly. Moment, shear and axial diagrams render with their peaks labelled by value and location, alongside every support reaction.",
    icon: (
      <>
        <path d="M3 14 Q7 4 10 9 T17 5" fill="none" />
        <line x1="2.5" y1="17" x2="17.5" y2="17" />
      </>
    ),
  },
  {
    title: "The working, not just the answer",
    body: "Every other tool hands you a number. Show Steps opens the real matrices — each member's local stiffness with your values in it, the assembly, and the reduced system that produced the result.",
    icon: (
      <>
        <path d="M6.5 3 L3.5 3 L3.5 17 L6.5 17" fill="none" />
        <path d="M13.5 3 L16.5 3 L16.5 17 L13.5 17" fill="none" />
        <line x1="8" y1="7.5" x2="12" y2="7.5" />
        <line x1="8" y1="12.5" x2="12" y2="12.5" />
      </>
    ),
  },
];

const STEPS = [
  { title: "Draw", body: "Nodes, members, supports." },
  { title: "Define", body: "Materials, sections, loads." },
  { title: "Solve", body: "Diagrams, reactions, and the steps behind them." },
];

export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <span className="landing-mark">strukt</span>
        <Link href="/canvas" className="landing-cta landing-cta-small">
          Open the canvas
        </Link>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-intro">
            <p className="landing-chip">For civil engineering students</p>
            <h1 className="landing-title">
              See the working,
              <br />
              <span className="landing-title-accent">not just the answer.</span>
            </h1>
            <p className="landing-lede">
              A 2D structural analysis tool for learning the direct stiffness
              method. Draw a beam, frame or truss, solve it in your browser, and
              check every step against your own hand calculations.
            </p>
            <div className="landing-actions">
              <Link href="/canvas" className="landing-cta">
                Open the canvas
              </Link>
              <a href="#how" className="landing-link">
                See how it works
              </a>
            </div>
            <p className="landing-meta">
              Free · No account needed · Nothing leaves your browser
            </p>
          </div>

          {/* The product's own subject matter, drawn with the same primitives
              the canvas uses: a simply supported beam under a uniform load and
              the moment diagram it produces. Decorative — the prose beside it
              already says what it shows. */}
          <div className="landing-figure-frame">
            <svg
              className="landing-figure"
              viewBox="0 0 420 230"
              role="presentation"
              focusable="false"
            >
              <g className="figure-load">
                {[70, 110, 150, 190, 230, 270, 310, 350].map((x) => (
                  <line key={x} x1={x} y1="30" x2={x} y2="60" />
                ))}
                <line x1="62" y1="30" x2="358" y2="30" />
                {[70, 110, 150, 190, 230, 270, 310, 350].map((x) => (
                  <path key={`h${x}`} d={`M${x - 4} 54 L${x} 64 L${x + 4} 54 Z`} />
                ))}
              </g>

              <line className="figure-beam" x1="60" y1="72" x2="360" y2="72" />

              <g className="figure-support">
                <path d="M60 72 L48 94 L72 94 Z" />
                <line x1="42" y1="94" x2="78" y2="94" />
                <path d="M360 72 L348 94 L372 94 Z" />
                <circle cx="354" cy="99" r="4" />
                <circle cx="366" cy="99" r="4" />
                <line x1="342" y1="105" x2="378" y2="105" />
              </g>

              <circle className="figure-node" cx="60" cy="72" r="4.5" />
              <circle className="figure-node" cx="360" cy="72" r="4.5" />

              <line className="figure-axis" x1="60" y1="150" x2="360" y2="150" />
              <path className="figure-fill" d="M60 150 Q210 222 360 150 Z" />
              <path className="figure-curve" d="M60 150 Q210 222 360 150" fill="none" />
              <text className="figure-label" x="210" y="214" textAnchor="middle">
                M·max = wL²/8
              </text>
            </svg>
          </div>
        </section>

        <ul className="landing-capabilities">
          {CAPABILITIES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <section className="landing-features">
          {FEATURES.map((feature) => (
            <article key={feature.title}>
              <svg
                viewBox="0 0 20 20"
                className="feature-icon"
                aria-hidden="true"
                focusable="false"
              >
                {feature.icon}
              </svg>
              <h2>{feature.title}</h2>
              <p>{feature.body}</p>
            </article>
          ))}
        </section>

        <section className="landing-how" id="how">
          <h2 className="landing-section-title">How it works</h2>
          <ol className="landing-steps">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <span className="landing-step">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-closing">
          <h2>Built for the night before the exam.</h2>
          <p>
            When you need to know whether your own answer is right — and why.
          </p>
          <Link href="/canvas" className="landing-cta">
            Open the canvas
          </Link>
        </section>
      </main>

      <footer className="landing-footer">
        <p className="disclaimer-badge">{DISCLAIMER}</p>
        <p className="landing-colophon">strukt · MVP</p>
      </footer>
    </div>
  );
}
