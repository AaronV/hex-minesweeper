import { hashUnit } from '../grid'
import type { LayoutPhaseResult } from '../types'

export function selectStartIndexCenterBiased(phase: LayoutPhaseResult, seed: number): number {
  if (phase.activeIndices.length === 0) return -1
  const centerRow = Math.floor(phase.rows / 2)
  const centerCol = Math.floor(phase.cols / 2)
  const ranked = [...phase.activeIndices].sort((a, b) => {
    const ar = Math.floor(a / phase.cols)
    const ac = a % phase.cols
    const br = Math.floor(b / phase.cols)
    const bc = b % phase.cols
    const ad = Math.hypot(ar - centerRow, ac - centerCol)
    const bd = Math.hypot(br - centerRow, bc - centerCol)
    if (ad !== bd) return ad - bd
    const at = hashUnit(seed, ar, ac, phase.rows + phase.cols)
    const bt = hashUnit(seed, br, bc, phase.rows + phase.cols)
    return at - bt
  })
  const band = ranked.slice(0, Math.max(1, Math.floor(ranked.length * 0.35)))
  const pickIndex = Math.floor(hashUnit(seed, phase.rows, phase.cols, band.length) * band.length)
  return band[pickIndex] ?? ranked[0]
}

export function selectStartIndexRandom(phase: LayoutPhaseResult, seed: number): number {
  if (phase.activeIndices.length === 0) return -1
  const pickIndex = Math.floor(hashUnit(seed, phase.rows, phase.cols, phase.activeIndices.length) * phase.activeIndices.length)
  return phase.activeIndices[pickIndex] ?? phase.activeIndices[0]
}

export function sortBySeed(values: number[], seed: number, salt: number): number[] {
  return [...values].sort((a, b) => {
    const ha = hashUnit(seed, a, salt, values.length)
    const hb = hashUnit(seed, b, salt, values.length)
    if (ha !== hb) return ha - hb
    return a - b
  })
}
