import { hashUnit } from '../../grid'
import type { LayoutPhaseResult } from '../../types'

/**
 * Builds a deterministic pick seed from base seed plus current step context.
 */
export function buildPickSeed(
  seed: number,
  phase: LayoutPhaseResult,
  targetMineCount: number,
  propagation: number,
): number {
  return seed ^ (phase.rows << 8) ^ phase.cols ^ targetMineCount ^ propagation
}

/**
 * Deterministically picks one candidate index using the provided seed,
 * excluding any indices listed in rejectedCandidates.
 *
 * Returns -1 when no candidate remains after rejection filtering.
 */
export function pickDeterministicCandidate(
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
