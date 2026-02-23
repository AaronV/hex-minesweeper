import { hashUnit } from '../../grid'

/**
 * Builds a deterministic pick seed from base seed plus current step context.
 */
export function buildPickSeed(
  seed: number,
  rows: number,
  cols: number,
  targetMineCount: number,
  propagation: number,
): number {
  return seed ^ (rows << 8) ^ cols ^ targetMineCount ^ propagation
}

/**
 * Deterministically picks one candidate index using the provided seed,
 * excluding any indices listed in rejectedCandidates.
 *
 * Returns -1 when no candidate remains after rejection filtering.
 */
export function pickCandidate(
  candidates: number[],
  seed: number,
  rejectedCandidates: number[],
): number {
  const available = candidates.filter((index) => !rejectedCandidates.includes(index))
  if (available.length === 0) return -1

  const pickOffset = Math.floor(
    hashUnit(seed, available.length, rejectedCandidates.length, candidates.length) * available.length,
  )
  return available[pickOffset] ?? available[0]
}

/**
 * Deterministically picks a hint value in the range [0..maxHint], where maxHint
 * is limited by both the number of unassigned neighbors and the hex max of 6.
 */
export function pickHintValue(
  seed: number,
  targetIndex: number,
  unassignedNeighborCount: number,
): number {
  const maxHint = Math.min(6, Math.max(0, unassignedNeighborCount))
  if (maxHint === 0) return 0
  return Math.floor(hashUnit(seed, targetIndex, maxHint, unassignedNeighborCount) * (maxHint + 1))
}
