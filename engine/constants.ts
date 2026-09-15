/**
 * Shared physical constants. SI base units throughout, with no exception
 * (AD-4): pascals for moduli, metres for length. Types live in `./types.ts`,
 * which is the single source of truth for them (AD-2) -- this file declares
 * data only and never re-derives a type `types.ts` already owns.
 */

/**
 * Young's modulus per Material, in pascals (N/m^2).
 *
 * Steel is 200 GPa. Concrete is 25 GPa -- a representative normal-weight
 * value, consistent with ACI's Ec ~= 4700*sqrt(f'c) MPa at f'c = 28 MPa.
 */
export const MATERIALS = {
  CONCRETE: {
    E: 25_000_000_000,
  },
  STEEL: {
    E: 200_000_000_000,
  },
} as const;

/**
 * Which degrees of freedom each Support restrains. `true` means the DOF is
 * fixed and drops out of the reduced system; `false` means it stays free.
 *
 * ROLLER restrains translation perpendicular to its surface only, which for
 * the horizontal surface assumed here is `u_y`.
 */
export const SUPPORTS = {
  FIXED: {
    u_x: true,
    u_y: true,
    theta_z: true,
  },
  HINGE: {
    u_x: true,
    u_y: true,
    theta_z: false,
  },
  ROLLER: {
    u_x: false,
    u_y: true,
    theta_z: false,
  },
  FREE: {
    u_x: false,
    u_y: false,
    theta_z: false,
  },
} as const;

/**
 * Degrees of freedom per Node by Structure Type. A Truss member carries axial
 * force only, so its Nodes have no rotational DOF; a Frame Node adds theta_z.
 */
export const DOFS = {
  TRUSS: 2,
  FRAME: 3,
} as const;

export const STRUCTURE_TYPES = {
  TRUSS: "TRUSS",
  FRAME: "FRAME",
} as const;
