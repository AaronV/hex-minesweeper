import type { GameState } from '../game/types'
import { getNeighbors } from '../game/grid'
import { computeLayout, toScreen } from './layout'
import type { BoardLayout, CameraState } from './types'

function drawHex(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  fill: string,
): void {
  ctx.beginPath()
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i - 30)
    const hx = x + radius * Math.cos(angle)
    const hy = y + radius * Math.sin(angle)
    if (i === 0) ctx.moveTo(hx, hy)
    else ctx.lineTo(hx, hy)
  }
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
}

function drawFlag(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.95)'
  ctx.lineWidth = Math.max(1, radius * 0.08)
  ctx.beginPath()
  ctx.moveTo(x - radius * 0.2, y + radius * 0.35)
  ctx.lineTo(x - radius * 0.2, y - radius * 0.35)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(x - radius * 0.2, y - radius * 0.32)
  ctx.lineTo(x + radius * 0.38, y - radius * 0.14)
  ctx.lineTo(x - radius * 0.2, y + radius * 0.02)
  ctx.closePath()
  ctx.fillStyle = 'rgba(248, 113, 113, 0.92)'
  ctx.fill()
}

function drawMine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  exploded: boolean,
): void {
  ctx.beginPath()
  ctx.arc(x, y, radius * 0.27, 0, Math.PI * 2)
  ctx.fillStyle = exploded ? 'rgba(254, 202, 202, 0.98)' : 'rgba(239, 68, 68, 0.95)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(127, 29, 29, 0.9)'
  ctx.lineWidth = Math.max(1, radius * 0.08)
  ctx.stroke()
}

const numberColors = ['', '#2563eb', '#16a34a', '#dc2626', '#b45309', '#7c3aed', '#0891b2']

function hasActionableUnknownNeighbors(game: GameState, index: number): boolean {
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

export function drawGameBoard(
  canvas: HTMLCanvasElement,
  game: GameState,
  camera: CameraState,
  xrayMode = false,
): BoardLayout | null {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.floor(rect.width * dpr)
  canvas.height = Math.floor(rect.height * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const { width, height } = rect
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(0, 0, width, height)

  const layout = computeLayout(width, height, game.rows, game.cols)

  for (let index = 0; index < game.cells.length; index += 1) {
    const cell = game.cells[index]
    const center = layout.centers[index]
    if (!center || !cell.active) continue

    const showMine = (xrayMode && cell.mine) || (game.status === 'lost' && cell.mine) || (cell.revealed && cell.mine)
    const hidden = !cell.revealed

    let fill = 'rgba(248, 250, 252, 1)'

    if (hidden) {
      fill = cell.flagged ? 'rgba(191, 219, 254, 0.98)' : 'rgba(203, 213, 225, 0.96)'
    } else if (cell.mine) {
      fill = cell.exploded ? 'rgba(254, 202, 202, 0.98)' : 'rgba(254, 226, 226, 0.96)'
    }

    const position = toScreen(center.x, center.y, width, height, camera)
    const drawRadius = layout.radius * camera.zoom - 0.8
    if (drawRadius < 4) continue
    drawHex(ctx, position.x, position.y, drawRadius, fill)

    const showHint =
      (xrayMode && !cell.mine && cell.adjacentMines > 0) ||
      (cell.revealed && !cell.mine && cell.adjacentMines > 0 && hasActionableUnknownNeighbors(game, index))

    if (!xrayMode && cell.flagged && hidden) {
      drawFlag(ctx, position.x, position.y, drawRadius)
    } else if (showMine) {
      drawMine(ctx, position.x, position.y, drawRadius, cell.exploded)
    } else if (showHint) {
      const fontSize = Math.max(9, drawRadius * 0.55)
      ctx.fillStyle = numberColors[cell.adjacentMines] ?? '#e2e8f0'
      ctx.font = `600 ${fontSize}px "Avenir Next", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(cell.adjacentMines), position.x, position.y + 1)
    }

    if (cell.start && hidden && !cell.flagged) {
      ctx.beginPath()
      ctx.arc(position.x, position.y, Math.max(4, drawRadius * 0.24), 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.9)'
      ctx.lineWidth = Math.max(1.5, drawRadius * 0.08)
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(position.x, position.y, Math.max(1.8, drawRadius * 0.09), 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(22, 163, 74, 0.95)'
      ctx.fill()
    }
  }

  return layout
}
