import { create } from "zustand";

/**
 * Display unit system (FR-20, AD-4).
 *
 * Deliberately its own store rather than a field on `useStructureStore`.
 * AD-4 makes this a UI preference, not a property of the structure -- and
 * keeping it out of the structure store is what makes "toggling units never
 * invalidates results" true by construction rather than by remembering to omit
 * `invalidated()` from one action. The invalidation helper is only reachable
 * from the structure store's own mutations, so this one cannot trip it.
 *
 * Not persisted: v1 stores no per-user preference.
 */
export type UnitSystem = "SI" | "IMPERIAL";

interface UnitState {
  system: UnitSystem;
  setSystem: (system: UnitSystem) => void;
}

const useUnitStore = create<UnitState>((set) => ({
  system: "SI",
  setSystem: (system) => set({ system }),
}));

export default useUnitStore;
