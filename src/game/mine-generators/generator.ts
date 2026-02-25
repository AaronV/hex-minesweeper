import { getNeighbors, hashUnit } from '../grid'
import { countMinesInCells, getAxisConstraintCells, getConstraintCellsForHintSpec, selectAxisPair } from '../hint-constraints'
import { deterministicSolveFromStarts } from '../solver'
import { createTruthBoard } from '../truth'
import type {
  AssignedHintSpec,
  AxisPair,
  GenerationSettings,
  HintType,
  LayoutPhaseResult,
  MineGenerationSession,
} from '../types'
import type { MineGenerator } from './types'
import {
  buildCandidateIndicesFromAssigned,
  buildHintAttemptOrder,
  buildPickSeed,
  canAcceptMine,
  hasForcedNextMove,
  pickCandidates,
} from './utilities'
import { selectStartIndexRandom } from './shared'

const AXIS_HINT_RATIO = 0.15

function selectHintKind(seed: number, index: number, startIndex: number): HintType {
  if (index === startIndex) return 'adjacent'
  return hashUnit(seed ^ 0x6f42b513, index, 5, 101) < AXIS_HINT_RATIO ? 'axisPairLine' : 'adjacent'
}

function chooseAxisPairForTarget(
  seed: number,
  targetIndex: number,
  phase: LayoutPhaseResult,
  hintAssignments: Map<number, AssignedHintSpec>,
): AxisPair | null {
  const order: AxisPair[] = [0, 1, 2].sort((a, b) => {
    const ah = hashUnit(seed ^ 0x2f6e2b1d, targetIndex, a, phase.activeIndices.length)
    const bh = hashUnit(seed ^ 0x2f6e2b1d, targetIndex, b, phase.activeIndices.length)
    if (ah !== bh) return ah - bh
    return a - b
  }) as AxisPair[]
  const preferred = selectAxisPair(seed, targetIndex)
  const preferredFirst = [preferred, ...order.filter((axis) => axis !== preferred)] as AxisPair[]

  for (const candidateAxis of preferredFirst) {
    const candidateLine = getAxisConstraintCells(
      targetIndex,
      candidateAxis,
      phase.rows,
      phase.cols,
      phase.activeMask,
    )
    let conflict = false
    for (const [assignedIndex, assignedSpec] of hintAssignments) {
      if (assignedSpec.kind !== 'axisPairLine') continue
      if ((assignedSpec.axisPair ?? 0) !== candidateAxis) continue
      const assignedLine = getAxisConstraintCells(
        assignedIndex,
        assignedSpec.axisPair ?? 0,
        phase.rows,
        phase.cols,
        phase.activeMask,
      )
      if (assignedLine.includes(targetIndex) || candidateLine.includes(assignedIndex)) {
        conflict = true
        break
      }
    }
    if (!conflict) return candidateAxis
  }
  return null
}

function buildHintSpecForKind(
  kind: HintType,
  seed: number,
  index: number,
  value: number,
  axisPair: AxisPair | null = null,
): AssignedHintSpec {
  if (kind === 'axisPairLine') {
    return { kind, value, axisPair: axisPair ?? selectAxisPair(seed, index) }
  }
  return { kind, value }
}

function applyHintAssignmentsToTruth(
  truth: ReturnType<typeof createTruthBoard>,
  hintAssignments: Map<number, AssignedHintSpec>,
): void {
  for (const [index, spec] of hintAssignments) {
    if (!truth[index]?.active || truth[index].mine) continue
    truth[index].hintKind = spec.kind
    truth[index].axisPair = spec.kind === 'axisPairLine' ? (spec.axisPair ?? 0) : null
    if (spec.kind === 'axisPairLine') {
      truth[index].hints.axisPairLine = spec.value
    } else {
      truth[index].adjacentMines = spec.value
      truth[index].hints.adjacent = spec.value
    }
  }
}

/**
 * Creates the initial generation session for a layout.
 *
 * Why this exists:
 * - The UI and game engine need a stable, serializable session object before any steps run.
 * - It chooses the deterministic start cell for the seed and applies the generator's first invariant:
 *   start cell is assigned with adjacent hint value 0.
 * - It separates one-time setup from step execution so "Next Mine Step" can be called repeatedly
 *   without re-initializing state.
 */
export function initialize(
  phase: LayoutPhaseResult,
  seed: number,
): MineGenerationSession {
  const startIndex = selectStartIndexRandom(phase, seed ^ 0x9e3779b9)
  const assignedSet = new Set<number>(startIndex >= 0 ? [startIndex] : [])
  const hintAssignments = new Map<number, AssignedHintSpec>()
  if (startIndex >= 0) hintAssignments.set(startIndex, { kind: 'adjacent', value: 0 })
  const candidateIndices = buildCandidateIndicesFromAssigned(phase, assignedSet)

  return {
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
 * Applies exactly one generation transaction step and returns the next session.
 *
 * Why this exists:
 * - The outside caller should not know generator internals; it only asks for "next step".
 * - This function is the single place where step-by-step logic evolves over time.
 * - Returning a new session (instead of mutating external state) keeps stepping predictable,
 *   easier to debug, and compatible with auto-step replay.
 */
export function step(
  settings: GenerationSettings,
  phase: LayoutPhaseResult,
  targetMineCount: number,
  session: MineGenerationSession,
): MineGenerationSession {
  const passesDeterministicSnapshot = (
    mineSet: Set<number>,
    hintAssignments: Map<number, AssignedHintSpec>,
  ): boolean => {
    if (session.startIndex < 0) return true

    const truth = createTruthBoard(phase.rows, phase.cols, mineSet, phase.activeMask)
    applyHintAssignmentsToTruth(truth, hintAssignments)

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
  let acceptedHintSpec: AssignedHintSpec | null = null
  let acceptedMineSet: Set<number> | null = null
  let acceptedHintAttemptOrder: number[] = []
  let acceptedUnassignedTargetScope: number[] = []
  let addedMinesForAcceptedAttempt: number[] = []

  for (const targetIndex of targetAttemptOrder) {
    const preferredHintKind = selectHintKind(session.seed, targetIndex, session.startIndex)
    const hintKindAttemptOrder: HintType[] =
      preferredHintKind === 'axisPairLine' ? ['axisPairLine', 'adjacent'] : ['adjacent']

    for (const targetHintKind of hintKindAttemptOrder) {
      let axisPairForAttempt: AxisPair | null = null
      if (targetHintKind === 'axisPairLine') {
        axisPairForAttempt = chooseAxisPairForTarget(session.seed, targetIndex, phase, session.hintAssignments)
        if (axisPairForAttempt === null) {
          attemptLines.push(`  target ${targetIndex} (axisPairLine): invalid (no non-overlapping axis available)`)
          continue
        }
      }
      const targetHintSpec = buildHintSpecForKind(
        targetHintKind,
        session.seed,
        targetIndex,
        0,
        axisPairForAttempt,
      )
      const targetScope = getConstraintCellsForHintSpec(
        targetIndex,
        targetHintSpec,
        phase.rows,
        phase.cols,
        phase.activeMask,
      )
      const unassignedTargetScope = targetScope.filter((index) => !session.assignedSet.has(index))
      const existingMinedScopeCount = countMinesInCells(targetScope, session.mineSet)
      const eligibleMineScopeCount = unassignedTargetScope.filter(
        (index) =>
          !session.mineSet.has(index) &&
          canAcceptMine(index, phase, session.assignedSet, session.hintAssignments, session.mineSet),
      ).length
      const minHint = Math.max(0, existingMinedScopeCount)
      const maxHint = Math.max(0, existingMinedScopeCount + eligibleMineScopeCount)
      const hintAttemptOrder = buildHintAttemptOrder(pickSeed ^ nextStepCount, targetIndex, minHint, maxHint)
      attemptLines.push(
        `  target ${targetIndex} (${targetHintKind}): unassignedScope=[${unassignedTargetScope.join(', ')}], hintOrder=[${hintAttemptOrder.join(', ')}]`,
      )

      // Attempt each hint in deterministic order. Each attempt is isolated:
      // failed attempts are rolled back by discarding the temporary mine set.
      for (const hintValue of hintAttemptOrder) {
        const attemptMineSet = new Set(session.mineSet)
        const currentMinedScopeCount = countMinesInCells(targetScope, attemptMineSet)
        if (currentMinedScopeCount > hintValue) {
          attemptLines.push(
            `    - hint ${hintValue}: invalid (already has ${currentMinedScopeCount} mined in scope)`,
          )
          continue
        }

        const minesNeeded = hintValue - currentMinedScopeCount
        const eligibleMineScope = unassignedTargetScope.filter(
          (index) =>
            !attemptMineSet.has(index) &&
            canAcceptMine(index, phase, session.assignedSet, session.hintAssignments, attemptMineSet),
        )
        if (eligibleMineScope.length < minesNeeded) {
          attemptLines.push(
            `    - hint ${hintValue}: invalid (needs ${minesNeeded}, only ${eligibleMineScope.length} eligible)`,
          )
          continue
        }

        const orderedMineCandidates = pickCandidates(
          eligibleMineScope,
          pickSeed ^ targetIndex ^ hintValue,
          eligibleMineScope.length,
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

        const finalMinedScopeCount = countMinesInCells(targetScope, attemptMineSet)
        if (finalMinedScopeCount !== hintValue) {
          attemptLines.push(
            `    - hint ${hintValue}: invalid (final mined in scope ${finalMinedScopeCount})`,
          )
          continue
        }

        const tentativeAssignedSet = new Set(session.assignedSet)
        tentativeAssignedSet.add(targetIndex)
        const tentativeHintAssignments = new Map(session.hintAssignments)
        tentativeHintAssignments.set(
          targetIndex,
          buildHintSpecForKind(targetHintKind, session.seed, targetIndex, hintValue, axisPairForAttempt),
        )
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
          `    - hint ${hintValue}: valid (addedMines=[${pickedMineNeighbors.join(', ')}], minedInScope=${finalMinedScopeCount})`,
        )

        acceptedTargetIndex = targetIndex
        acceptedHintSpec = buildHintSpecForKind(targetHintKind, session.seed, targetIndex, hintValue, axisPairForAttempt)
        acceptedMineSet = attemptMineSet
        acceptedHintAttemptOrder = hintAttemptOrder
        acceptedUnassignedTargetScope = unassignedTargetScope
        addedMinesForAcceptedAttempt = pickedMineNeighbors
        break
      }

      if (acceptedMineSet !== null) break
    }

    if (acceptedMineSet !== null) break
  }

  // 5) Apply only a valid attempt; otherwise keep mine/hint state unchanged.
  if (acceptedTargetIndex >= 0 && acceptedHintSpec !== null && acceptedMineSet !== null) {
    const assignedSet = new Set(session.assignedSet)
    assignedSet.add(acceptedTargetIndex)
    const autoAssignedMines = assignResolvedNeighborMines(assignedSet, acceptedMineSet)
    const candidateIndices = buildCandidateIndicesFromAssigned(phase, assignedSet)
    const hintAssignments = new Map(session.hintAssignments)
    hintAssignments.set(acceptedTargetIndex, acceptedHintSpec)
    const message = [
      `step ${nextStepCount}: target ${acceptedTargetIndex}`,
      `  accepted: unassignedScope=[${acceptedUnassignedTargetScope.join(', ')}], hintOrder=[${acceptedHintAttemptOrder.join(', ')}]`,
      ...attemptLines,
      `  result: valid=true, acceptedHint=${acceptedHintSpec.value} (${acceptedHintSpec.kind}), addedMines=[${addedMinesForAcceptedAttempt.join(', ')}], autoAssigned=[${autoAssignedMines.join(', ')}]`,
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
      lastAction: `tx step ${nextStepCount}: target ${acceptedTargetIndex} accepted hint ${acceptedHintSpec.value} (${acceptedHintSpec.kind})`,
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

export const generator: MineGenerator = {
  initialize,
  step,
}
