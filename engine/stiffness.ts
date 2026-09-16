import { lusolve } from "mathjs";
import { DOFS, MATERIALS, SUPPORTS } from "./constants";
import { checkStability } from "./stability";
import { validateElements } from "./validation";
import type {
  ElementForce,
  EnginePayload,
  Load,
  SolveOutcome,
  SolveResult,
  StructuralElement,
  StructuralNode,
  StructureType,
} from "./types";
import { NO_DOF } from "./types";

/**
 * Direct Stiffness Method solver (AD-3).
 *
 * Pure, synchronous and framework-free (AD-1) -- mathjs is the only import,
 * and no mathjs value escapes: everything `solve()` returns is a plain number,
 * number[] or number[][], so a `SolveResult` is JSON-serialisable.
 *
 * One call produces both the final answers and every intermediate Show Steps
 * needs (FR-17 to FR-19). Nothing here is ever recomputed for display.
 */

/**
 * Relative residual above which the reduced system is treated as singular.
 *
 * `lusolve` throws only on an exactly singular matrix; a degenerate structure
 * (three parallel rollers, say) usually produces a near-singular one that
 * solves to enormous, meaningless displacements instead. Checking that
 * `K d = F` actually holds catches both, and does it in the scale-free terms a
 * structure of any size can be judged by.
 */
const RESIDUAL_TOLERANCE = 1e-6;

/**
 * Positional entity labels, matching `utils/labels.ts`'s convention.
 *
 * Derived here rather than passed in so `engine/` owes nothing to the UI
 * layer. Both sides read the same array order, so `N1` means the same Node in
 * an error message and in the properties panel. (If one convention ever
 * changes, the other must change with it -- they are two statements of one
 * rule.)
 */
function positionalLabel(prefix: string, index: number): string {
  return `${prefix}${index + 1}`;
}

interface ElementGeometry {
  length: number;
  /** Direction cosine along the member. */
  cos: number;
  /** Direction sine along the member. */
  sin: number;
}

function geometryOf(
  element: StructuralElement,
  nodeById: Map<string, StructuralNode>,
): ElementGeometry | null {
  const start = nodeById.get(element.startNode);
  const end = nodeById.get(element.endNode);
  if (!start || !end) return null;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;
  return { length, cos: dx / length, sin: dy / length };
}

/**
 * Local stiffness matrix in the member's own frame.
 *
 * A Truss member is axial-only, so its matrix is 4x4 over [u1, v1, u2, v2] and
 * every transverse term is zero. A Frame member adds bending, giving the 6x6
 * over [u1, v1, theta1, u2, v2, theta2] with the standard EA/L, 12EI/L^3,
 * 6EI/L^2, 4EI/L and 2EI/L terms.
 *
 * This is the matrix FR-17 shows with the Element's own numbers substituted
 * in, which is why it is what the result carries.
 */
export function localStiffnessMatrix(
  structureType: StructureType,
  E: number,
  area: number,
  inertia: number,
  length: number,
): number[][] {
  const ea = (E * area) / length;

  if (structureType === "TRUSS") {
    return [
      [ea, 0, -ea, 0],
      [0, 0, 0, 0],
      [-ea, 0, ea, 0],
      [0, 0, 0, 0],
    ];
  }

  const ei = E * inertia;
  const l = length;
  const a = (12 * ei) / l ** 3;
  const b = (6 * ei) / l ** 2;
  const c = (4 * ei) / l;
  const d = (2 * ei) / l;

  return [
    [ea, 0, 0, -ea, 0, 0],
    [0, a, b, 0, -a, b],
    [0, b, c, 0, -b, d],
    [-ea, 0, 0, ea, 0, 0],
    [0, -a, -b, 0, a, -b],
    [0, b, d, 0, -b, c],
  ];
}

/**
 * Transformation from global to local coordinates, so `d_local = T d_global`
 * and the global stiffness of a member is `T^T k T`.
 */
export function transformationMatrix(
  structureType: StructureType,
  cos: number,
  sin: number,
): number[][] {
  if (structureType === "TRUSS") {
    return [
      [cos, sin, 0, 0],
      [-sin, cos, 0, 0],
      [0, 0, cos, sin],
      [0, 0, -sin, cos],
    ];
  }
  return [
    [cos, sin, 0, 0, 0, 0],
    [-sin, cos, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 0],
    [0, 0, 0, cos, sin, 0],
    [0, 0, 0, -sin, cos, 0],
    [0, 0, 0, 0, 0, 1],
  ];
}

function multiply(a: number[][], b: number[][]): number[][] {
  const rows = a.length;
  const inner = b.length;
  const cols = b[0].length;
  const out: number[][] = [];
  for (let i = 0; i < rows; i += 1) {
    const row = new Array<number>(cols).fill(0);
    for (let k = 0; k < inner; k += 1) {
      const aik = a[i][k];
      if (aik === 0) continue;
      for (let j = 0; j < cols; j += 1) row[j] += aik * b[k][j];
    }
    out.push(row);
  }
  return out;
}

function transpose(m: number[][]): number[][] {
  return m[0].map((_, j) => m.map((row) => row[j]));
}

function applyMatrix(m: number[][], v: number[]): number[] {
  return m.map((row) => row.reduce((sum, value, j) => sum + value * v[j], 0));
}

/**
 * Work-equivalent nodal loads for a UDL, in the member's local frame.
 *
 * The load is resolved along and across the member: the axial part lumps to
 * `wL/2` at each end, the transverse part to `wL/2` shears plus the
 * `±wL^2/12` end moments that make the equivalence exact. Element end forces
 * must subtract this vector back out, or a loaded member reports the forces of
 * an unloaded one.
 */
export function udlEquivalentLoads(
  intensity: number,
  directionX: number,
  directionY: number,
  geometry: ElementGeometry,
  structureType: StructureType,
): number[] {
  const { length, cos, sin } = geometry;
  const along = intensity * (directionX * cos + directionY * sin);
  const across = intensity * (-directionX * sin + directionY * cos);

  if (structureType === "TRUSS") {
    // Unreachable in practice -- validation blocks a UDL on a Truss member --
    // but lumping axially is the only meaning a bending-free member could give it.
    return [(along * length) / 2, (across * length) / 2, (along * length) / 2, (across * length) / 2];
  }

  const shear = (across * length) / 2;
  const moment = (across * length ** 2) / 12;
  const axial = (along * length) / 2;
  return [axial, shear, moment, axial, shear, -moment];
}

function dofCount(structureType: StructureType): number {
  return DOFS[structureType];
}

/** Global DOF indices for one Element's two Nodes, in local matrix order. */
function elementDofs(
  element: StructuralElement,
  dofMap: Record<string, [number, number, number]>,
  perNode: number,
): number[] {
  const start = dofMap[element.startNode];
  const end = dofMap[element.endNode];
  return perNode === 2
    ? [start[0], start[1], end[0], end[1]]
    : [start[0], start[1], start[2], end[0], end[1], end[2]];
}

export function solve(payload: EnginePayload): SolveOutcome {
  const { type: structureType, nodes, elements, loads } = payload;

  const elementIndex = new Map(elements.map((e, i) => [e.id, i]));
  const nodeIndex = new Map(nodes.map((n, i) => [n.id, i]));
  const elementLabel = (id: string) =>
    positionalLabel("E", elementIndex.get(id) ?? 0);
  const nodeLabel = (id: string) => positionalLabel("N", nodeIndex.get(id) ?? 0);

  // Stability first: a zero-Element structure is "nothing to analyze yet",
  // which must not be reported as instability, and an unrestrained region is
  // more useful to hear about than the incomplete Elements inside it.
  const stabilityErrors = checkStability(
    nodes,
    elements,
    structureType,
    nodeLabel,
  );
  if (stabilityErrors.length > 0) return { ok: false, errors: stabilityErrors };

  const validationErrors = validateElements(
    elements,
    loads,
    structureType,
    elementLabel,
  );
  if (validationErrors.length > 0) {
    return { ok: false, errors: validationErrors };
  }

  const perNode = dofCount(structureType);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  const dofMap: Record<string, [number, number, number]> = {};
  nodes.forEach((node, index) => {
    const base = index * perNode;
    dofMap[node.id] =
      perNode === 2
        ? [base, base + 1, NO_DOF]
        : [base, base + 1, base + 2];
  });

  const size = nodes.length * perNode;
  const globalK: number[][] = Array.from({ length: size }, () =>
    new Array<number>(size).fill(0),
  );
  const globalF = new Array<number>(size).fill(0);

  const localStiffness: Record<string, number[][]> = {};
  const geometries = new Map<string, ElementGeometry>();
  // Kept so element end forces can subtract the equivalent loads back out.
  const equivalentLocal = new Map<string, number[]>();

  for (const element of elements) {
    const geometry = geometryOf(element, nodeById);
    // Validation guarantees usable properties; geometry can still be null if an
    // Element outlived its Nodes, in which case it contributes nothing.
    if (!geometry) continue;
    geometries.set(element.id, geometry);

    const E = MATERIALS[element.material as NonNullable<typeof element.material>].E;
    const k = localStiffnessMatrix(
      structureType,
      E,
      element.area as number,
      (element.inertia ?? 0) as number,
      geometry.length,
    );
    localStiffness[element.id] = k;

    const T = transformationMatrix(structureType, geometry.cos, geometry.sin);
    const kGlobal = multiply(multiply(transpose(T), k), T);
    const dofs = elementDofs(element, dofMap, perNode);

    for (let i = 0; i < dofs.length; i += 1) {
      for (let j = 0; j < dofs.length; j += 1) {
        globalK[dofs[i]][dofs[j]] += kGlobal[i][j];
      }
    }
  }

  // Loads: concentrated straight onto the Node's DOFs, UDLs via their
  // work-equivalent nodal vector. Multiple Loads on one target sum, because
  // each is its own entry (AD-10) and this loop adds rather than assigns.
  for (const load of loads) {
    if (load.kind === "concentrated") {
      const dofs = dofMap[load.target.nodeId];
      if (!dofs) continue;
      globalF[dofs[0]] += load.magnitude * load.direction[0];
      globalF[dofs[1]] += load.magnitude * load.direction[1];
      continue;
    }

    const element = elements.find((e) => e.id === load.target.elementId);
    const geometry = element ? geometries.get(element.id) : undefined;
    if (!element || !geometry) continue;

    const local = udlEquivalentLoads(
      load.magnitude,
      load.direction[0],
      load.direction[1],
      geometry,
      structureType,
    );
    const previous = equivalentLocal.get(element.id);
    equivalentLocal.set(
      element.id,
      previous ? previous.map((value, i) => value + local[i]) : local,
    );

    const T = transformationMatrix(structureType, geometry.cos, geometry.sin);
    const globalEquivalent = applyMatrix(transpose(T), local);
    const dofs = elementDofs(element, dofMap, perNode);
    for (let i = 0; i < dofs.length; i += 1) {
      globalF[dofs[i]] += globalEquivalent[i];
    }
  }

  // Boundary conditions: a restrained DOF leaves the system entirely rather
  // than being penalised into place, so the reduced system is exactly what
  // FR-19 displays.
  const restrained = new Array<boolean>(size).fill(false);
  const freeDofLabels: string[] = [];
  const restrainedDofLabels: string[] = [];
  const freeDofs: number[] = [];
  const axisNames = ["ux", "uy", "theta"] as const;

  for (const node of nodes) {
    const flags = SUPPORTS[node.support];
    const dofs = dofMap[node.id];
    const fixed = [
      flags.u_x,
      flags.u_y,
      perNode === 3 ? flags.theta_z : false,
    ];
    for (let axis = 0; axis < perNode; axis += 1) {
      const dof = dofs[axis];
      // Both lists come from this one expression, so a free DOF and an
      // eliminated one can never be named by different conventions.
      const label = `${nodeLabel(node.id)}:${axisNames[axis]}`;
      if (fixed[axis]) {
        restrained[dof] = true;
        restrainedDofLabels.push(label);
        continue;
      }
      freeDofs.push(dof);
      freeDofLabels.push(label);
    }
  }

  const reducedK = freeDofs.map((row) => freeDofs.map((col) => globalK[row][col]));
  const reducedF = freeDofs.map((dof) => globalF[dof]);

  const displacementVector = new Array<number>(size).fill(0);

  if (freeDofs.length > 0) {
    let solution: number[];
    try {
      const raw = lusolve(reducedK, reducedF) as unknown;
      solution = (raw as number[][]).map((row) =>
        Array.isArray(row) ? row[0] : (row as unknown as number),
      );
    } catch {
      return {
        ok: false,
        errors: [
          {
            code: "SINGULAR_SYSTEM",
            message:
              "Can't solve: this structure isn't held still enough to analyze. Check that its Supports prevent it from sliding or rotating, then Solve again.",
          },
        ],
      };
    }

    if (!solution.every((value) => Number.isFinite(value))) {
      return {
        ok: false,
        errors: [
          {
            code: "SINGULAR_SYSTEM",
            message:
              "Can't solve: this structure isn't held still enough to analyze. Check that its Supports prevent it from sliding or rotating, then Solve again.",
          },
        ],
      };
    }

    // Residual check: lusolve throws only on an exactly singular matrix, so a
    // merely degenerate structure would otherwise return enormous nonsense.
    const residual = applyMatrix(reducedK, solution).map(
      (value, i) => value - reducedF[i],
    );
    const scale = Math.max(...reducedF.map(Math.abs), 1);
    const worst = Math.max(...residual.map(Math.abs));
    if (worst / scale > RESIDUAL_TOLERANCE) {
      return {
        ok: false,
        errors: [
          {
            code: "SINGULAR_SYSTEM",
            message:
              "Can't solve: this structure isn't held still enough to analyze. Check that its Supports prevent it from sliding or rotating, then Solve again.",
          },
        ],
      };
    }

    freeDofs.forEach((dof, i) => {
      displacementVector[dof] = solution[i];
    });
  }

  // Reactions come from the assembled system, not a second derivation:
  // R = K d - F, read at the restrained DOFs.
  const internal = applyMatrix(globalK, displacementVector);

  const displacements: SolveResult["displacements"] = {};
  const reactions: SolveResult["reactions"] = {};

  for (const node of nodes) {
    const dofs = dofMap[node.id];
    displacements[node.id] = [
      displacementVector[dofs[0]],
      displacementVector[dofs[1]],
      perNode === 3 ? displacementVector[dofs[2]] : 0,
    ];

    if (node.support === "FREE") continue;
    const flags = SUPPORTS[node.support];
    reactions[node.id] = [
      flags.u_x ? internal[dofs[0]] - globalF[dofs[0]] : 0,
      flags.u_y ? internal[dofs[1]] - globalF[dofs[1]] : 0,
      perNode === 3 && flags.theta_z
        ? internal[dofs[2]] - globalF[dofs[2]]
        : 0,
    ];
  }

  const elementForces: Record<string, ElementForce> = {};
  for (const element of elements) {
    const geometry = geometries.get(element.id);
    const k = localStiffness[element.id];
    if (!geometry || !k) continue;

    const T = transformationMatrix(structureType, geometry.cos, geometry.sin);
    const dofs = elementDofs(element, dofMap, perNode);
    const globalDisplacement = dofs.map((dof) => displacementVector[dof]);
    const localDisplacement = applyMatrix(T, globalDisplacement);
    const endForces = applyMatrix(k, localDisplacement);

    const equivalent = equivalentLocal.get(element.id);
    if (equivalent) {
      for (let i = 0; i < endForces.length; i += 1) {
        endForces[i] -= equivalent[i];
      }
    }

    if (perNode === 2) {
      elementForces[element.id] = {
        // Positive in tension: the force pulling the start Node toward the end.
        axial: endForces[2],
        shearStart: 0,
        shearEnd: 0,
        momentStart: 0,
        momentEnd: 0,
      };
      continue;
    }

    elementForces[element.id] = {
      axial: endForces[3],
      shearStart: endForces[1],
      shearEnd: endForces[4],
      momentStart: endForces[2],
      momentEnd: endForces[5],
    };
  }

  return {
    ok: true,
    result: {
      displacements,
      reactions,
      elementForces,
      localStiffness,
      dofMap,
      reducedSystem: {
        K: reducedK,
        F: reducedF,
        freeDofs: freeDofLabels,
        restrainedDofs: restrainedDofLabels,
      },
    },
  };
}

/** Sums a solved structure's Reactions and applied Loads -- zero at equilibrium. */
export function equilibriumResidual(
  result: SolveResult,
  loads: Load[],
): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const reaction of Object.values(result.reactions)) {
    x += reaction[0];
    y += reaction[1];
  }
  for (const load of loads) {
    if (load.kind !== "concentrated") continue;
    x += load.magnitude * load.direction[0];
    y += load.magnitude * load.direction[1];
  }
  return { x, y };
}
