import { clamp, getNeighbors, hashUnit } from './grid'
import { DEFAULT_MINE_PERCENT } from './settings'
import type { GenerationSettings, ShapePhaseResult } from './types'

function adjustMineCount(
  mineMask: boolean[],
  targetMineCount: number,
  eligible: number[],
  cols: number,
  startIndex: number,
  seed: number,
): boolean[] {
  const next = [...mineMask]
  const startRow = Math.floor(startIndex / cols)
  const startCol = startIndex % cols
  const currentCount = () => eligible.reduce((count, idx) => count + (next[idx] ? 1 : 0), 0)

  const score = (index: number) => {
    const row = Math.floor(index / cols)
    const col = index % cols
    const dist = Math.hypot(row - startRow, col - startCol)
    return dist * 0.8 + hashUnit(seed, row, col, 911) * 0.6
  }

  let count = currentCount()
  if (count < targetMineCount) {
    const addOrder = [...eligible].filter((i) => !next[i]).sort((a, b) => score(b) - score(a))
    for (const index of addOrder) {
      if (count >= targetMineCount) break
      next[index] = true
      count += 1
    }
  } else if (count > targetMineCount) {
    const removeOrder = [...eligible].filter((i) => next[i]).sort((a, b) => score(a) - score(b))
    for (const index of removeOrder) {
      if (count <= targetMineCount) break
      next[index] = false
      count -= 1
    }
  }

  return next
}

export function generateMinesFromCA(
  settings: GenerationSettings,
  phase: ShapePhaseResult,
  targetMineCount: number,
  seed: number,
): Set<number> {
  const { rows, cols, activeMask, startIndex, activeIndices } = phase
  const startNeighbors = new Set(getNeighbors(startIndex, rows, cols).filter((n) => activeMask[n]))
  const safeZone = new Set<number>([startIndex, ...startNeighbors])
  const eligible = activeIndices.filter((index) => !safeZone.has(index))
  const mineMask = new Array<boolean>(rows * cols).fill(false)
  const startRow = Math.floor(startIndex / cols)
  const startCol = startIndex % cols
  const distanceScale = Math.max(2, Math.max(rows, cols) * 0.65)
  const jitterScale = settings.mapShape === 'rectangle' ? Math.max(rows, cols) : settings.mapSize

  const baseline = clamp(DEFAULT_MINE_PERCENT / 100, 0.08, 0.38)
  for (const index of eligible) {
    const row = Math.floor(index / cols)
    const col = index % cols
    const dist = Math.hypot(row - startRow, col - startCol)
    const distNorm = dist / distanceScale
    const localNoise = hashUnit(seed, row, col, settings.propagation)
    const mineScore = baseline * 0.72 + distNorm * 0.34 + localNoise * 0.42 - 0.44
    mineMask[index] = mineScore > 0
  }

  const iterations = 2 + Math.round(settings.propagation / 32)
  for (let step = 0; step < iterations; step += 1) {
    const next = [...mineMask]
    for (const index of eligible) {
      const neighbors = getNeighbors(index, rows, cols).filter((n) => activeMask[n] && !safeZone.has(n))
      const mineNeighbors = neighbors.reduce((count, n) => count + (mineMask[n] ? 1 : 0), 0)
      const jitter = hashUnit(seed + step * 101, index, mineNeighbors, jitterScale)
      const bornMin = settings.propagation > 60 ? 2 : 3
      const surviveMin = settings.propagation > 55 ? 1 : 2
      const surviveMax = settings.propagation > 70 ? 5 : 4

      if (mineMask[index]) {
        next[index] = mineNeighbors >= surviveMin && mineNeighbors <= surviveMax
      } else {
        next[index] = mineNeighbors >= bornMin && mineNeighbors <= 4 && jitter > 0.34
      }
    }
    for (const safeIndex of safeZone) next[safeIndex] = false
    for (let i = 0; i < mineMask.length; i += 1) mineMask[i] = next[i]
  }

  const normalized = adjustMineCount(mineMask, targetMineCount, eligible, cols, startIndex, seed)
  const mineSet = new Set<number>()
  for (const index of eligible) {
    if (normalized[index]) mineSet.add(index)
  }
  return mineSet
}
