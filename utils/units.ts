import type { LoadKind } from "@/engine/types";

/**
 * The single read/write-through boundary between the SI values `engine/` and
 * `store/` hold and the kN values the properties panel and canvas display
 * (AD-4). Every conversion goes through here, so Story 1.7's SI/Imperial
 * toggle has one place to hook rather than a scatter of `/ 1000` literals.
 *
 * Nothing here is ever stored: a converted value exists only long enough to be
 * rendered, or only long enough to be converted back on the way in.
 */
export const NEWTONS_PER_KILONEWTON = 1000;

/** Read-through: newtons (or N/m) out of the store, kN (or kN/m) on screen. */
export function newtonsToKilonewtons(newtons: number): number {
  return newtons / NEWTONS_PER_KILONEWTON;
}

/** Write-through: kN (or kN/m) typed into a field, newtons into the store. */
export function kilonewtonsToNewtons(kilonewtons: number): number {
  return kilonewtons * NEWTONS_PER_KILONEWTON;
}

/**
 * Above this many kN, a value is shown in exponential form: a panel tag and a
 * canvas caption are both fixed-width, and sixteen digits of millinewtons
 * would blow either apart.
 */
const EXPONENTIAL_ABOVE = 1e6;

/** Below this many kN (but non-zero), likewise -- `5.00e-4` beats `0.0005`. */
const EXPONENTIAL_BELOW = 1e-3;

/**
 * The compact form: plain digits in the range an engineering value normally
 * lives in, exponential outside it. Binary-float noise is trimmed with the
 * same `toPrecision(12)` round-trip the panel's numeric fields use.
 */
function compact(kilonewtons: number): string {
  const magnitude = Math.abs(kilonewtons);
  if (
    magnitude >= EXPONENTIAL_ABOVE ||
    (magnitude > 0 && magnitude < EXPONENTIAL_BELOW)
  ) {
    return kilonewtons.toExponential(2);
  }
  return String(Number.parseFloat(kilonewtons.toPrecision(12)));
}

/**
 * Formats an SI magnitude as kN for display.
 *
 * With `fractionDigits` the value is fixed to that many decimals -- the panel
 * tag's `5.00 kN`. Without it, trailing zeros are dropped -- the canvas
 * label's `5 kN`, which has no room to spare.
 *
 * A stored Load is always positive and never zero, so no formatting of one may
 * render as `0.00`: a value too small to survive the requested rounding falls
 * back to the compact form instead of being flattened to a zero the store
 * would have refused to hold.
 */
export function formatKilonewtons(
  newtons: number,
  fractionDigits?: number,
): string {
  const kilonewtons = newtonsToKilonewtons(newtons);
  if (fractionDigits === undefined) return compact(kilonewtons);
  if (Math.abs(kilonewtons) >= EXPONENTIAL_ABOVE) return compact(kilonewtons);

  const fixed = kilonewtons.toFixed(fractionDigits);
  // Genuinely zero, or the rounding kept something: either way it is honest.
  if (kilonewtons === 0 || Number.parseFloat(fixed) !== 0) return fixed;
  return compact(kilonewtons);
}

/**
 * The display unit for a Load's magnitude: force for a concentrated Load,
 * force per unit length for a UDL. Never derived by string-concatenating "/m"
 * at a call site, so the two kinds can never be labelled with each other's
 * unit.
 *
 * Story 1.7's SI/Imperial toggle hooks in here and in `formatKilonewtons`:
 * this function grows a unit-system argument and returns `kip`/`kip/ft`
 * alongside `kN`/`kN/m`, which is why every caller already goes through it
 * rather than writing the literal.
 */
export function loadUnitLabel(kind: LoadKind): string {
  return kind === "udl" ? "kN/m" : "kN";
}

/**
 * A moment in kilonewton-metres, for the BMD's peak label and Reaction tags.
 *
 * Shares `formatKilonewtons`' scaling because the conversion is the same
 * divide-by-1000 -- newton-metres to kilonewton-metres -- and shares its
 * guards against rendering a real value as `0.00` or as a raw float.
 */
export function formatKilonewtonMetres(
  newtonMetres: number,
  fractionDigits?: number,
): string {
  return formatKilonewtons(newtonMetres, fractionDigits);
}

/** Display unit for a moment. Story 1.7's toggle hooks in here too. */
export const MOMENT_UNIT = "kN·m";

/** Display unit for a force. Story 1.7's toggle hooks in here too. */
export const FORCE_UNIT = "kN";

/**
 * Signed force with the word a student reads off an NFD.
 *
 * FR-14 requires tension and compression to be distinguished by sign in the
 * label text alone, never by an additional colour -- the palette carries no
 * hue for it, and `DESIGN.md`'s Colors rule forbids inventing one.
 */
export function axialForceLabel(newtons: number): string {
  const sign = newtons > 0 ? "+" : newtons < 0 ? "−" : "";
  const magnitude = formatKilonewtons(Math.abs(newtons), 1);
  if (newtons === 0) return `0 ${FORCE_UNIT}`;
  const sense = newtons > 0 ? "tension" : "compression";
  return `${sign}${magnitude} ${FORCE_UNIT} (${sense})`;
}
