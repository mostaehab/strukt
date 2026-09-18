/**
 * Keeps diagram labels off each other.
 *
 * A diagram drawn on real geometry puts its labels wherever the structure puts
 * them, and the structure does not care whether they fit: two members meeting
 * at a joint each want to label their end value within a few centimetres of
 * the same point, and a symmetric frame produces the same number four times.
 * Placing them by formula alone stacks them into an unreadable pile exactly
 * where the interesting values are.
 *
 * Pure, so it is tested against overlap directly rather than by eye.
 */

export interface LabelCandidate {
  id: string;
  /** Where the label wants to sit, in SVG user units (y increases downward). */
  x: number;
  y: number;
  text: string;
  fontSize: number;
  /**
   * Unit vector to move along when the label has to give way -- normally away
   * from the member it belongs to, so nudging never pushes it across its own
   * curve.
   */
  pushX: number;
  pushY: number;
  /**
   * Lower places first and so moves least. Member names yield to values: a
   * name is recoverable from position, a number is not.
   */
  priority: number;
}

export interface PlacedLabel {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
}

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Advance width of one character as a fraction of font size.
 *
 * The diagram labels are set in the monospace numeral face, where every glyph
 * is one advance wide, so a character count is an exact width rather than an
 * estimate. 0.6 is the ratio of the stack's metrics.
 */
const CHAR_WIDTH_RATIO = 0.6;

/** How far above and below the baseline a line of type actually reaches. */
const ASCENT_RATIO = 0.8;
const DESCENT_RATIO = 0.25;

/** Displacement per attempt, and how many attempts before giving up. */
const STEP_RATIO = 0.55;
const MAX_STEPS = 24;

/**
 * How close two identical labels must be to count as the same annotation.
 *
 * A shared joint is labelled once by each member meeting there. Where those
 * agree -- which at a moment-continuous joint they always do -- the second is
 * repetition, not information.
 */
const DUPLICATE_RADIUS_RATIO = 3.5;

function boxOf(label: PlacedLabel): Box {
  const width = label.text.length * label.fontSize * CHAR_WIDTH_RATIO;
  return {
    left: label.x - width / 2,
    right: label.x + width / 2,
    top: label.y - label.fontSize * ASCENT_RATIO,
    bottom: label.y + label.fontSize * DESCENT_RATIO,
  };
}

function overlaps(a: Box, b: Box): boolean {
  return (
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  );
}

/**
 * Places every label so no two boxes overlap, dropping exact repeats.
 *
 * Labels are placed in priority order and each one moves along its own push
 * vector until it is clear. A label that cannot be placed within `MAX_STEPS`
 * is dropped rather than left on the pile: the value is in the results table
 * either way, and an unreadable overlap is worse than an absent label.
 */
export function layoutLabels(candidates: LabelCandidate[]): PlacedLabel[] {
  const ordered = [...candidates].sort((a, b) => a.priority - b.priority);
  const placed: PlacedLabel[] = [];
  const boxes: Box[] = [];

  for (const candidate of ordered) {
    const duplicateRadius = candidate.fontSize * DUPLICATE_RADIUS_RATIO;
    const isRepeat = placed.some(
      (other) =>
        other.text === candidate.text &&
        Math.hypot(other.x - candidate.x, other.y - candidate.y) <=
          duplicateRadius,
    );
    if (isRepeat) continue;

    const step = candidate.fontSize * STEP_RATIO;
    let settled: PlacedLabel | null = null;

    for (let attempt = 0; attempt <= MAX_STEPS; attempt += 1) {
      // 0, +1, -1, +2, -2, ... The push direction is tried first at every
      // magnitude, so a label prefers moving away from its member -- but it
      // will take the near side over being dropped, which on a crowded joint
      // is the difference between a readable number and no number.
      const shift =
        attempt === 0
          ? 0
          : Math.ceil(attempt / 2) * (attempt % 2 === 1 ? 1 : -1) * step;
      const trial: PlacedLabel = {
        id: candidate.id,
        text: candidate.text,
        fontSize: candidate.fontSize,
        x: candidate.x + candidate.pushX * shift,
        y: candidate.y + candidate.pushY * shift,
      };
      const box = boxOf(trial);
      if (!boxes.some((other) => overlaps(box, other))) {
        settled = trial;
        boxes.push(box);
        break;
      }
    }

    if (settled) placed.push(settled);
  }

  return placed;
}
