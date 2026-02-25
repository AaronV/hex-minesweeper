import { getConstraintCellsForHintCell } from './hint-constraints'
import { canAutoChord, getCellHintValue } from './hint-types'
import { checkWin, revealCellRegion } from './truth'
import type { GameState, GameStatus } from './types'

export function revealCell(previous: GameState, index: number): GameState {
  if (previous.status !== 'playing') return previous
  const target = previous.cells[index]
  if (!target || !target.active || target.revealed || target.flagged) return previous
  const hasAnyRevealed = previous.cells.some((cell) => cell.active && cell.revealed)
  if (!hasAnyRevealed && !target.start) return previous

  const cells = previous.cells.map((cell) => ({ ...cell }))
  if (cells[index].mine) {
    for (const cell of cells) {
      if (cell.active && cell.mine) cell.revealed = true
    }
    cells[index].exploded = true
    return { ...previous, cells, status: 'lost' }
  }

  revealCellRegion(cells, previous.rows, previous.cols, index, previous.hintType)
  const status: GameStatus = checkWin(cells) ? 'won' : 'playing'
  return { ...previous, cells, status }
}

export function toggleFlag(previous: GameState, index: number): GameState {
  if (previous.status !== 'playing') return previous
  const target = previous.cells[index]
  if (!target || !target.active || target.revealed) return previous

  const cells = previous.cells.map((cell, cellIndex) =>
    cellIndex === index ? { ...cell, flagged: !cell.flagged } : cell,
  )
  const status: GameStatus = checkWin(cells) ? 'won' : 'playing'
  return { ...previous, cells, status }
}

export function chordReveal(previous: GameState, index: number): GameState {
  if (previous.status !== 'playing') return previous
  const target = previous.cells[index]
  if (!target || !target.active || !target.revealed || target.mine || !canAutoChord(target, previous.hintType)) {
    return previous
  }

  const activeMask = previous.cells.map((cell) => cell.active)
  const scopeCells = getConstraintCellsForHintCell(index, target, previous.rows, previous.cols, activeMask)
  const flaggedCount = scopeCells.filter((neighbor) => previous.cells[neighbor].flagged).length
  if (flaggedCount !== getCellHintValue(target, previous.hintType)) return previous

  const cells = previous.cells.map((cell) => ({ ...cell }))

  for (const neighbor of scopeCells) {
    const cell = cells[neighbor]
    if (cell.revealed || cell.flagged) continue

    if (cell.mine) {
      for (const mineCell of cells) {
        if (mineCell.active && mineCell.mine) mineCell.revealed = true
      }
      cell.exploded = true
      return { ...previous, cells, status: 'lost' }
    }

    revealCellRegion(cells, previous.rows, previous.cols, neighbor, previous.hintType)
  }

  const status: GameStatus = checkWin(cells) ? 'won' : 'playing'
  return { ...previous, cells, status }
}

export function applyRightClick(previous: GameState, index: number): GameState {
  const target = previous.cells[index]
  if (!target || !target.active) return previous
  if (target.revealed) return chordReveal(previous, index)
  return toggleFlag(previous, index)
}
