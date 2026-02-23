import { clamp, getNeighbors, hashUnit, mulberry32 } from './grid'
import { DEFAULT_MINE_PERCENT } from './settings'
import type { GenerationSettings, LayoutPhaseResult } from './types'

export interface MineGenerationCandidate {
  startIndex: number
  mineSet: Set<number>
}

function weightedPickIndex(weights: number[], random: () => number): number {
  const total = weights.reduce((sum, value) => sum + value, 0)
  if (total <= 0) return Math.floor(random() * weights.length)
  let needle = random() * total
  for (let i = 0; i < weights.length; i += 1) {
    needle -= weights[i]
    if (needle <= 0) return i
  }
  return weights.length - 1
}

function selectStartIndexCenterBiased(phase: LayoutPhaseResult, seed: number): number {
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

function selectStartIndexRandom(phase: LayoutPhaseResult, seed: number): number {
  if (phase.activeIndices.length === 0) return -1
  const pickIndex = Math.floor(hashUnit(seed, phase.rows, phase.cols, phase.activeIndices.length) * phase.activeIndices.length)
  return phase.activeIndices[pickIndex] ?? phase.activeIndices[0]
}

export function generateMinesWeighted(
  settings: GenerationSettings,
  phase: LayoutPhaseResult,
  targetMineCount: number,
  seed: number,
): MineGenerationCandidate {
  const startIndex = selectStartIndexCenterBiased(phase, seed ^ 0x5f3759df)
  const { rows, cols, activeMask, activeIndices } = phase
  const startNeighbors = new Set(getNeighbors(startIndex, rows, cols).filter((n) => activeMask[n]))
  const safeZone = new Set<number>([startIndex, ...startNeighbors])
  const eligible = activeIndices.filter((index) => !safeZone.has(index))
  const safeTarget = clamp(targetMineCount, 0, eligible.length)
  if (safeTarget <= 0 || eligible.length === 0) return { startIndex, mineSet: new Set<number>() }

  const startRow = Math.floor(startIndex / cols)
  const startCol = startIndex % cols
  const distanceScale = Math.max(2, Math.max(rows, cols) * 0.65)
  const spreadBias = clamp(settings.propagation / 100, 0.2, 0.95)
  const random = mulberry32(seed ^ (rows << 8) ^ cols)

  const pool = [...eligible]
  const weights = pool.map((index) => {
    const row = Math.floor(index / cols)
    const col = index % cols
    const dist = Math.hypot(row - startRow, col - startCol)
    const distNorm = clamp(dist / distanceScale, 0, 1.6)
    const localNoise = hashUnit(seed, row, col, settings.propagation)
    const layoutNoise = hashUnit(seed ^ 0x9e3779b9, col, row, rows + cols)
    return 0.2 + distNorm * (0.9 * spreadBias) + localNoise * 0.6 + layoutNoise * 0.45
  })

  const mineSet = new Set<number>()
  const desiredCount = Math.max(1, Math.round((activeIndices.length * DEFAULT_MINE_PERCENT) / 100))
  const picks = clamp(safeTarget, 1, Math.min(desiredCount, eligible.length))

  for (let count = 0; count < picks && pool.length > 0; count += 1) {
    const chosen = weightedPickIndex(weights, random)
    mineSet.add(pool[chosen])
    pool.splice(chosen, 1)
    weights.splice(chosen, 1)
  }

  return { startIndex, mineSet }
}

export function generateMinesPrototypeNoop(
  settings: GenerationSettings,
  phase: LayoutPhaseResult,
  targetMineCount: number,
  seed: number,
): MineGenerationCandidate {
  // Placeholder system for experimentation: intentionally does almost nothing.
  void settings
  void targetMineCount
  const startIndex = selectStartIndexRandom(phase, seed ^ 0x9e3779b9)
  return { startIndex, mineSet: new Set<number>() }
}
