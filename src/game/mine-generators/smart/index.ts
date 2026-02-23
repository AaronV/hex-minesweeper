import { getNeighbors } from '../../grid'
import type { GenerationSettings, LayoutPhaseResult } from '../../types'
import type { MineGenerator, SmartMineSession } from '../types'
import { buildPickSeed, canAcceptMine, pickCandidate, pickCandidates, pickHintValue } from './utilities'
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
  // 1) Initialize step-scoped inputs used by the deterministic pickers.
  const nextStepCount = session.stepCount + 1
const candidates = session.candidateIndices
  const pickSeed = buildPickSeed(
    session.seed,
    phase.rows,
    phase.cols,
    targetMineCount,
    settings.propagation,
  )

  // 2) Guard clause: if no candidates are available, record and exit this step.
  if (candidates.length === 0) {
    return {
      ...session,
      messages: [...session.messages, `step ${nextStepCount}: no candidate cells available`],
      stepCount: nextStepCount,
      done: session.done,
      lastAction: `tx step ${nextStepCount}: no candidate cells`,
    }
  }

  // 3) Select one candidate target cell for this transaction tick.
  const targetIndex = pickCandidate(candidates, pickSeed, [])
  const targetNeighbors = getNeighbors(targetIndex, phase.rows, phase.cols).filter((index) => phase.activeMask[index])
  const unassignedTargetNeighbors = targetNeighbors.filter((index) => !session.assignedSet.has(index))

  // 4) Pick a hint attempt for the target and stage mine updates to satisfy it.
  const hintValue = pickHintValue(pickSeed, targetIndex, unassignedTargetNeighbors.length)
  const mineSet = new Set(session.mineSet)
  const existingMinedNeighborCount = targetNeighbors.filter((index) => mineSet.has(index)).length
  const minesNeeded = Math.max(0, hintValue - existingMinedNeighborCount)
  const eligibleMineNeighbors = unassignedTargetNeighbors.filter(
    (index) => !mineSet.has(index) && canAcceptMine(index, phase, session.assignedSet, session.hintAssignments, mineSet),
  )
  const pickedMineNeighbors = pickCandidates(eligibleMineNeighbors, pickSeed ^ targetIndex, minesNeeded, [])
  for (const mineIndex of pickedMineNeighbors) mineSet.add(mineIndex)
  const finalMinedNeighborCount = targetNeighbors.filter((index) => mineSet.has(index)).length
  const hintSatisfied = finalMinedNeighborCount === hintValue

  // 5) Record the attempted hint assignment for downstream validation/visualization.
  const hintAssignments = new Map(session.hintAssignments)
  hintAssignments.set(targetIndex, hintValue)

  // 6) Emit step telemetry and return the next immutable session snapshot.
  const message =
    `step ${nextStepCount}: target=${targetIndex}, hint=${hintValue}, minedNeighbors=${finalMinedNeighborCount}` +
    `, addedMines=[${pickedMineNeighbors.join(', ')}], valid=${hintSatisfied}`

  return {
    ...session,
    mineSet,
    hintAssignments,
    messages: [...session.messages, message],
    stepCount: nextStepCount,
    done: session.done,
    lastAction: `tx step ${nextStepCount}: target ${targetIndex} hint ${hintValue} valid=${hintSatisfied}`,
  }
}

export const smartMineGenerator: MineGenerator<SmartMineSession> = {
  initialize,
  step,
}
