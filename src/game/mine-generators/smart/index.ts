import { getNeighbors } from '../../grid'
import type { GenerationSettings, LayoutPhaseResult } from '../../types'
import type { MineGenerator, SmartMineSession } from '../types'
import { buildPickSeed, pickDeterministicCandidate } from './utilities'
import { selectStartIndexRandom } from '../shared'

/**
 * Creates the initial smart generation session for a layout.
 *
 * Why this exists:
 * - The UI and game engine need a stable, serializable session object before any steps run.
 * - It chooses the deterministic start cell for the seed and applies the smart generator's first invariant:
 *   start cell is assigned with adjacent hint value 0.
 * - It separates one-time setup from step execution so "Next Mine Step" can be called repeatedly
 *   without re-initializing state.
 */
export function initialize(
  phase: LayoutPhaseResult,
  seed: number,
): SmartMineSession {
  const startIndex = selectStartIndexRandom(phase, seed ^ 0x9e3779b9)
  const assignedSet = new Set<number>(startIndex >= 0 ? [startIndex] : [])
  const hintAssignments = new Map<number, number>()
  if (startIndex >= 0) hintAssignments.set(startIndex, 0)
    
  const candidateIndices =
    startIndex >= 0
      ? getNeighbors(startIndex, phase.rows, phase.cols).filter(
          (index) => phase.activeMask[index] && !assignedSet.has(index),
        )
      : []

  return {
    system: 'smart',
    startIndex,
    assignedSet,
    hintAssignments,
    candidateIndices,
    mineSet: new Set<number>(),
    messages: [],
    stepCount: 0,
    seed,
    done: startIndex < 0,
    lastAction: startIndex >= 0 ? `assigned start @ ${startIndex} with hint 0` : 'no active start available',
  }
}

/**
 * Applies exactly one smart transaction step and returns the next session.
 *
 * Why this exists:
 * - The outside caller should not know generator internals; it only asks for "next step".
 * - This function is the single place where step-by-step smart logic evolves over time.
 * - Returning a new session (instead of mutating external state) keeps stepping predictable,
 *   easier to debug, and compatible with auto-step replay.
 */
export function step(
  settings: GenerationSettings,
  phase: LayoutPhaseResult,
  targetMineCount: number,
  session: SmartMineSession,
): SmartMineSession {
  const nextStepCount = session.stepCount + 1
  const candidates = session.candidateIndices
  const pickSeed = buildPickSeed(
    session.seed,
    phase,
    targetMineCount,
    settings.propagation,
  )

  // If no candidates are available, return an empty message session
  if (candidates.length === 0) {
    return {
      ...session,
      messages: [...session.messages, `step ${nextStepCount}: no candidate cells available`],
      stepCount: nextStepCount,
      done: session.done,
      lastAction: `tx step ${nextStepCount}: no candidate cells`,
    }
  }

  // Get a target index to work on.
  const targetIndex = pickDeterministicCandidate(candidates, pickSeed, [])
  const message = `step ${nextStepCount}: target cell ${targetIndex} from candidates [${candidates.join(', ')}]`

  return {
    ...session,
    messages: [...session.messages, message],
    stepCount: nextStepCount,
    done: session.done,
    lastAction: `tx step ${nextStepCount}: selected target ${targetIndex} from ${candidates.length} candidates`,
  }
}

export const smartMineGenerator: MineGenerator<SmartMineSession> = {
  initialize,
  step,
}
