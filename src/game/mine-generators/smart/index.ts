import { getNeighbors } from '../../grid'
import type { GenerationSettings, LayoutPhaseResult } from '../../types'
import type { MineGenerator, SmartMineSession } from '../types'
import {
  buildCandidateIndicesFromAssigned,
  buildHintAttemptOrder,
  buildPickSeed,
  canAcceptMine,
  pickCandidate,
  pickCandidates,
} from './utilities'
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
  const candidateIndices = buildCandidateIndicesFromAssigned(phase, assignedSet)

  return {
    system: 'smart',
    startIndex,
    assignedSet,
    hintAssignments,
    candidateIndices,
    currentTargetIndex: -1,
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
      currentTargetIndex: -1,
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
  const assignResolvedNeighborMines = (
    assignedSet: Set<number>,
    mineSet: Set<number>,
  ): number[] => {
    const autoAssigned: number[] = []
    let changed = true
    while (changed) {
      changed = false
      const frontier = buildCandidateIndicesFromAssigned(phase, assignedSet)
      for (const candidateIndex of frontier) {
        if (!mineSet.has(candidateIndex) || assignedSet.has(candidateIndex)) continue
        const candidateNeighbors = getNeighbors(candidateIndex, phase.rows, phase.cols).filter(
          (index) => phase.activeMask[index],
        )
        if (!candidateNeighbors.every((index) => assignedSet.has(index))) continue
        assignedSet.add(candidateIndex)
        autoAssigned.push(candidateIndex)
        changed = true
      }
    }
    return autoAssigned
  }

  // 4) Try hint values in deterministic order, rolling back failed attempts.
  const maxHint = Math.min(6, Math.max(0, unassignedTargetNeighbors.length))
  const hintAttemptOrder = buildHintAttemptOrder(pickSeed, targetIndex, maxHint)
  const attemptLines: string[] = []
  let acceptedHintValue = -1
  let acceptedMineSet: Set<number> | null = null
  let addedMinesForAcceptedAttempt: number[] = []

  for (const hintValue of hintAttemptOrder) {
    const attemptMineSet = new Set(session.mineSet)
    const existingMinedNeighborCount = targetNeighbors.filter((index) => attemptMineSet.has(index)).length
    if (existingMinedNeighborCount > hintValue) {
      attemptLines.push(
        `  - hint ${hintValue}: invalid (already has ${existingMinedNeighborCount} mined neighbors)`,
      )
      continue
    }

    const minesNeeded = hintValue - existingMinedNeighborCount
    const eligibleMineNeighbors = unassignedTargetNeighbors.filter(
      (index) =>
        !attemptMineSet.has(index) &&
        canAcceptMine(index, phase, session.assignedSet, session.hintAssignments, attemptMineSet),
    )
    if (eligibleMineNeighbors.length < minesNeeded) {
      attemptLines.push(
        `  - hint ${hintValue}: invalid (needs ${minesNeeded}, only ${eligibleMineNeighbors.length} eligible)`,
      )
      continue
    }

    const orderedMineCandidates = pickCandidates(
      eligibleMineNeighbors,
      pickSeed ^ targetIndex ^ hintValue,
      eligibleMineNeighbors.length,
      [],
    )
    const pickedMineNeighbors: number[] = []
    for (const candidate of orderedMineCandidates) {
      if (pickedMineNeighbors.length >= minesNeeded) break
      if (!canAcceptMine(candidate, phase, session.assignedSet, session.hintAssignments, attemptMineSet)) continue
      attemptMineSet.add(candidate)
      pickedMineNeighbors.push(candidate)
    }
    if (pickedMineNeighbors.length < minesNeeded) {
      attemptLines.push(
        `  - hint ${hintValue}: invalid (picked ${pickedMineNeighbors.length}/${minesNeeded} mines)`,
      )
      continue
    }

    const finalMinedNeighborCount = targetNeighbors.filter((index) => attemptMineSet.has(index)).length
    if (finalMinedNeighborCount !== hintValue) {
      attemptLines.push(
        `  - hint ${hintValue}: invalid (final mined neighbors ${finalMinedNeighborCount})`,
      )
      continue
    }

    attemptLines.push(
      `  - hint ${hintValue}: valid (addedMines=[${pickedMineNeighbors.join(', ')}], minedNeighbors=${finalMinedNeighborCount})`,
    )

    acceptedHintValue = hintValue
    acceptedMineSet = attemptMineSet
    addedMinesForAcceptedAttempt = pickedMineNeighbors
    break
  }

  // 5) Apply only a valid attempt; otherwise keep mine/hint state unchanged.
  if (acceptedHintValue >= 0 && acceptedMineSet !== null) {
    const assignedSet = new Set(session.assignedSet)
    assignedSet.add(targetIndex)
    const autoAssignedMines = assignResolvedNeighborMines(assignedSet, acceptedMineSet)
    const candidateIndices = buildCandidateIndicesFromAssigned(phase, assignedSet)
    const hintAssignments = new Map(session.hintAssignments)
    hintAssignments.set(targetIndex, acceptedHintValue)
    const message = [
      `step ${nextStepCount}: target ${targetIndex}`,
      `  setup: candidates=[${candidates.join(', ')}], unassignedNeighbors=[${unassignedTargetNeighbors.join(', ')}], hintOrder=[${hintAttemptOrder.join(', ')}]`,
      ...attemptLines,
      `  result: valid=true, acceptedHint=${acceptedHintValue}, addedMines=[${addedMinesForAcceptedAttempt.join(', ')}], autoAssigned=[${autoAssignedMines.join(', ')}]`,
    ].join('\n')
    return {
      ...session,
      assignedSet,
      candidateIndices,
      currentTargetIndex: targetIndex,
      mineSet: acceptedMineSet,
      hintAssignments,
      messages: [...session.messages, message],
      stepCount: nextStepCount,
      done: session.done,
      lastAction: `tx step ${nextStepCount}: target ${targetIndex} accepted hint ${acceptedHintValue}`,
    }
  }

  // 6) No valid hint assignment found for this target in this step.
  const invalidMessage = [
    `step ${nextStepCount}: target ${targetIndex}`,
    `  setup: candidates=[${candidates.join(', ')}], unassignedNeighbors=[${unassignedTargetNeighbors.join(', ')}], hintOrder=[${hintAttemptOrder.join(', ')}]`,
    ...attemptLines,
    '  result: valid=false, no accepted hint',
  ].join('\n')
  const candidateIndices = buildCandidateIndicesFromAssigned(phase, session.assignedSet)
  return {
    ...session,
    candidateIndices,
    currentTargetIndex: targetIndex,
    messages: [...session.messages, invalidMessage],
    stepCount: nextStepCount,
    done: session.done,
    lastAction: `tx step ${nextStepCount}: no valid hint for target ${targetIndex}`,
  }
}

export const smartMineGenerator: MineGenerator<SmartMineSession> = {
  initialize,
  step,
}
