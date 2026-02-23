import { clamp, getNeighbors, hashUnit, mulberry32 } from './grid'
import { DEFAULT_MINE_PERCENT } from './settings'
import type { GenerationSettings, LayoutPhaseResult } from './types'

export interface MineGenerationCandidate {
  startIndex: number
  mineSet: Set<number>
}

export interface PrototypeMineSession {
  startIndex: number
  assignedSet: Set<number>
  hintAssignments: Map<number, number>
  mineSet: Set<number>
  stepCount: number
  seed: number
  lastAction: string
}

interface PrototypeConstraint {
  unknown: number[]
  remaining: number
}

interface PrototypeComponentSolveResult {
  forcedSafe: number[]
  forcedMine: number[]
  hasSolution: boolean
}

interface PrototypeInferenceResult {
  hasSolution: boolean
  forcedSafe: Set<number>
  forcedMine: Set<number>
  variableSet: Set<number>
}

interface PrototypeTransactionAttempt {
  assignedSet: Set<number>
  hintAssignments: Map<number, number>
  mineSet: Set<number>
  addedMineSet: Set<number>
  supportHintsAdded: number
  internalPasses: number
  selected: number
  candidateHint: number
}

const MAX_SOLUTIONS_PER_COMPONENT = 60000
const MAX_COMPONENT_VARIABLES = 22
const MAX_SUPPORT_HINTS_PER_TRANSACTION = 6

function weightedPickIndex(weights: number[], random: () => number): number {
  const total = weights.reduce((sum, value) => sum + value, 0)
  if (total <= 0) return Math.floor(random() * weights.length)
  let needle = random() * total
  for (let i = 0; i < weights.length; i += 1) {
    needle -= weights[i]
    if (needle <= 0) return i
  }
  return weights.length - 1
}

function selectStartIndexCenterBiased(phase: LayoutPhaseResult, seed: number): number {
  if (phase.activeIndices.length === 0) return -1
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
  return band[pickIndex] ?? ranked[0]
}

function selectStartIndexRandom(phase: LayoutPhaseResult, seed: number): number {
  if (phase.activeIndices.length === 0) return -1
  const pickIndex = Math.floor(hashUnit(seed, phase.rows, phase.cols, phase.activeIndices.length) * phase.activeIndices.length)
  return phase.activeIndices[pickIndex] ?? phase.activeIndices[0]
}

function sortBySeed(values: number[], seed: number, salt: number): number[] {
  return [...values].sort((a, b) => {
    const ha = hashUnit(seed, a, salt, values.length)
    const hb = hashUnit(seed, b, salt, values.length)
    if (ha !== hb) return ha - hb
    return a - b
  })
}

function getAdjacentMineCount(index: number, phase: LayoutPhaseResult, mineSet: Set<number>): number {
  let count = 0
  for (const neighbor of getNeighbors(index, phase.rows, phase.cols)) {
    if (phase.activeMask[neighbor] && mineSet.has(neighbor)) count += 1
  }
  return count
}

function isHintConsistentForAssigned(
  assigned: Map<number, number>,
  phase: LayoutPhaseResult,
  mineSet: Set<number>,
): boolean {
  for (const [index, value] of assigned) {
    if (getAdjacentMineCount(index, phase, mineSet) !== value) return false
  }
  return true
}

function collectPrototypeConstraints(
  phase: LayoutPhaseResult,
  assigned: Map<number, number>,
  assignedSet: Set<number>,
  mineSet: Set<number>,
): PrototypeConstraint[] | null {
  const constraints: PrototypeConstraint[] = []
  for (const [index, value] of assigned) {
    const neighbors = getNeighbors(index, phase.rows, phase.cols).filter((neighbor) => phase.activeMask[neighbor])
    const fixedMines = neighbors.filter((neighbor) => mineSet.has(neighbor)).length
    const unknown = neighbors.filter((neighbor) => !mineSet.has(neighbor) && !assignedSet.has(neighbor)).sort((a, b) => a - b)
    const remaining = value - fixedMines
    if (remaining < 0 || remaining > unknown.length) return null
    if (unknown.length === 0) {
      if (remaining !== 0) return null
      continue
    }
    constraints.push({ unknown, remaining })
  }
  return constraints
}

function splitPrototypeConstraintComponents(
  constraints: PrototypeConstraint[],
): Array<{ cells: number[]; constraints: number[] }> {
  const byCell = new Map<number, number[]>()
  for (let i = 0; i < constraints.length; i += 1) {
    for (const cell of constraints[i].unknown) {
      const list = byCell.get(cell)
      if (list) list.push(i)
      else byCell.set(cell, [i])
    }
  }

  const visitedCells = new Set<number>()
  const visitedConstraints = new Set<number>()
  const components: Array<{ cells: number[]; constraints: number[] }> = []

  for (const startCell of byCell.keys()) {
    if (visitedCells.has(startCell)) continue
    const queueCells = [startCell]
    const queueConstraints: number[] = []
    const componentCells: number[] = []
    const componentConstraintIndexes: number[] = []

    while (queueCells.length > 0 || queueConstraints.length > 0) {
      const cell = queueCells.shift()
      if (cell !== undefined) {
        if (visitedCells.has(cell)) continue
        visitedCells.add(cell)
        componentCells.push(cell)
        for (const constraintIndex of byCell.get(cell) ?? []) {
          if (!visitedConstraints.has(constraintIndex)) queueConstraints.push(constraintIndex)
        }
      }

      const constraintIndex = queueConstraints.shift()
      if (constraintIndex !== undefined) {
        if (visitedConstraints.has(constraintIndex)) continue
        visitedConstraints.add(constraintIndex)
        componentConstraintIndexes.push(constraintIndex)
        for (const nextCell of constraints[constraintIndex].unknown) {
          if (!visitedCells.has(nextCell)) queueCells.push(nextCell)
        }
      }
    }

    components.push({
      cells: componentCells.sort((a, b) => a - b),
      constraints: componentConstraintIndexes.sort((a, b) => a - b),
    })
  }

  return components
}

function solvePrototypeConstraintComponent(
  allConstraints: PrototypeConstraint[],
  componentCells: number[],
  componentConstraintIndexes: number[],
): PrototypeComponentSolveResult {
  const vars = componentCells
  const constraints = componentConstraintIndexes.map((index) => allConstraints[index])
  const assignment: Array<boolean | null> = new Array(vars.length).fill(null)
  const varIndex = new Map<number, number>()
  for (let i = 0; i < vars.length; i += 1) varIndex.set(vars[i], i)

  let solutionCount = 0
  const mineHits = new Array(vars.length).fill(0)

  const recurse = (position: number) => {
    if (solutionCount > MAX_SOLUTIONS_PER_COMPONENT) return

    for (const constraint of constraints) {
      let assignedMines = 0
      let unknownLeft = 0
      for (const cell of constraint.unknown) {
        const index = varIndex.get(cell)
        if (index === undefined) continue
        const value = assignment[index]
        if (value === null) unknownLeft += 1
        else if (value) assignedMines += 1
      }
      if (assignedMines > constraint.remaining) return
      if (assignedMines + unknownLeft < constraint.remaining) return
    }

    if (position >= vars.length) {
      for (const constraint of constraints) {
        let assignedMines = 0
        for (const cell of constraint.unknown) {
          const index = varIndex.get(cell)
          if (index !== undefined && assignment[index]) assignedMines += 1
        }
        if (assignedMines !== constraint.remaining) return
      }
      solutionCount += 1
      for (let i = 0; i < vars.length; i += 1) {
        if (assignment[i]) mineHits[i] += 1
      }
      return
    }

    assignment[position] = false
    recurse(position + 1)
    assignment[position] = true
    recurse(position + 1)
    assignment[position] = null
  }

  recurse(0)
  if (solutionCount === 0 || solutionCount > MAX_SOLUTIONS_PER_COMPONENT) {
    return { forcedSafe: [], forcedMine: [], hasSolution: false }
  }

  const forcedSafe: number[] = []
  const forcedMine: number[] = []
  for (let i = 0; i < vars.length; i += 1) {
    if (mineHits[i] === 0) forcedSafe.push(vars[i])
    else if (mineHits[i] === solutionCount) forcedMine.push(vars[i])
  }
  return { forcedSafe, forcedMine, hasSolution: true }
}

function inferForcedAssignments(
  phase: LayoutPhaseResult,
  assigned: Map<number, number>,
  assignedSet: Set<number>,
  mineSet: Set<number>,
): PrototypeInferenceResult {
  const constraints = collectPrototypeConstraints(phase, assigned, assignedSet, mineSet)
  if (!constraints) {
    return { hasSolution: false, forcedSafe: new Set<number>(), forcedMine: new Set<number>(), variableSet: new Set<number>() }
  }
  if (constraints.length === 0) {
    return { hasSolution: true, forcedSafe: new Set<number>(), forcedMine: new Set<number>(), variableSet: new Set<number>() }
  }

  const forcedSafe = new Set<number>()
  const forcedMine = new Set<number>()
  const variableSet = new Set<number>()
  const components = splitPrototypeConstraintComponents(constraints)
  for (const component of components) {
    for (const variable of component.cells) variableSet.add(variable)
    if (component.cells.length > MAX_COMPONENT_VARIABLES) {
      return { hasSolution: false, forcedSafe: new Set<number>(), forcedMine: new Set<number>(), variableSet }
    }
    const solved = solvePrototypeConstraintComponent(constraints, component.cells, component.constraints)
    if (!solved.hasSolution) {
      return { hasSolution: false, forcedSafe: new Set<number>(), forcedMine: new Set<number>(), variableSet }
    }
    for (const index of solved.forcedSafe) forcedSafe.add(index)
    for (const index of solved.forcedMine) forcedMine.add(index)
  }

  return { hasSolution: true, forcedSafe, forcedMine, variableSet }
}

function revealFromIndexForSimulation(
  phase: LayoutPhaseResult,
  mineSet: Set<number>,
  revealedSet: Set<number>,
  flaggedSet: Set<number>,
  startIndex: number,
): boolean {
  const queue: number[] = [startIndex]
  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) continue
    if (!phase.activeMask[current] || flaggedSet.has(current) || revealedSet.has(current)) continue
    if (mineSet.has(current)) return false
    revealedSet.add(current)
    const hint = getAdjacentMineCount(current, phase, mineSet)
    if (hint !== 0) continue
    for (const neighbor of getNeighbors(current, phase.rows, phase.cols)) {
      if (!phase.activeMask[neighbor]) continue
      if (revealedSet.has(neighbor) || flaggedSet.has(neighbor)) continue
      if (!mineSet.has(neighbor)) queue.push(neighbor)
    }
  }
  return true
}

function hasSimulatedPlayerKnownSafeMove(
  phase: LayoutPhaseResult,
  startIndex: number,
  mineSet: Set<number>,
): boolean {
  if (startIndex < 0 || !phase.activeMask[startIndex]) return false
  const revealedSet = new Set<number>()
  const flaggedSet = new Set<number>()
  const opened = revealFromIndexForSimulation(phase, mineSet, revealedSet, flaggedSet, startIndex)
  if (!opened) return false

  const loopBudget = Math.max(1, phase.activeIndices.length * 2)
  for (let step = 0; step < loopBudget; step += 1) {
    const visibleHints = new Map<number, number>()
    for (const index of revealedSet) {
      if (!phase.activeMask[index] || mineSet.has(index)) continue
      visibleHints.set(index, getAdjacentMineCount(index, phase, mineSet))
    }

    const inference = inferForcedAssignments(phase, visibleHints, revealedSet, flaggedSet)
    if (!inference.hasSolution) return false

    const safeMoves = [...inference.forcedSafe].filter(
      (index) => phase.activeMask[index] && !revealedSet.has(index) && !flaggedSet.has(index) && !mineSet.has(index),
    )
    if (safeMoves.length > 0) return true

    const forcedFlags = [...inference.forcedMine].filter(
      (index) => phase.activeMask[index] && !flaggedSet.has(index) && mineSet.has(index),
    )
    if (forcedFlags.length === 0) return false
    for (const index of forcedFlags) flaggedSet.add(index)
  }

  return false
}

function tryBuildPrototypeTransaction(
  phase: LayoutPhaseResult,
  session: PrototypeMineSession,
  baseAssignedSet: Set<number>,
  baseHintAssignments: Map<number, number>,
  baseMineSet: Set<number>,
  startForbiddenMineSet: Set<number>,
  selected: number,
  candidateHint: number,
  needed: number,
  availableForMine: number[],
): PrototypeTransactionAttempt | null {
  const draftAssignedSet = new Set<number>(baseAssignedSet)
  const draftHintAssignments = new Map<number, number>(baseHintAssignments)
  const draftMineSet = new Set<number>(baseMineSet)
  const addedMineSet = new Set<number>()
  const orderedMineChoices = sortBySeed(availableForMine, session.seed ^ candidateHint, selected + 23)

  for (let i = 0; i < needed; i += 1) {
    const mineIndex = orderedMineChoices[i]
    if (mineIndex === undefined) return null
    if (startForbiddenMineSet.has(mineIndex) || draftAssignedSet.has(mineIndex)) return null
    draftMineSet.add(mineIndex)
    addedMineSet.add(mineIndex)
  }

  draftAssignedSet.add(selected)
  draftHintAssignments.set(selected, candidateHint)
  if (!isHintConsistentForAssigned(draftHintAssignments, phase, draftMineSet)) return null

  let internalPasses = 1
  let supportHintsAdded = 0

  while (internalPasses <= 1 + MAX_SUPPORT_HINTS_PER_TRANSACTION) {
    // Transaction validation treats all mines as unknown variables, so every
    // committed mine remains logically forced by currently assigned clues.
    const validationMineSet = new Set<number>()
    const inference = inferForcedAssignments(phase, draftHintAssignments, draftAssignedSet, validationMineSet)
    if (!inference.hasSolution) return null

    const ambiguousVariables = [...inference.variableSet].filter(
      (index) => !inference.forcedMine.has(index) && !inference.forcedSafe.has(index),
    )
    const hasPlayerSafeMove = hasSimulatedPlayerKnownSafeMove(phase, session.startIndex, draftMineSet)
    let allDraftMinesForced = true
    for (const mineIndex of draftMineSet) {
      if (!inference.forcedMine.has(mineIndex)) {
        allDraftMinesForced = false
        break
      }
    }

    if (allDraftMinesForced && (hasPlayerSafeMove || draftAssignedSet.size >= phase.activeIndices.length)) {
      return {
        assignedSet: draftAssignedSet,
        hintAssignments: draftHintAssignments,
        mineSet: draftMineSet,
        addedMineSet,
        supportHintsAdded,
        internalPasses,
        selected,
        candidateHint,
      }
    }

    if (supportHintsAdded >= MAX_SUPPORT_HINTS_PER_TRANSACTION) return null

    const ambiguousCells = ambiguousVariables.filter(
      (index) =>
        phase.activeMask[index] &&
        !draftAssignedSet.has(index) &&
        !draftMineSet.has(index),
    )
    if (ambiguousCells.length === 0) return null

    const supportCandidates = sortBySeed(
      ambiguousCells,
      session.seed ^ selected ^ candidateHint,
      session.stepCount + 211 + supportHintsAdded,
    )
    const supportIndex = supportCandidates[0]
    if (supportIndex === undefined) return null

    draftAssignedSet.add(supportIndex)
    draftHintAssignments.set(supportIndex, getAdjacentMineCount(supportIndex, phase, draftMineSet))
    if (!isHintConsistentForAssigned(draftHintAssignments, phase, draftMineSet)) return null
    supportHintsAdded += 1
    internalPasses += 1
  }

  return null
}

export function generateMinesWeighted(
  settings: GenerationSettings,
  phase: LayoutPhaseResult,
  targetMineCount: number,
  seed: number,
): MineGenerationCandidate {
  const startIndex = selectStartIndexCenterBiased(phase, seed ^ 0x5f3759df)
  const { rows, cols, activeMask, activeIndices } = phase
  const startNeighbors = new Set(getNeighbors(startIndex, rows, cols).filter((n) => activeMask[n]))
  const safeZone = new Set<number>([startIndex, ...startNeighbors])
  const eligible = activeIndices.filter((index) => !safeZone.has(index))
  const safeTarget = clamp(targetMineCount, 0, eligible.length)
  if (safeTarget <= 0 || eligible.length === 0) return { startIndex, mineSet: new Set<number>() }

  const startRow = Math.floor(startIndex / cols)
  const startCol = startIndex % cols
  const distanceScale = Math.max(2, Math.max(rows, cols) * 0.65)
  const spreadBias = clamp(settings.propagation / 100, 0.2, 0.95)
  const random = mulberry32(seed ^ (rows << 8) ^ cols)

  const pool = [...eligible]
  const weights = pool.map((index) => {
    const row = Math.floor(index / cols)
    const col = index % cols
    const dist = Math.hypot(row - startRow, col - startCol)
    const distNorm = clamp(dist / distanceScale, 0, 1.6)
    const localNoise = hashUnit(seed, row, col, settings.propagation)
    const layoutNoise = hashUnit(seed ^ 0x9e3779b9, col, row, rows + cols)
    return 0.2 + distNorm * (0.9 * spreadBias) + localNoise * 0.6 + layoutNoise * 0.45
  })

  const mineSet = new Set<number>()
  const desiredCount = Math.max(1, Math.round((activeIndices.length * DEFAULT_MINE_PERCENT) / 100))
  const picks = clamp(safeTarget, 1, Math.min(desiredCount, eligible.length))

  for (let count = 0; count < picks && pool.length > 0; count += 1) {
    const chosen = weightedPickIndex(weights, random)
    mineSet.add(pool[chosen])
    pool.splice(chosen, 1)
    weights.splice(chosen, 1)
  }

  return { startIndex, mineSet }
}

  /**
   * Prototype generator assumptions (v0):
   * 1. The chosen start cell is the only cell guaranteed to be mine-free.
   * 2. The chosen start cell should also evaluate to a 0-valued hint.
   * 3. Assigned cells are locked and may not be altered by later steps.
   */
export function generateMinesPrototypeNoop(
  settings: GenerationSettings,
  phase: LayoutPhaseResult,
  targetMineCount: number,
  seed: number,
): MineGenerationCandidate {
  void settings
  void targetMineCount
  const startIndex = selectStartIndexRandom(phase, seed ^ 0x9e3779b9)
  return { startIndex, mineSet: new Set<number>() }
}

export function initializePrototypeMineSession(
  phase: LayoutPhaseResult,
  seed: number,
): PrototypeMineSession {
  const startIndex = selectStartIndexRandom(phase, seed ^ 0x9e3779b9)
  const assignedSet = new Set<number>(startIndex >= 0 ? [startIndex] : [])
  const hintAssignments = new Map<number, number>()
  if (startIndex >= 0) hintAssignments.set(startIndex, 0)
  return {
    startIndex,
    assignedSet,
    hintAssignments,
    mineSet: new Set<number>(),
    stepCount: 0,
    seed,
    lastAction: startIndex >= 0 ? `assigned start @ ${startIndex} with hint 0` : 'no active start available',
  }
}

export function advancePrototypeMineSession(
  phase: LayoutPhaseResult,
  session: PrototypeMineSession,
): PrototypeMineSession {
  const baseAssignedSet = new Set<number>(session.assignedSet)
  const baseHintAssignments = new Map<number, number>(session.hintAssignments)
  const baseMineSet = new Set<number>(session.mineSet)
  if (session.startIndex >= 0) baseAssignedSet.add(session.startIndex)

  const startForbiddenMineSet = new Set<number>([session.startIndex])
  for (const neighbor of getNeighbors(session.startIndex, phase.rows, phase.cols)) {
    if (phase.activeMask[neighbor]) startForbiddenMineSet.add(neighbor)
  }

  const buildPrioritizedFrontier = (assignedSet: Set<number>, mineSet: Set<number>): number[] => {
    const frontier = new Set<number>()
    for (const assignedIndex of assignedSet) {
      for (const neighbor of getNeighbors(assignedIndex, phase.rows, phase.cols)) {
        if (!phase.activeMask[neighbor]) continue
        if (assignedSet.has(neighbor)) continue
        frontier.add(neighbor)
      }
    }

    const frontierList = sortBySeed([...frontier], session.seed, session.stepCount + 1 + assignedSet.size)
    return [...frontierList].sort((a, b) => {
      const aNeighbors = getNeighbors(a, phase.rows, phase.cols).filter((n) => phase.activeMask[n])
      const bNeighbors = getNeighbors(b, phase.rows, phase.cols).filter((n) => phase.activeMask[n])
      const aAvailable = aNeighbors.filter(
        (n) => !assignedSet.has(n) && !mineSet.has(n) && !startForbiddenMineSet.has(n),
      ).length
      const bAvailable = bNeighbors.filter(
        (n) => !assignedSet.has(n) && !mineSet.has(n) && !startForbiddenMineSet.has(n),
      ).length
      if (aAvailable !== bAvailable) return bAvailable - aAvailable
      const aSeed = hashUnit(session.seed, a, session.stepCount + 101, phase.activeIndices.length)
      const bSeed = hashUnit(session.seed, b, session.stepCount + 101, phase.activeIndices.length)
      if (aSeed !== bSeed) return aSeed - bSeed
      return a - b
    })
  }

  const tryDeterministicTx = (
    assignedSet: Set<number>,
    hintAssignments: Map<number, number>,
    mineSet: Set<number>,
  ): PrototypeTransactionAttempt | null => {
    const prioritizedFrontier = buildPrioritizedFrontier(assignedSet, mineSet)
    for (const selected of prioritizedFrontier) {
      const neighbors = getNeighbors(selected, phase.rows, phase.cols).filter((n) => phase.activeMask[n])
      const currentMineCount = neighbors.reduce((count, n) => count + (mineSet.has(n) ? 1 : 0), 0)
      const availableForMine = neighbors.filter(
        (n) => !assignedSet.has(n) && !mineSet.has(n) && !startForbiddenMineSet.has(n),
      )
      const maxHint = Math.min(6, currentMineCount + availableForMine.length)
      const hintCandidates = sortBySeed(
        Array.from({ length: maxHint + 1 }, (_, value) => value),
        session.seed ^ selected,
        session.stepCount + 11,
      )

      for (const candidateHint of hintCandidates) {
        const needed = candidateHint - currentMineCount
        if (needed < 0 || needed > availableForMine.length) continue

        const tx = tryBuildPrototypeTransaction(
          phase,
          session,
          assignedSet,
          hintAssignments,
          mineSet,
          startForbiddenMineSet,
          selected,
          candidateHint,
          needed,
          availableForMine,
        )
        if (tx) return tx
      }
    }
    return null
  }

  let action = 'transaction failed: no deterministic candidate'
  const directTx = tryDeterministicTx(baseAssignedSet, baseHintAssignments, baseMineSet)
  if (directTx) {
    action = `tx committed @${directTx.selected}=hint ${directTx.candidateHint}; mines+${directTx.addedMineSet.size}; support+${directTx.supportHintsAdded}; passes=${directTx.internalPasses}`
    return {
      startIndex: session.startIndex,
      assignedSet: directTx.assignedSet,
      hintAssignments: directTx.hintAssignments,
      mineSet: directTx.mineSet,
      stepCount: session.stepCount + 1,
      seed: session.seed,
      lastAction: action,
    }
  }

  const cascadeAssignedSet = new Set<number>(baseAssignedSet)
  const cascadeHintAssignments = new Map<number, number>(baseHintAssignments)
  const cascadeMineSet = new Set<number>(baseMineSet)
  let zeroCascadeCount = 0
  const cascadeBudget = Math.max(1, phase.activeIndices.length)

  for (let i = 0; i < cascadeBudget; i += 1) {
    const frontier = buildPrioritizedFrontier(cascadeAssignedSet, cascadeMineSet)
    if (frontier.length === 0) {
      action = zeroCascadeCount > 0 ? `tx fallback cascade0 x${zeroCascadeCount}; no frontier` : 'no frontier cells available'
      break
    }

    let assignedZero = false
    for (const selected of frontier) {
      const zeroHint = getAdjacentMineCount(selected, phase, cascadeMineSet)
      if (zeroHint !== 0) continue
      cascadeAssignedSet.add(selected)
      cascadeHintAssignments.set(selected, 0)
      if (!isHintConsistentForAssigned(cascadeHintAssignments, phase, cascadeMineSet)) {
        cascadeAssignedSet.delete(selected)
        cascadeHintAssignments.delete(selected)
        continue
      }
      const validationInference = inferForcedAssignments(phase, cascadeHintAssignments, cascadeAssignedSet, new Set<number>())
      if (!validationInference.hasSolution) {
        cascadeAssignedSet.delete(selected)
        cascadeHintAssignments.delete(selected)
        continue
      }
      zeroCascadeCount += 1
      assignedZero = true
      break
    }

    if (!assignedZero) {
      action = zeroCascadeCount > 0 ? `tx fallback cascade0 x${zeroCascadeCount}; no zero frontier` : 'transaction failed: no deterministic candidate'
      break
    }

    const cascadedTx = tryDeterministicTx(cascadeAssignedSet, cascadeHintAssignments, cascadeMineSet)
    if (cascadedTx) {
      action = `tx cascade0 x${zeroCascadeCount} then commit @${cascadedTx.selected}=hint ${cascadedTx.candidateHint}; mines+${cascadedTx.addedMineSet.size}; support+${cascadedTx.supportHintsAdded}; passes=${cascadedTx.internalPasses}`
      return {
        startIndex: session.startIndex,
        assignedSet: cascadedTx.assignedSet,
        hintAssignments: cascadedTx.hintAssignments,
        mineSet: cascadedTx.mineSet,
        stepCount: session.stepCount + 1,
        seed: session.seed,
        lastAction: action,
      }
    }
  }

  if (zeroCascadeCount > 0) {
    return {
      startIndex: session.startIndex,
      assignedSet: cascadeAssignedSet,
      hintAssignments: cascadeHintAssignments,
      mineSet: cascadeMineSet,
      stepCount: session.stepCount + 1,
      seed: session.seed,
      lastAction: action,
    }
  }

  return {
    startIndex: session.startIndex,
    assignedSet: baseAssignedSet,
    hintAssignments: baseHintAssignments,
    mineSet: baseMineSet,
    stepCount: session.stepCount,
    seed: session.seed,
    lastAction: action,
  }
}
