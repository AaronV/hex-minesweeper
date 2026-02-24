import { hashUnit } from '../grid'
import type { LayoutPhaseResult } from '../types'

export function selectStartIndexRandom(phase: LayoutPhaseResult, seed: number): number {
  if (phase.activeIndices.length === 0) return -1
  const pickIndex = Math.floor(hashUnit(seed, phase.rows, phase.cols, phase.activeIndices.length) * phase.activeIndices.length)
  return phase.activeIndices[pickIndex] ?? phase.activeIndices[0]
}
