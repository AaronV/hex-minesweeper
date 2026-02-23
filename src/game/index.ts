import { clamp, hashUnit, randomSeed } from './grid'
import { generateMinesFromCA } from './mines'
import { normalizeSettings, estimatePlayableCells, getMineTargetFromActiveCells } from './settings'
import { generateShapePhase } from './shape'
import { deterministicSolveFromStarts } from './solver'
import { createTruthBoard } from './truth'
import { applyRightClick, chordReveal, revealCell, toggleFlag } from './transitions'
import { checkWin } from './truth'
import type { CellState, CellTruth, GameState, GenerationSettings, ShapePhaseResult } from './types'
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

interface BuildGameArgs {
  phase: ShapePhaseResult
  truth: CellTruth[]
  mineCount: number
  seed: number
  report: GameState['generationReport']
}

function buildGameState({ phase, truth, mineCount, seed, report }: BuildGameArgs): GameState {
  const { rows, cols, activeIndices, startIndex } = phase
  const cells: CellState[] = truth.map((cell, index) => ({
    ...cell,
    revealed: false,
    flagged: false,
    start: cell.active && startIndex >= 0 ? index === startIndex : false,
    exploded: false,
  }))

  return {
    cols,
    rows,
    mineCount,
    safeStartCount: startIndex >= 0 ? 1 : 0,
    activeCellCount: activeIndices.length,
    seed,
    status: 'playing',
    cells,
    generationReport: report,
  }
}

function assignStartCell(phase: ShapePhaseResult, seed: number): ShapePhaseResult {
  if (phase.activeIndices.length === 0) return { ...phase, startIndex: -1 }
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
  return { ...phase, startIndex: band[pickIndex] ?? ranked[0] }
}

export function generateLayoutOnly(settings: GenerationSettings, seed: number): { phase: ShapePhaseResult; game: GameState } {
  const normalized = normalizeSettings(settings)
  const phase = generateShapePhase(normalized, seed)
  const truth = createTruthBoard(phase.rows, phase.cols, new Set<number>(), phase.activeMask)
  const game = buildGameState({
    phase,
    truth,
    mineCount: 0,
    seed,
    report: {
      shapeSeed: seed,
      mineSeed: seed,
      activeCells: phase.activeIndices.length,
      targetMines: 0,
      generatedMines: 0,
      deterministicSolvePassed: true,
      fallbackApplied: false,
      note: 'Layout generated. No mines placed yet.',
    },
  })
  return { phase, game }
}

export function generateMinesForLayout(
  settings: GenerationSettings,
  phase: ShapePhaseResult,
  shapeSeed: number,
  seed: number,
): GameState {
  const phaseWithStart = assignStartCell(phase, seed ^ shapeSeed)
  const normalized = normalizeSettings(settings)
  const targetMineCount = clamp(
    getMineTargetFromActiveCells(phaseWithStart.activeIndices.length),
    1,
    Math.max(1, phaseWithStart.activeIndices.length - 1),
  )
  const mineSet = generateMinesFromCA(normalized, phaseWithStart, targetMineCount, seed)
  const truth = createTruthBoard(phaseWithStart.rows, phaseWithStart.cols, mineSet, phaseWithStart.activeMask)
  const deterministicSolvePassed = deterministicSolveFromStarts(
    truth,
    phaseWithStart.rows,
    phaseWithStart.cols,
    new Set([phaseWithStart.startIndex]),
  )

  return buildGameState({
    phase: phaseWithStart,
    truth,
    mineCount: mineSet.size,
    seed,
    report: {
      shapeSeed,
      mineSeed: seed,
      activeCells: phase.activeIndices.length,
      targetMines: targetMineCount,
      generatedMines: mineSet.size,
      deterministicSolvePassed,
      fallbackApplied: false,
      note: deterministicSolvePassed
        ? 'Mines generated. Deterministic check passed.'
        : 'Mines generated. Deterministic check failed.',
    },
  })
}

export function makeGame(settings: GenerationSettings, seed: number): GameState {
  const { phase } = generateLayoutOnly(settings, seed)
  return generateMinesForLayout(settings, phase, seed, seed + 4099)
}
