import { getNeighbors } from '../grid'
import type { LayoutPhaseResult } from '../types'

interface PrototypeConstraint {
  unknown: number[]
  remaining: number
}

interface PrototypeComponentSolveResult {
  forcedSafe: number[]
  forcedMine: number[]
  hasSolution: boolean
}

export interface PrototypeInferenceResult {
  hasSolution: boolean
  forcedSafe: Set<number>
  forcedMine: Set<number>
  variableSet: Set<number>
}

const MAX_SOLUTIONS_PER_COMPONENT = 60000
const MAX_COMPONENT_VARIABLES = 22

export function getAdjacentMineCount(index: number, phase: LayoutPhaseResult, mineSet: Set<number>): number {
  let count = 0
  for (const neighbor of getNeighbors(index, phase.rows, phase.cols)) {
    if (phase.activeMask[neighbor] && mineSet.has(neighbor)) count += 1
  }
  return count
}

export function isHintConsistentForAssigned(
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

export function inferForcedAssignments(
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

export function hasSimulatedPlayerKnownSafeMove(
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
