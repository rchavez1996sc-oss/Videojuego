/** Rapier interaction groups: 16 bits of membership, then 16 bits of filter. */
const groups = (member: number, filter: number) => ((member << 16) | filter) >>> 0;

/**
 * Solver groups (contact forces only; queries and character controllers still see everything): physical vehicles get
 * no push from people's capsules and do not push them — a vehicle meeting a person is a run-over, handled apart.
 */
export const VEHICLE_SOLVER = groups(0x0001, 0xffff & ~0x0002);
export const PERSON_SOLVER = groups(0x0002, 0xffff & ~0x0001);
