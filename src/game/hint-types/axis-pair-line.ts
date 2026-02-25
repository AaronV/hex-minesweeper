import type { HintStrategy } from './types'
import { hasActionableHintTargets } from './targets'

const DIRECTION_ANGLES: ReadonlyArray<number> = [240, 300, 180, 0, 120, 60]
const AXIS_DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 5],
  [1, 4],
  [2, 3],
]

function drawAxisArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  angleDeg: number,
): void {
  const angle = (Math.PI / 180) * angleDeg
  const ux = Math.cos(angle)
  const uy = Math.sin(angle)
  const px = -uy
  const py = ux
  const tipOffset = radius * 0.78
  const tipX = x + ux * tipOffset
  const tipY = y + uy * tipOffset
  const baseDepth = Math.max(2.2, radius * 0.26)
  const baseHalf = Math.max(1.8, radius * 0.16)
  const baseX = tipX - ux * baseDepth
  const baseY = tipY - uy * baseDepth

  ctx.beginPath()
  ctx.moveTo(tipX, tipY)
  ctx.lineTo(baseX + px * baseHalf, baseY + py * baseHalf)
  ctx.lineTo(baseX - px * baseHalf, baseY - py * baseHalf)
  ctx.closePath()
  ctx.fillStyle = 'rgba(13, 148, 136, 0.96)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(15, 118, 110, 0.98)'
  ctx.lineWidth = Math.max(1, radius * 0.06)
  ctx.stroke()
}

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
    if (!cell.revealed) return false
    return hasActionableHintTargets(game, index)
  },
  renderHint: ({ ctx, game, index, value, x, y, radius }) => {
    const axisPair = game.cells[index]?.axisPair ?? 0
    const [d0, d1] = AXIS_DIRECTIONS[axisPair] ?? AXIS_DIRECTIONS[0]
    drawAxisArrow(ctx, x, y, radius, DIRECTION_ANGLES[d0] ?? 210)
    drawAxisArrow(ctx, x, y, radius, DIRECTION_ANGLES[d1] ?? 30)

    const fontSize = Math.max(8, radius * 0.48)
    ctx.fillStyle = '#0f766e'
    ctx.font = `700 ${fontSize}px "Avenir Next", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(value), x, y + 1)
  },
}
