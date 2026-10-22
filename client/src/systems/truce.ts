/** Opening grace period: nobody opens fire until `until` (performance.now() ms), set when the player first enters. */
export const truce = { until: 0 };

export const holdingFire = (): boolean => performance.now() < truce.until;
