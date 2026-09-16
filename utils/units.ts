import type { LoadKind } from "@/engine/types";
import type { UnitSystem } from "@/store/useUnitStore";

/**
 * The single read/write-through boundary between the SI values `engine/` and
 * `store/` hold and whatever the panel, canvas and results display (AD-4).
 * Every conversion goes through here, so the SI/Imperial choice has one place
 * to hook rather than a scatter of `/ 1000` literals.
 *
 * Nothing here is ever stored: a converted value exists only long enough to be
 * rendered, or only long enough to be converted back on the way in.
 */
export const NEWTONS_PER_KILONEWTON = 1000;


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
function compact(value: number): string {
  const magnitude = Math.abs(value);
  if (
    magnitude >= EXPONENTIAL_ABOVE ||
    (magnitude > 0 && magnitude < EXPONENTIAL_BELOW)
  ) {
    return value.toExponential(2);
  }
  return String(Number.parseFloat(value.toPrecision(12)));
}

/**
 * Formats an already-converted display value.
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
export function formatScaled(value: number, fractionDigits?: number): string {
  if (fractionDigits === undefined) return compact(value);
  if (Math.abs(value) >= EXPONENTIAL_ABOVE) return compact(value);

  const fixed = value.toFixed(fractionDigits);
  // Genuinely zero, or the rounding kept something: either way it is honest.
  if (value === 0 || Number.parseFloat(fixed) !== 0) return fixed;
  return compact(value);
}

/**
 * Imperial factors, exact by definition of the inch (0.0254 m) and the
 * pound-force. Stated as the SI value of one Imperial unit, so every
 * conversion is one division on the way out and one multiplication on the way
 * in -- never a chain that could round twice.
 */
const NEWTONS_PER_KIP = 4448.2216;
const METRES_PER_FOOT = 0.3048;
const SQUARE_METRES_PER_SQUARE_INCH = 0.0254 ** 2;
const METRES4_PER_INCH4 = 0.0254 ** 4;

/** One force unit of the system, in newtons. */
function forceFactor(system: UnitSystem): number {
  return system === "IMPERIAL" ? NEWTONS_PER_KIP : NEWTONS_PER_KILONEWTON;
}

/**
 * One moment unit of the system, in newton-metres.
 *
 * kN·m is kN times a metre; kip·ft is kip times a foot -- the length differs
 * between the systems, so this is not simply the force factor.
 */
function momentFactor(system: UnitSystem): number {
  return system === "IMPERIAL"
    ? NEWTONS_PER_KIP * METRES_PER_FOOT
    : NEWTONS_PER_KILONEWTON;
}

/**
 * The display unit for a Load's magnitude: force for a concentrated Load,
 * force per unit length for a UDL. Never derived by string-concatenating "/m"
 * at a call site, so the two kinds can never be labelled with each other's
 * unit, and neither can be labelled with the other system's.
 */
export function loadUnitLabel(kind: LoadKind, system: UnitSystem): string {
  if (system === "IMPERIAL") return kind === "udl" ? "kip/ft" : "kip";
  return kind === "udl" ? "kN/m" : "kN";
}

/** Display unit for a force. */
export function forceUnit(system: UnitSystem): string {
  return system === "IMPERIAL" ? "kip" : "kN";
}

/** Display unit for a moment. */
export function momentUnit(system: UnitSystem): string {
  return system === "IMPERIAL" ? "kip·ft" : "kN·m";
}

/** Display unit for a length. */
export function lengthUnit(system: UnitSystem): string {
  return system === "IMPERIAL" ? "ft" : "m";
}

/**
 * Display units for a section's properties.
 *
 * Imperial mixes feet for spans with inches for sections on purpose: that is
 * how AISC tabulates them and how the coursework is written, and the catalog
 * already stores its W-shapes converted from in^2 and in^4.
 */
export function areaUnit(system: UnitSystem): string {
  return system === "IMPERIAL" ? "in²" : "m²";
}

export function inertiaUnit(system: UnitSystem): string {
  return system === "IMPERIAL" ? "in⁴" : "m⁴";
}

/** Read-through: an SI force out of the store, display units on screen. */
export function forceToDisplay(newtons: number, system: UnitSystem): number {
  return newtons / forceFactor(system);
}

/** Write-through: a display force typed into a field, newtons into the store. */
export function forceToStore(value: number, system: UnitSystem): number {
  return value * forceFactor(system);
}

export function momentToDisplay(newtonMetres: number, system: UnitSystem): number {
  return newtonMetres / momentFactor(system);
}

export function lengthToDisplay(metres: number, system: UnitSystem): number {
  return system === "IMPERIAL" ? metres / METRES_PER_FOOT : metres;
}

export function areaToDisplay(squareMetres: number, system: UnitSystem): number {
  return system === "IMPERIAL"
    ? squareMetres / SQUARE_METRES_PER_SQUARE_INCH
    : squareMetres;
}

export function areaToStore(value: number, system: UnitSystem): number {
  return system === "IMPERIAL" ? value * SQUARE_METRES_PER_SQUARE_INCH : value;
}

export function inertiaToDisplay(metres4: number, system: UnitSystem): number {
  return system === "IMPERIAL" ? metres4 / METRES4_PER_INCH4 : metres4;
}

export function inertiaToStore(value: number, system: UnitSystem): number {
  return system === "IMPERIAL" ? value * METRES4_PER_INCH4 : value;
}

/** Formats an SI force in the selected system's unit. */
export function formatForce(
  newtons: number,
  system: UnitSystem,
  fractionDigits?: number,
): string {
  return formatScaled(forceToDisplay(newtons, system), fractionDigits);
}

/** Formats an SI moment in the selected system's unit. */
export function formatMoment(
  newtonMetres: number,
  system: UnitSystem,
  fractionDigits?: number,
): string {
  return formatScaled(momentToDisplay(newtonMetres, system), fractionDigits);
}

/** Formats an SI length in the selected system's unit. */
export function formatLength(
  metres: number,
  system: UnitSystem,
  fractionDigits = 2,
): string {
  return formatScaled(lengthToDisplay(metres, system), fractionDigits);
}

/**
 * Signed force with the word a student reads off an NFD.
 *
 * FR-14 requires tension and compression to be distinguished by sign in the
 * label text alone, never by an additional colour -- the palette carries no
 * hue for it, and `DESIGN.md`'s Colors rule forbids inventing one. Only the
 * number and unit change between systems; the sense word does not.
 */
export function axialForceLabel(newtons: number, system: UnitSystem): string {
  const unit = forceUnit(system);
  if (newtons === 0) return `0 ${unit}`;
  const sign = newtons > 0 ? "+" : "−";
  const sense = newtons > 0 ? "tension" : "compression";
  return `${sign}${formatForce(Math.abs(newtons), system, 1)} ${unit} (${sense})`;
}
