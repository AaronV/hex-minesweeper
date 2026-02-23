import type { BoardLayout, CameraState } from './types'

const SQRT3 = Math.sqrt(3)

export function computeLayout(width: number, height: number, rows: number, cols: number): BoardLayout {
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

export function toScreen(
  x: number,
  y: number,
  width: number,
  height: number,
  camera: CameraState,
): { x: number; y: number } {
  return {
    x: (x - width / 2) * camera.zoom + width / 2 + camera.panX,
    y: (y - height / 2) * camera.zoom + height / 2 + camera.panY,
  }
}

export function pointInHex(px: number, py: number, cx: number, cy: number, radius: number): boolean {
  const dx = Math.abs(px - cx)
  const dy = Math.abs(py - cy)
  if (dx > (SQRT3 * radius) / 2) return false
  if (dy > radius) return false
  return SQRT3 * dx + dy <= SQRT3 * radius + 0.0001
}
