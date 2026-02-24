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
 * Builds a deterministic attempt order for hint values in [minHint..maxHint].
 */
export function buildHintAttemptOrder(
  seed: number,
  targetIndex: number,
  minHint: number,
  maxHint: number,
): number[] {
  const boundedMinHint = Math.max(0, Math.min(6, minHint))
  const boundedMaxHint = Math.max(boundedMinHint, Math.min(6, maxHint))
  const values = Array.from(
    { length: boundedMaxHint - boundedMinHint + 1 },
    (_, offset) => boundedMinHint + offset,
  )
  return values.sort((a, b) => {
    const ah = hashUnit(seed, targetIndex, a, values.length)
    const bh = hashUnit(seed, targetIndex, b, values.length)
    if (ah !== bh) return ah - bh
    return a - b
  })
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

/**
 * Returns true when the current assigned frontier contains at least one
 * non-ambiguous forced move for a player-like next step.
 */
export function hasForcedNextMove(
  phase: LayoutPhaseResult,
  assignedSet: Set<number>,
  hintAssignments: Map<number, number>,
  mineSet: Set<number>,
): boolean {
  for (const assignedIndex of assignedSet) {
    const hintValue = hintAssignments.get(assignedIndex)
    if (hintValue === undefined) continue

    const activeNeighbors = getNeighbors(assignedIndex, phase.rows, phase.cols).filter(
      (index) => phase.activeMask[index],
    )
    const minedNeighborCount = activeNeighbors.filter((index) => mineSet.has(index)).length
    const unknownNeighbors = activeNeighbors.filter((index) => !mineSet.has(index) && !assignedSet.has(index))
    if (unknownNeighbors.length === 0) continue

    const remainingMines = hintValue - minedNeighborCount
    if (remainingMines === 0 || remainingMines === unknownNeighbors.length) return true
  }
  return false
}

/**
 * Builds the next candidate frontier from neighbors of all assigned cells,
 * excluding assigned cells and inactive cells.
 */
export function buildCandidateIndicesFromAssigned(
  phase: LayoutPhaseResult,
  assignedSet: Set<number>,
): number[] {
  const candidateSet = new Set<number>()
  const assignedIndices = [...assignedSet].sort((a, b) => a - b)
  for (const assignedIndex of assignedIndices) {
    for (const neighborIndex of getNeighbors(assignedIndex, phase.rows, phase.cols)) {
      if (!phase.activeMask[neighborIndex]) continue
      if (assignedSet.has(neighborIndex)) continue
      candidateSet.add(neighborIndex)
    }
  }
  return [...candidateSet].sort((a, b) => a - b)
}
