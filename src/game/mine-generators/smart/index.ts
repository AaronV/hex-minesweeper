import { getNeighbors } from '../../grid'
import { deterministicSolveFromStarts } from '../../solver'
import { createTruthBoard } from '../../truth'
import type { GenerationSettings, LayoutPhaseResult } from '../../types'
import type { MineGenerator, SmartMineSession } from '../types'
import {
  buildCandidateIndicesFromAssigned,
  buildHintAttemptOrder,
  buildPickSeed,
  canAcceptMine,
  hasForcedNextMove,
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
  const passesDeterministicSnapshot = (
    mineSet: Set<number>,
    hintAssignments: Map<number, number>,
  ): boolean => {
    if (settings.hintType !== 'adjacent' || session.startIndex < 0) return true

    const truth = createTruthBoard(phase.rows, phase.cols, mineSet, phase.activeMask)
    for (const [index, hintValue] of hintAssignments) {
      if (!truth[index]?.active || truth[index].mine) continue
      truth[index].adjacentMines = hintValue
      truth[index].hints.adjacent = hintValue
    }

    return deterministicSolveFromStarts(
      truth,
      phase.rows,
      phase.cols,
      new Set([session.startIndex]),
      settings.hintType,
    )
  }

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
    const done = session.assignedSet.size >= phase.activeIndices.length
    return {
      ...session,
      currentTargetIndex: -1,
      messages: [...session.messages, `step ${nextStepCount}: no candidate cells available`],
      stepCount: nextStepCount,
      done,
      lastAction: `tx step ${nextStepCount}: no candidate cells`,
    }
  }

  // 3) Select target cells in deterministic order and accept the first valid transaction.
  const targetAttemptOrder = pickCandidates(candidates, pickSeed ^ nextStepCount, candidates.length, [])
  // Helper for post-commit cleanup: if a mine cell's neighbors are all assigned,
  // that mine can be safely marked assigned as well.
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

  const attemptLines: string[] = [`  setup: candidates=[${candidates.join(', ')}], targetOrder=[${targetAttemptOrder.join(', ')}]`]
  let acceptedTargetIndex = -1
  let acceptedHintValue = -1
  let acceptedMineSet: Set<number> | null = null
  let acceptedHintAttemptOrder: number[] = []
  let acceptedUnassignedTargetNeighbors: number[] = []
  let addedMinesForAcceptedAttempt: number[] = []

  for (const targetIndex of targetAttemptOrder) {
    const targetNeighbors = getNeighbors(targetIndex, phase.rows, phase.cols).filter((index) => phase.activeMask[index])
    const unassignedTargetNeighbors = targetNeighbors.filter((index) => !session.assignedSet.has(index))
    const existingMinedNeighborCount = targetNeighbors.filter((index) => session.mineSet.has(index)).length
    const eligibleMineNeighborCount = unassignedTargetNeighbors.filter(
      (index) =>
        !session.mineSet.has(index) &&
        canAcceptMine(index, phase, session.assignedSet, session.hintAssignments, session.mineSet),
    ).length
    const minHint = Math.min(6, Math.max(0, existingMinedNeighborCount))
    const maxHint = Math.min(6, Math.max(0, existingMinedNeighborCount + eligibleMineNeighborCount))
    const hintAttemptOrder = buildHintAttemptOrder(pickSeed ^ nextStepCount, targetIndex, minHint, maxHint)
    attemptLines.push(
      `  target ${targetIndex}: unassignedNeighbors=[${unassignedTargetNeighbors.join(', ')}], hintOrder=[${hintAttemptOrder.join(', ')}]`,
    )

    // Attempt each hint in deterministic order. Each attempt is isolated:
    // failed attempts are rolled back by discarding the temporary mine set.
    for (const hintValue of hintAttemptOrder) {
      const attemptMineSet = new Set(session.mineSet)
      const currentMinedNeighborCount = targetNeighbors.filter((index) => attemptMineSet.has(index)).length
      if (currentMinedNeighborCount > hintValue) {
        attemptLines.push(
          `    - hint ${hintValue}: invalid (already has ${currentMinedNeighborCount} mined neighbors)`,
        )
        continue
      }

      const minesNeeded = hintValue - currentMinedNeighborCount
      const eligibleMineNeighbors = unassignedTargetNeighbors.filter(
        (index) =>
          !attemptMineSet.has(index) &&
          canAcceptMine(index, phase, session.assignedSet, session.hintAssignments, attemptMineSet),
      )
      if (eligibleMineNeighbors.length < minesNeeded) {
        attemptLines.push(
          `    - hint ${hintValue}: invalid (needs ${minesNeeded}, only ${eligibleMineNeighbors.length} eligible)`,
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
          `    - hint ${hintValue}: invalid (picked ${pickedMineNeighbors.length}/${minesNeeded} mines)`,
        )
        continue
      }

      const finalMinedNeighborCount = targetNeighbors.filter((index) => attemptMineSet.has(index)).length
      if (finalMinedNeighborCount !== hintValue) {
        attemptLines.push(
          `    - hint ${hintValue}: invalid (final mined neighbors ${finalMinedNeighborCount})`,
        )
        continue
      }

      const tentativeAssignedSet = new Set(session.assignedSet)
      tentativeAssignedSet.add(targetIndex)
      const tentativeHintAssignments = new Map(session.hintAssignments)
      tentativeHintAssignments.set(targetIndex, hintValue)
      const completesBoard = tentativeAssignedSet.size >= phase.activeIndices.length
      if (
        !completesBoard &&
        !hasForcedNextMove(phase, tentativeAssignedSet, tentativeHintAssignments, attemptMineSet)
      ) {
        attemptLines.push(
          `    - hint ${hintValue}: invalid (would leave no forced next move)`,
        )
        continue
      }

      if (!passesDeterministicSnapshot(attemptMineSet, tentativeHintAssignments)) {
        attemptLines.push(
          `    - hint ${hintValue}: invalid (deterministic solve would fail)`,
        )
        continue
      }

      attemptLines.push(
        `    - hint ${hintValue}: valid (addedMines=[${pickedMineNeighbors.join(', ')}], minedNeighbors=${finalMinedNeighborCount})`,
      )

      acceptedTargetIndex = targetIndex
      acceptedHintValue = hintValue
      acceptedMineSet = attemptMineSet
      acceptedHintAttemptOrder = hintAttemptOrder
      acceptedUnassignedTargetNeighbors = unassignedTargetNeighbors
      addedMinesForAcceptedAttempt = pickedMineNeighbors
      break
    }

    if (acceptedMineSet !== null) break
  }

  // 5) Apply only a valid attempt; otherwise keep mine/hint state unchanged.
  if (acceptedTargetIndex >= 0 && acceptedHintValue >= 0 && acceptedMineSet !== null) {
    const assignedSet = new Set(session.assignedSet)
    assignedSet.add(acceptedTargetIndex)
    const autoAssignedMines = assignResolvedNeighborMines(assignedSet, acceptedMineSet)
    const candidateIndices = buildCandidateIndicesFromAssigned(phase, assignedSet)
    const hintAssignments = new Map(session.hintAssignments)
    hintAssignments.set(acceptedTargetIndex, acceptedHintValue)
    const message = [
      `step ${nextStepCount}: target ${acceptedTargetIndex}`,
      `  accepted: unassignedNeighbors=[${acceptedUnassignedTargetNeighbors.join(', ')}], hintOrder=[${acceptedHintAttemptOrder.join(', ')}]`,
      ...attemptLines,
      `  result: valid=true, acceptedHint=${acceptedHintValue}, addedMines=[${addedMinesForAcceptedAttempt.join(', ')}], autoAssigned=[${autoAssignedMines.join(', ')}]`,
    ].join('\n')
    return {
      ...session,
      assignedSet,
      candidateIndices,
      currentTargetIndex: acceptedTargetIndex,
      mineSet: acceptedMineSet,
      hintAssignments,
      messages: [...session.messages, message],
      stepCount: nextStepCount,
      done: assignedSet.size >= phase.activeIndices.length,
      lastAction: `tx step ${nextStepCount}: target ${acceptedTargetIndex} accepted hint ${acceptedHintValue}`,
    }
  }

  // 6) No valid hint assignment found for any candidate in this step.
  const invalidMessage = [
    `step ${nextStepCount}: no valid target`,
    ...attemptLines,
    '  result: valid=false, no accepted hint',
  ].join('\n')
  const candidateIndices = buildCandidateIndicesFromAssigned(phase, session.assignedSet)
  return {
    ...session,
    candidateIndices,
    currentTargetIndex: -1,
    messages: [...session.messages, invalidMessage],
    stepCount: nextStepCount,
    done: session.assignedSet.size >= phase.activeIndices.length,
    lastAction: `tx step ${nextStepCount}: no valid hint across ${targetAttemptOrder.length} target(s)`,
  }
}

export const smartMineGenerator: MineGenerator<SmartMineSession> = {
  initialize,
  step,
}
