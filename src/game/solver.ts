import { getNeighbors } from './grid'
import { getCellHintValue, isZeroExpansionHint } from './hint-types'
import type { CellTruth, HintType } from './types'

interface SolverConstraint {
  unknown: number[]
  remaining: number
}

interface ComponentSolveResult {
  forcedSafe: number[]
  forcedMine: number[]
  hasSolution: boolean
}

function revealForSolver(
  truth: CellTruth[],
  rows: number,
  cols: number,
  revealed: boolean[],
  flagged: boolean[],
  startIndex: number,
  hintType: HintType,
): boolean {
  const queue = [startIndex]
  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) continue
    if (revealed[current] || flagged[current]) continue
    const cell = truth[current]
    if (!cell.active || cell.mine) return false
    revealed[current] = true
    if (!isZeroExpansionHint(cell, hintType)) continue
    for (const neighbor of getNeighbors(current, rows, cols)) {
      const n = truth[neighbor]
      if (n.active && !n.mine && !revealed[neighbor] && !flagged[neighbor]) {
        queue.push(neighbor)
      }
    }
  }
  return true
}

function collectConstraints(
  truth: CellTruth[],
  rows: number,
  cols: number,
  revealed: boolean[],
  flagged: boolean[],
  hintType: HintType,
): SolverConstraint[] | null {
  const constraints: SolverConstraint[] = []
  for (let index = 0; index < truth.length; index += 1) {
    const cell = truth[index]
    if (!cell.active || !revealed[index] || cell.mine) continue
    const neighbors = getNeighbors(index, rows, cols).filter((neighbor) => truth[neighbor].active)
    const unknown = neighbors.filter((n) => !revealed[n] && !flagged[n]).sort((a, b) => a - b)
    if (unknown.length === 0) continue
    const flaggedCount = neighbors.filter((n) => flagged[n]).length
    const remaining = getCellHintValue(cell, hintType) - flaggedCount
    if (remaining < 0 || remaining > unknown.length) return null
    constraints.push({ unknown, remaining })
  }
  return constraints
}

function splitConstraintComponents(constraints: SolverConstraint[]): Array<{ cells: number[]; constraints: number[] }> {
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
    const compCells: number[] = []
    const compConstraints: number[] = []

    while (queueCells.length > 0 || queueConstraints.length > 0) {
      const cell = queueCells.shift()
      if (cell !== undefined) {
        if (visitedCells.has(cell)) continue
        visitedCells.add(cell)
        compCells.push(cell)
        for (const constraintIndex of byCell.get(cell) ?? []) {
          if (!visitedConstraints.has(constraintIndex)) queueConstraints.push(constraintIndex)
        }
      }

      const constraintIndex = queueConstraints.shift()
      if (constraintIndex !== undefined) {
        if (visitedConstraints.has(constraintIndex)) continue
        visitedConstraints.add(constraintIndex)
        compConstraints.push(constraintIndex)
        for (const nextCell of constraints[constraintIndex].unknown) {
          if (!visitedCells.has(nextCell)) queueCells.push(nextCell)
        }
      }
    }

    components.push({
      cells: compCells.sort((a, b) => a - b),
      constraints: compConstraints.sort((a, b) => a - b),
    })
  }

  return components
}

function solveConstraintComponent(
  allConstraints: SolverConstraint[],
  componentCells: number[],
  componentConstraintIndexes: number[],
): ComponentSolveResult {
  const vars = componentCells
  const constraints = componentConstraintIndexes.map((i) => allConstraints[i])
  const assignment: Array<boolean | null> = new Array(vars.length).fill(null)
  const varIndex = new Map<number, number>()
  for (let i = 0; i < vars.length; i += 1) varIndex.set(vars[i], i)

  let solutionCount = 0
  const mineHits = new Array(vars.length).fill(0)
  const maxSolutions = 60000

  const recurse = (position: number) => {
    if (solutionCount > maxSolutions) return

    for (const constraint of constraints) {
      let assignedMines = 0
      let unknownLeft = 0
      for (const cell of constraint.unknown) {
        const idx = varIndex.get(cell)
        if (idx === undefined) continue
        const value = assignment[idx]
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
          const idx = varIndex.get(cell)
          if (idx !== undefined && assignment[idx]) assignedMines += 1
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
  if (solutionCount === 0 || solutionCount > maxSolutions) {
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

export function deterministicSolveFromStarts(
  truth: CellTruth[],
  rows: number,
  cols: number,
  initialStarts: Set<number>,
  hintType: HintType = 'adjacent',
): boolean {
  const revealed = new Array(truth.length).fill(false)
  const flagged = new Array(truth.length).fill(false)

  for (const start of initialStarts) {
    if (!revealForSolver(truth, rows, cols, revealed, flagged, start, hintType)) return false
  }

  const allSafeRevealed = () => truth.every((cell, index) => !cell.active || cell.mine || revealed[index])

  while (!allSafeRevealed()) {
    const constraints = collectConstraints(truth, rows, cols, revealed, flagged, hintType)
    if (!constraints) return false
    if (constraints.length === 0) return false

    const components = splitConstraintComponents(constraints)
    let progress = false

    for (const component of components) {
      if (component.cells.length === 0) continue
      if (component.cells.length > 22) return false
      const solved = solveConstraintComponent(constraints, component.cells, component.constraints)
      if (!solved.hasSolution) return false

      for (const mineCell of solved.forcedMine) {
        if (!flagged[mineCell]) {
          flagged[mineCell] = true
          progress = true
        }
      }

      for (const safeCell of solved.forcedSafe) {
        if (!revealed[safeCell] && !flagged[safeCell]) {
          const ok = revealForSolver(truth, rows, cols, revealed, flagged, safeCell, hintType)
          if (!ok) return false
          progress = true
        }
      }
    }

    if (!progress) return false
  }

  return allSafeRevealed()
}
