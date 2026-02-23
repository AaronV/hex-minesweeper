import { clamp, randomSeed } from './grid'
import { generateMinesFromCA } from './mines'
import { normalizeSettings, estimatePlayableCells, getMineTargetFromActiveCells } from './settings'
import { generateShapePhase } from './shape'
import { deterministicSolveFromStarts } from './solver'
import { createTruthBoard } from './truth'
import { applyRightClick, chordReveal, revealCell, toggleFlag } from './transitions'
import { checkWin } from './truth'
import type { CellState, CellTruth, GameState, GenerationSettings } from './types'
import { DEFAULT_SETTINGS } from './types'

export type {
  CellState,
  CellTruth,
  GameState,
  GameStatus,
  GenerationSettings,
  MapShape,
  ShapePhaseResult,
} from './types'

export { DEFAULT_SETTINGS, randomSeed, normalizeSettings, estimatePlayableCells, getMineTargetFromActiveCells }
export { revealCell, toggleFlag, chordReveal, applyRightClick, checkWin }
export { getNeighbors } from './grid'

export function makeGame(settings: GenerationSettings, seed: number): GameState {
  const normalized = normalizeSettings(settings)
  const phase = generateShapePhase(normalized, seed)
  const { rows, cols, activeMask, activeIndices, startIndex } = phase
  const targetMineCount = clamp(getMineTargetFromActiveCells(activeIndices.length), 1, Math.max(1, activeIndices.length - 1))

  const mineSeed = seed + targetMineCount * 4099
  let mineSet = generateMinesFromCA(normalized, phase, targetMineCount, mineSeed)
  let truth: CellTruth[] = createTruthBoard(rows, cols, mineSet, activeMask)
  const deterministicSolvePassed = deterministicSolveFromStarts(truth, rows, cols, new Set([startIndex]))
  let mineCount = mineSet.size
  let fallbackApplied = false
  const note = deterministicSolvePassed
    ? 'Single-pass generation succeeded.'
    : 'Deterministic solve failed. Fallback applied (no mines).'

  if (!deterministicSolvePassed) {
    fallbackApplied = true
    mineSet = new Set<number>()
    mineCount = 0
    truth = createTruthBoard(rows, cols, mineSet, activeMask)
  }

  const cells: CellState[] = truth.map((cell, index) => ({
    ...cell,
    revealed: false,
    flagged: false,
    start: cell.active ? index === startIndex : false,
    exploded: false,
  }))

  return {
    cols,
    rows,
    mineCount,
    safeStartCount: 1,
    activeCellCount: activeIndices.length,
    seed,
    status: 'playing',
    cells,
    generationReport: {
      shapeSeed: seed,
      mineSeed,
      activeCells: activeIndices.length,
      targetMines: targetMineCount,
      generatedMines: mineCount,
      deterministicSolvePassed,
      fallbackApplied,
      note,
    },
  }
}
