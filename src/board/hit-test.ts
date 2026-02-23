import type { GameState } from '../game/types'
import { pointInHex } from './layout'
import type { BoardLayout, CameraState } from './types'

export function findCellAtPoint(
  x: number,
  y: number,
  width: number,
  height: number,
  layout: BoardLayout | null,
  camera: CameraState,
  game: GameState,
): number {
  if (!layout) return -1
  const boardX = (x - camera.panX - width / 2) / camera.zoom + width / 2
  const boardY = (y - camera.panY - height / 2) / camera.zoom + height / 2
  for (let index = 0; index < layout.centers.length; index += 1) {
    if (!game.cells[index].active) continue
    const center = layout.centers[index]
    if (pointInHex(boardX, boardY, center.x, center.y, layout.radius - 0.8)) return index
  }
  return -1
}
