import { getNeighbors, hashUnit } from '../../grid'
import type { LayoutPhaseResult } from '../../types'

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

/**
 * Deterministically selects up to `count` values from candidates, excluding rejected values.
 */
export function pickCandidates(
  candidates: number[],
  seed: number,
  count: number,
  rejectedCandidates: number[],
): number[] {
  if (count <= 0) return []
  const available = candidates.filter((index) => !rejectedCandidates.includes(index))
  const ranked = [...available].sort((a, b) => {
    const ah = hashUnit(seed, a, count, available.length)
    const bh = hashUnit(seed, b, count, available.length)
    if (ah !== bh) return ah - bh
    return a - b
  })
  return ranked.slice(0, Math.min(count, ranked.length))
}

/**
 * Returns true when adding a mine at candidateIndex would not violate
 * any currently assigned hint constraints.
 */
export function canAcceptMine(
  candidateIndex: number,
  phase: LayoutPhaseResult,
  assignedSet: Set<number>,
  hintAssignments: Map<number, number>,
  mineSet: Set<number>,
): boolean {
  const candidateNeighbors = getNeighbors(candidateIndex, phase.rows, phase.cols).filter((index) => phase.activeMask[index])
  for (const assignedNeighborIndex of candidateNeighbors) {
    if (!assignedSet.has(assignedNeighborIndex)) continue
    const assignedHint = hintAssignments.get(assignedNeighborIndex)
    if (assignedHint === undefined) continue
    const assignedNeighborMines = getNeighbors(assignedNeighborIndex, phase.rows, phase.cols).filter(
      (index) => phase.activeMask[index] && mineSet.has(index),
    ).length
    if (assignedNeighborMines + 1 > assignedHint) return false
  }
  return true
}
