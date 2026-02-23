import { getNeighbors } from '../grid'
import type { GameState } from '../types'
import type { HintStrategy } from './types'

const adjacentColors = ['', '#2563eb', '#16a34a', '#dc2626', '#b45309', '#7c3aed', '#0891b2']

function hasActionableUnknownAdjacent(game: GameState, index: number): boolean {
  for (const neighbor of getNeighbors(index, game.rows, game.cols)) {
    if (
      game.cells[neighbor].active &&
      !game.cells[neighbor].revealed &&
      !game.cells[neighbor].flagged
    ) {
      return true
    }
  }
  return false
}

export const adjacentHintStrategy: HintStrategy = {
  type: 'adjacent',
  getValue: (cell) => cell.hints.adjacent ?? 0,
  isZeroExpansionHint: (cell) => (cell.hints.adjacent ?? 0) === 0,
  canAutoChord: (cell) => (cell.hints.adjacent ?? 0) > 0,
  shouldShowHint: ({ game, index, xrayMode }) => {
    const cell = game.cells[index]
    if (!cell || !cell.active || cell.mine) return false
    const value = cell.hints.adjacent ?? 0
    if (value <= 0) return false
    if (xrayMode) return true
    if (!cell.revealed) return false
    return hasActionableUnknownAdjacent(game, index)
  },
  renderHint: ({ ctx, value, x, y, radius }) => {
    const fontSize = Math.max(9, radius * 0.55)
    ctx.fillStyle = adjacentColors[value] ?? '#0f172a'
    ctx.font = `600 ${fontSize}px "Avenir Next", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(value), x, y + 1)
  },
}
