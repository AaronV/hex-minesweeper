import type { HintStrategy } from './types'

export const axisPairLineHintStrategy: HintStrategy = {
  type: 'axisPairLine',
  getValue: (cell) => cell.hints.axisPairLine ?? 0,
  isZeroExpansionHint: (cell) => (cell.hints.axisPairLine ?? 0) === 0,
  canAutoChord: (cell) => (cell.hints.axisPairLine ?? 0) > 0,
  shouldShowHint: ({ game, index, xrayMode }) => {
    const cell = game.cells[index]
    if (!cell || !cell.active || cell.mine) return false
    const value = cell.hints.axisPairLine ?? 0
    if (value <= 0) return false
    if (xrayMode) return true
    return cell.revealed
  },
  renderHint: ({ ctx, game, index, value, x, y, radius }) => {
    const axisPair = game.cells[index]?.axisPair ?? 0
    const glyph = axisPair === 1 ? '↗↙' : axisPair === 2 ? '↔' : '↖↘'
    const fontSize = Math.max(8, radius * 0.46)
    ctx.fillStyle = '#0f766e'
    ctx.font = `700 ${fontSize}px "Avenir Next", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${value}${glyph}`, x, y + 1)
  },
}
