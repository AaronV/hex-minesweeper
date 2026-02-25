import { getNeighbors, hashUnit } from './grid'
import type { AssignedHintSpec, AxisPair, CellTruth, HintType } from './types'

const AXIS_DIRECTION_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 5],
  [1, 4],
  [2, 3],
]

function getDirectionOffsets(row: number): ReadonlyArray<readonly [number, number]> {
  if (row % 2 === 0) {
    return [
      [-1, -1],
      [-1, 0],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
    ]
  }
  return [
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, 0],
    [1, 1],
  ]
}

function stepDirection(index: number, direction: number, rows: number, cols: number): number {
  const row = Math.floor(index / cols)
  const col = index % cols
  const offsets = getDirectionOffsets(row)
  const [dRow, dCol] = offsets[direction] ?? [0, 0]
  const nextRow = row + dRow
  const nextCol = col + dCol
  if (nextRow < 0 || nextRow >= rows || nextCol < 0 || nextCol >= cols) return -1
  return nextRow * cols + nextCol
}

function getRayActiveCells(
  startIndex: number,
  direction: number,
  rows: number,
  cols: number,
  activeMask: boolean[],
): number[] {
  const cells: number[] = []
  let cursor = startIndex
  while (true) {
    const next = stepDirection(cursor, direction, rows, cols)
    if (next < 0) break
    if (activeMask[next]) cells.push(next)
    cursor = next
  }
  return cells
}

export function getAxisConstraintCells(
  index: number,
  axisPair: AxisPair,
  rows: number,
  cols: number,
  activeMask: boolean[],
): number[] {
  const [d0, d1] = AXIS_DIRECTION_PAIRS[axisPair] ?? AXIS_DIRECTION_PAIRS[0]
  const first = getRayActiveCells(index, d0, rows, cols, activeMask)
  const second = getRayActiveCells(index, d1, rows, cols, activeMask)
  return [...first, ...second]
}

export function getHintConstraintCells(
  index: number,
  kind: HintType,
  rows: number,
  cols: number,
  activeMask: boolean[],
  axisPair: AxisPair | null = null,
): number[] {
  if (kind === 'axisPairLine') {
    return getAxisConstraintCells(index, axisPair ?? 0, rows, cols, activeMask)
  }
  return getNeighbors(index, rows, cols).filter((neighbor) => activeMask[neighbor])
}

export function getConstraintCellsForHintSpec(
  index: number,
  spec: AssignedHintSpec,
  rows: number,
  cols: number,
  activeMask: boolean[],
): number[] {
  return getHintConstraintCells(index, spec.kind, rows, cols, activeMask, spec.axisPair ?? 0)
}

export function getConstraintCellsForHintCell(
  index: number,
  cell: CellTruth,
  rows: number,
  cols: number,
  activeMask: boolean[],
): number[] {
  return getHintConstraintCells(index, cell.hintKind, rows, cols, activeMask, cell.axisPair)
}

export function countMinesInCells(cells: number[], mineSet: Set<number>): number {
  let count = 0
  for (const cell of cells) {
    if (mineSet.has(cell)) count += 1
  }
  return count
}

export function selectAxisPair(seed: number, index: number): AxisPair {
  const unit = hashUnit(seed ^ 0x7f4a7c15, index, 3, 97)
  if (unit < 1 / 3) return 0
  if (unit < 2 / 3) return 1
  return 2
}

