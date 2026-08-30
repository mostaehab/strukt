export const MATERIALS = {
    CONCRETE: {
        id: 'concrete',
        E: 25000000,
    },
    STEEL: {
        id: 'steel',
        E: 200000000000,
    },
} as const;

export type MaterialType = keyof typeof MATERIALS;

export const SUPPORTS = {
    FIXED: {
        id: 'fixed',
        u_x: true,
        u_y: true,
        theta_z: true,
    },
    HINGE: {
        id: 'hinge',
        u_x: true,
        u_y: true,
        theta_z: false,
    },
    ROLLER: {
        id: 'roller',
        u_x: false,
        u_y: true,
        theta_z: false,
    },
    FREE: {
        id: 'free',
        u_x: false,
        u_y: false,
        theta_z: false,
    },
} as const;


export type SupportType = keyof typeof SUPPORTS;

export const DOFS = {
    TRUSS: 2,
    FRAME: 3,
} as const;

export const STRUCTURE_TYPES = {
    TRUSS: 'TRUSS',
    FRAME: 'FRAME',
} as const;