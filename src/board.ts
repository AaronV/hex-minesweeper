import type { GameState } from './game'

const SQRT3 = Math.sqrt(3)

export interface BoardLayout {
  centers: Array<{ x: number; y: number }>
  radius: number
}

function computeLayout(width: number, height: number, rows: number, cols: number): BoardLayout {
  const padding = 16
  const maxRadiusByWidth = (width - padding * 2) / (SQRT3 * (cols + 0.5))
  const maxRadiusByHeight = (height - padding * 2) / (1.5 * rows + 0.5)
  const radius = Math.max(8, Math.floor(Math.min(maxRadiusByWidth, maxRadiusByHeight)))
  const xStep = SQRT3 * radius
  const yStep = 1.5 * radius
  const boardWidth = xStep * (cols + 0.5)
  const boardHeight = radius * (1.5 * rows + 0.5)
  const originX = (width - boardWidth) / 2
  const originY = (height - boardHeight) / 2

  const centers: Array<{ x: number; y: number }> = []
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = originX + col * xStep + (row % 2 === 0 ? xStep / 2 : xStep)
      const y = originY + row * yStep + radius
      centers.push({ x, y })
    }
  }

  return { centers, radius }
}

function drawHex(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  fill: string,
  stroke: string,
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
  ctx.strokeStyle = stroke
  ctx.lineWidth = 1
  ctx.fill()
  ctx.stroke()
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

const numberColors = ['', '#93c5fd', '#86efac', '#fca5a5', '#fcd34d', '#c4b5fd', '#67e8f9']

export function drawGameBoard(canvas: HTMLCanvasElement, game: GameState): BoardLayout | null {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.floor(rect.width * dpr)
  canvas.height = Math.floor(rect.height * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const { width, height } = rect
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#020617'
  ctx.fillRect(0, 0, width, height)

  const layout = computeLayout(width, height, game.rows, game.cols)

  for (let index = 0; index < game.cells.length; index += 1) {
    const cell = game.cells[index]
    const center = layout.centers[index]
    if (!center) continue

    const showMine = (game.status === 'lost' && cell.mine) || (cell.revealed && cell.mine)
    const hidden = !cell.revealed

    let fill = 'rgba(10, 16, 30, 0.98)'
    let stroke = 'rgba(148, 163, 184, 0.16)'

    if (hidden) {
      fill = cell.flagged ? 'rgba(30, 41, 59, 0.96)' : 'rgba(9, 14, 28, 0.98)'
      stroke = cell.flagged ? 'rgba(148, 163, 184, 0.38)' : 'rgba(148, 163, 184, 0.18)'
    } else if (cell.mine) {
      fill = cell.exploded ? 'rgba(127, 29, 29, 0.9)' : 'rgba(69, 10, 10, 0.88)'
      stroke = 'rgba(248, 113, 113, 0.55)'
    } else if (cell.start) {
      fill = 'rgba(15, 30, 46, 0.98)'
      stroke = 'rgba(125, 211, 252, 0.35)'
    } else {
      fill = 'rgba(15, 23, 42, 0.96)'
      stroke = 'rgba(148, 163, 184, 0.24)'
    }

    drawHex(ctx, center.x, center.y, layout.radius - 0.8, fill, stroke)

    if (cell.flagged && hidden) {
      drawFlag(ctx, center.x, center.y, layout.radius)
    } else if (showMine) {
      drawMine(ctx, center.x, center.y, layout.radius, cell.exploded)
    } else if (cell.revealed && !cell.mine && cell.adjacentMines > 0) {
      const fontSize = Math.max(11, layout.radius * 0.55)
      ctx.fillStyle = numberColors[cell.adjacentMines] ?? '#e2e8f0'
      ctx.font = `600 ${fontSize}px "Avenir Next", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(cell.adjacentMines), center.x, center.y + 1)
    }
  }

  return layout
}

export function pointInHex(px: number, py: number, cx: number, cy: number, radius: number): boolean {
  const dx = Math.abs(px - cx)
  const dy = Math.abs(py - cy)
  if (dx > (SQRT3 * radius) / 2) return false
  if (dy > radius) return false
  return SQRT3 * dx + dy <= SQRT3 * radius + 0.0001
}

export function findCellAtPoint(x: number, y: number, layout: BoardLayout | null): number {
  if (!layout) return -1
  for (let index = 0; index < layout.centers.length; index += 1) {
    const center = layout.centers[index]
    if (pointInHex(x, y, center.x, center.y, layout.radius - 0.8)) return index
  }
  return -1
}
