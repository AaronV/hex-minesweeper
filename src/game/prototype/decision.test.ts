import { describe, expect, it } from 'vitest'
import { getNeighbors } from '../grid'
import type { LayoutPhaseResult } from '../types'
import { hasSimulatedPlayerKnownSafeMove, inferForcedAssignments } from './decision'

function makePhase(rows: number, cols: number, activeIndices?: number[], startIndex = 0): LayoutPhaseResult {
  const activeMask = new Array(rows * cols).fill(false)
  const indices = activeIndices ?? Array.from({ length: rows * cols }, (_, i) => i)
  for (const index of indices) activeMask[index] = true
  return {
    rows,
    cols,
    activeMask,
    activeIndices: [...indices].sort((a, b) => a - b),
    startIndex,
  }
}

describe('prototype decision inference', () => {
  it('forces a mine when only one unknown can satisfy a revealed hint', () => {
    const phase = makePhase(3, 3)
    const center = 4
    const neighbors = getNeighbors(center, phase.rows, phase.cols)
    const forcedMine = neighbors[0]
    if (forcedMine === undefined) throw new Error('expected neighbor for center cell')

    const assignedSet = new Set<number>([center, ...neighbors.filter((index) => index !== forcedMine)])
    const assignedHints = new Map<number, number>([[center, 1]])
    const mineSet = new Set<number>()

    const inference = inferForcedAssignments(phase, assignedHints, assignedSet, mineSet)
    expect(inference.hasSolution).toBe(true)
    expect(inference.forcedMine.has(forcedMine)).toBe(true)
  })

  it('returns no solution when assigned hints are contradictory', () => {
    const phase = makePhase(3, 3)
    const center = 4
    const assignedSet = new Set<number>([center])
    const assignedHints = new Map<number, number>([[center, 7]])
    const mineSet = new Set<number>()

    const inference = inferForcedAssignments(phase, assignedHints, assignedSet, mineSet)
    expect(inference.hasSolution).toBe(false)
  })
})

describe('simulated player viability', () => {
  it('rejects a dead-end opening with no forced safe follow-up', () => {
    const phase = makePhase(3, 3, undefined, 4)
    const mineSet = new Set<number>([1])

    const viable = hasSimulatedPlayerKnownSafeMove(phase, phase.startIndex, mineSet)
    expect(viable).toBe(false)
  })
})
