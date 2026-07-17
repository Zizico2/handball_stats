/**
 * Collision-safe local ID allocation (minimal server surface for #24).
 *
 * IDs are random positive integers in the full `Number.MAX_SAFE_INTEGER`
 * range, generated from `crypto.getRandomValues`. Never derive IDs from
 * existing rows (max-plus-one) and never persist IDs supplied by external
 * data (for example CSV imports) as local IDs.
 */

const MAX_ID = Number.MAX_SAFE_INTEGER;

function randomSafeInteger(): number {
  // 53 random bits (21 high + 32 low) keep the value an exact safe integer.
  const words = new Uint32Array(2);
  crypto.getRandomValues(words);

  const high21 = words[0] & 0x1f_ff_ff;
  const low32 = words[1];

  return high21 * 0x1_00_00_00_00 + low32;
}

/** Allocates `count` unique, positive, collision-safe local IDs. */
export function allocateLocalIds(count: number): number[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`Invalid allocation count: ${count}`);
  }

  const ids = new Set<number>();
  while (ids.size < count) {
    const candidate = randomSafeInteger();
    if (candidate >= 1 && candidate <= MAX_ID) {
      ids.add(candidate);
    }
  }

  return [...ids];
}

export function allocateLocalId(): number {
  return allocateLocalIds(1)[0];
}
