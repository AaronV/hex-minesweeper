import { clamp, randomSeed } from './grid'
import {
  advancePrototypeMineSession,
  generateMinesPrototypeNoop,
  generateMinesWeighted,
  initializePrototypeMineSession,
  type MineGenerationCandidate,
  type PrototypeMineSession,
} from './mines'
import { normalizeSettings, estimatePlayableCells, getMineTargetFromActiveCells } from './settings'
import { generateLayoutPhase } from './layout'
import { deterministicSolveFromStarts } from './solver'
import { createTruthBoard } from './truth'
import { applyRightClick, chordReveal, revealCell, toggleFlag } from './transitions'
import { checkWin } from './truth'
import type {
  CellState,
  CellTruth,
  GameState,
  GenerationSettings,
  HintType,
  LayoutPhaseResult,
  MineGenerationSystem,
} from './types'
import { DEFAULT_SETTINGS } from './types'

export type {
  CellState,
  CellTruth,
  GameState,
  GameStatus,
  GenerationSettings,
  HintType,
  MapLayout,
  LayoutPhaseResult,
  MineGenerationSystem,
} from './types'

export { DEFAULT_SETTINGS, randomSeed, normalizeSettings, estimatePlayableCells, getMineTargetFromActiveCells }
export { revealCell, toggleFlag, chordReveal, applyRightClick, checkWin }
export { getNeighbors } from './grid'
export type { PrototypeMineSession } from './mines'

function generateMineSetBySystem(
  system: MineGenerationSystem,
  settings: GenerationSettings,
  phase: LayoutPhaseResult,
  target: number,
  seed: number,
): MineGenerationCandidate {
  if (system === 'prototypeNoop') {
    return generateMinesPrototypeNoop(settings, phase, target, seed)
  }
  return generateMinesWeighted(settings, phase, target, seed)
}

interface BuildGameArgs {
  phase: LayoutPhaseResult
  truth: CellTruth[]
  hintType: HintType
  assignedSet?: Set<number>
  mineCount: number
  seed: number
  report: GameState['generationReport']
}

function buildGameState({ phase, truth, hintType, assignedSet, mineCount, seed, report }: BuildGameArgs): GameState {
  const { rows, cols, activeIndices, startIndex } = phase
  const cells: CellState[] = truth.map((cell, index) => ({
    ...cell,
    revealed: false,
    flagged: false,
    start: cell.active && startIndex >= 0 ? index === startIndex : false,
    assigned: assignedSet?.has(index) ?? false,
    exploded: false,
  }))

  return {
    cols,
    rows,
    hintType,
    mineCount,
    safeStartCount: startIndex >= 0 ? 1 : 0,
    activeCellCount: activeIndices.length,
    seed,
    status: 'playing',
    cells,
    generationReport: report,
  }
}

export function generateLayoutOnly(settings: GenerationSettings, seed: number): { phase: LayoutPhaseResult; game: GameState } {
  const normalized = normalizeSettings(settings)
  const phase = generateLayoutPhase(normalized, seed)
  const truth = createTruthBoard(phase.rows, phase.cols, new Set<number>(), phase.activeMask)
  const game = buildGameState({
    phase,
    truth,
    hintType: normalized.hintType,
    assignedSet: new Set<number>(),
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
  const normalized = normalizeSettings(settings)
  const requestedTargetMineCount = clamp(
    getMineTargetFromActiveCells(phase.activeIndices.length),
    1,
    Math.max(1, phase.activeIndices.length - 1),
  )
  const minimumTargetMineCount = Math.max(1, Math.floor(requestedTargetMineCount * 0.45))
  const maxAttemptsPerTarget = 16

  let bestPhase: LayoutPhaseResult = { ...phase, startIndex: -1 }
  let bestMineSet = new Set<number>()
  let bestTruth = createTruthBoard(phase.rows, phase.cols, bestMineSet, phase.activeMask)
  let bestDeterministic = false
  let bestTarget = requestedTargetMineCount
  let attempts = 0

  for (let target = requestedTargetMineCount; target >= minimumTargetMineCount; target -= 1) {
    for (let attempt = 0; attempt < maxAttemptsPerTarget; attempt += 1) {
      const attemptSeed = seed + target * 104729 + attempt * 9187
      const candidate = generateMineSetBySystem(
        normalized.mineGenerationSystem,
        normalized,
        phase,
        target,
        attemptSeed,
      )
      const candidatePhase: LayoutPhaseResult = { ...phase, startIndex: candidate.startIndex }
      const candidateTruth = createTruthBoard(
        candidatePhase.rows,
        candidatePhase.cols,
        candidate.mineSet,
        candidatePhase.activeMask,
      )
      const deterministic = deterministicSolveFromStarts(
        candidateTruth,
        candidatePhase.rows,
        candidatePhase.cols,
        new Set([candidatePhase.startIndex]),
        normalized.hintType,
      )
      attempts += 1

      if (candidate.mineSet.size > bestMineSet.size) {
        bestPhase = candidatePhase
        bestMineSet = candidate.mineSet
        bestTruth = candidateTruth
        bestDeterministic = deterministic
        bestTarget = target
      }

      if (deterministic) {
        bestPhase = candidatePhase
        bestMineSet = candidate.mineSet
        bestTruth = candidateTruth
        bestDeterministic = true
        bestTarget = target
        break
      }
    }
    if (bestDeterministic) break
  }

  return buildGameState({
    phase: bestPhase,
    truth: bestTruth,
    hintType: normalized.hintType,
    assignedSet: new Set<number>(),
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
        ? `${normalized.mineGenerationSystem} system generated mines after ${attempts} attempt${attempts === 1 ? '' : 's'} (target ${bestTarget}).`
        : `${normalized.mineGenerationSystem} system found no guess-free layout in ${attempts} attempts. Try Generate Mines again.`,
    },
  })
}

export function advancePrototypeMineGeneration(
  settings: GenerationSettings,
  phase: LayoutPhaseResult,
  layoutSeed: number,
  previousSession: PrototypeMineSession | null,
  seed: number,
): { session: PrototypeMineSession; game: GameState } {
  const normalized = normalizeSettings(settings)
  const requestedTargetMineCount = clamp(
    getMineTargetFromActiveCells(phase.activeIndices.length),
    1,
    Math.max(1, phase.activeIndices.length - 1),
  )

  const initialized = previousSession ?? initializePrototypeMineSession(phase, layoutSeed)
  const session = advancePrototypeMineSession(initialized)
  const phaseWithStart: LayoutPhaseResult = { ...phase, startIndex: session.startIndex }
  const truth = createTruthBoard(phase.rows, phase.cols, new Set<number>(), phase.activeMask)
  const noGuessSolvePassed = deterministicSolveFromStarts(
    truth,
    phase.rows,
    phase.cols,
    new Set([session.startIndex]),
    normalized.hintType,
  )
  const game = buildGameState({
    phase: phaseWithStart,
    truth,
    hintType: normalized.hintType,
    assignedSet: session.assignedSet,
    mineCount: 0,
    seed,
    report: {
      layoutSeed,
      mineSeed: seed,
      activeCells: phase.activeIndices.length,
      targetMines: requestedTargetMineCount,
      acceptedTargetMines: requestedTargetMineCount,
      generatedMines: 0,
      attemptsUsed: session.stepCount,
      attemptBudget: requestedTargetMineCount,
      noGuessSolvePassed,
      note: `prototypeNoop step ${session.stepCount}: start cell assigned and locked (no mine placement yet).`,
    },
  })

  return { session, game }
}

export function makeGame(settings: GenerationSettings, seed: number): GameState {
  const { phase } = generateLayoutOnly(settings, seed)
  return generateMinesForLayout(settings, phase, seed, seed + 4099)
}
