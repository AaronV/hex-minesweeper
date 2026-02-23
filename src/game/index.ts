import { clamp, hashUnit, randomSeed } from './grid'
import { generateMinesFromCA } from './mines'
import { normalizeSettings, estimatePlayableCells, getMineTargetFromActiveCells } from './settings'
import { generateLayoutPhase } from './layout'
import { deterministicSolveFromStarts } from './solver'
import { createTruthBoard } from './truth'
import { applyRightClick, chordReveal, revealCell, toggleFlag } from './transitions'
import { checkWin } from './truth'
import type { CellState, CellTruth, GameState, GenerationSettings, LayoutPhaseResult } from './types'
import { DEFAULT_SETTINGS } from './types'

export type {
  CellState,
  CellTruth,
  GameState,
  GameStatus,
  GenerationSettings,
  MapLayout,
  LayoutPhaseResult,
} from './types'

export { DEFAULT_SETTINGS, randomSeed, normalizeSettings, estimatePlayableCells, getMineTargetFromActiveCells }
export { revealCell, toggleFlag, chordReveal, applyRightClick, checkWin }
export { getNeighbors } from './grid'

interface BuildGameArgs {
  phase: LayoutPhaseResult
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

function assignStartCell(phase: LayoutPhaseResult, seed: number): LayoutPhaseResult {
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

export function generateLayoutOnly(settings: GenerationSettings, seed: number): { phase: LayoutPhaseResult; game: GameState } {
  const normalized = normalizeSettings(settings)
  const phase = generateLayoutPhase(normalized, seed)
  const truth = createTruthBoard(phase.rows, phase.cols, new Set<number>(), phase.activeMask)
  const game = buildGameState({
    phase,
    truth,
    mineCount: 0,
    seed,
    report: {
      layoutSeed: seed,
      mineSeed: seed,
      activeCells: phase.activeIndices.length,
      targetMines: 0,
      acceptedTargetMines: 0,
      generatedMines: 0,
      attemptsUsed: 0,
      attemptBudget: 0,
      noGuessSolvePassed: true,
      note: 'Layout generated. No mines placed yet.',
    },
  })
  return { phase, game }
}

export function generateMinesForLayout(
  settings: GenerationSettings,
  phase: LayoutPhaseResult,
  layoutSeed: number,
  seed: number,
): GameState {
  const phaseWithStart = assignStartCell(phase, seed ^ layoutSeed)
  const normalized = normalizeSettings(settings)
  const requestedTargetMineCount = clamp(
    getMineTargetFromActiveCells(phaseWithStart.activeIndices.length),
    1,
    Math.max(1, phaseWithStart.activeIndices.length - 1),
  )
  const minimumTargetMineCount = Math.max(1, Math.floor(requestedTargetMineCount * 0.45))
  const maxAttemptsPerTarget = 16

  let bestMineSet = new Set<number>()
  let bestTruth = createTruthBoard(phaseWithStart.rows, phaseWithStart.cols, bestMineSet, phaseWithStart.activeMask)
  let bestDeterministic = false
  let bestTarget = requestedTargetMineCount
  let attempts = 0

  for (let target = requestedTargetMineCount; target >= minimumTargetMineCount; target -= 1) {
    for (let attempt = 0; attempt < maxAttemptsPerTarget; attempt += 1) {
      const attemptSeed = seed + target * 104729 + attempt * 9187
      const candidateMineSet = generateMinesFromCA(normalized, phaseWithStart, target, attemptSeed)
      const candidateTruth = createTruthBoard(
        phaseWithStart.rows,
        phaseWithStart.cols,
        candidateMineSet,
        phaseWithStart.activeMask,
      )
      const deterministic = deterministicSolveFromStarts(
        candidateTruth,
        phaseWithStart.rows,
        phaseWithStart.cols,
        new Set([phaseWithStart.startIndex]),
      )
      attempts += 1

      if (candidateMineSet.size > bestMineSet.size) {
        bestMineSet = candidateMineSet
        bestTruth = candidateTruth
        bestDeterministic = deterministic
        bestTarget = target
      }

      if (deterministic) {
        bestMineSet = candidateMineSet
        bestTruth = candidateTruth
        bestDeterministic = true
        bestTarget = target
        break
      }
    }
    if (bestDeterministic) break
  }

  return buildGameState({
    phase: phaseWithStart,
    truth: bestTruth,
    mineCount: bestMineSet.size,
    seed,
    report: {
      layoutSeed,
      mineSeed: seed,
      activeCells: phase.activeIndices.length,
      targetMines: requestedTargetMineCount,
      acceptedTargetMines: bestTarget,
      generatedMines: bestMineSet.size,
      attemptsUsed: attempts,
      attemptBudget: (requestedTargetMineCount - minimumTargetMineCount + 1) * maxAttemptsPerTarget,
      noGuessSolvePassed: bestDeterministic,
      note: bestDeterministic
        ? `Mines generated after ${attempts} attempt${attempts === 1 ? '' : 's'} (target ${bestTarget}).`
        : `No guess-free layout found in ${attempts} attempts. Try Generate Mines again.`,
    },
  })
}

export function makeGame(settings: GenerationSettings, seed: number): GameState {
  const { phase } = generateLayoutOnly(settings, seed)
  return generateMinesForLayout(settings, phase, seed, seed + 4099)
}
