import { getNeighbors } from './grid'
import type { CellState, CellTruth } from './types'

export function createTruthBoard(
  rows: number,
  cols: number,
  mineSet: Set<number>,
  activeMask: boolean[],
): CellTruth[] {
  const total = rows * cols
  const truth: CellTruth[] = new Array(total)

  for (let index = 0; index < total; index += 1) {
    const active = activeMask[index]
    truth[index] = { active, mine: active && mineSet.has(index), adjacentMines: 0 }
  }

  for (let index = 0; index < total; index += 1) {
    if (!truth[index].active || truth[index].mine) continue
    let adjacent = 0
    for (const neighbor of getNeighbors(index, rows, cols)) {
      if (truth[neighbor].active && truth[neighbor].mine) adjacent += 1
    }
    truth[index].adjacentMines = adjacent
  }

  return truth
}

export function revealCellRegion(cells: CellState[], rows: number, cols: number, startIndex: number): void {
  const queue = [startIndex]

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) continue

    const cell = cells[current]
    if (!cell.active || cell.revealed || cell.flagged) continue
    cell.revealed = true
    if (cell.adjacentMines > 0 || cell.mine) continue

    for (const neighbor of getNeighbors(current, rows, cols)) {
      const neighborCell = cells[neighbor]
      if (neighborCell.active && !neighborCell.revealed && !neighborCell.flagged && !neighborCell.mine) {
        queue.push(neighbor)
      }
    }
  }
}

export function checkWin(cells: CellState[]): boolean {
  const allSafeRevealed = cells.every((cell) => !cell.active || cell.mine || cell.revealed)
  const allMinesFlagged = cells.every((cell) => (!cell.active ? true : cell.mine ? cell.flagged : !cell.flagged))
  return allSafeRevealed && allMinesFlagged
}
