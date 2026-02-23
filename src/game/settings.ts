import { clamp } from './grid'
import type { GenerationSettings, MapLayout } from './types'

export const DEFAULT_MINE_PERCENT = 20

export function getGridDimensions(settings: GenerationSettings): { cols: number; rows: number } {
  if (settings.mapLayout === 'rectangle') {
    return { cols: settings.rectCols, rows: settings.rectRows }
  }
  const size = settings.mapSize
  if (settings.mapLayout === 'rorschach') {
    // Keep odd cols/rows so both vertical and horizontal mirror modes have a true center axis.
    return { cols: size * 2 + 11, rows: size * 2 + 3 }
  }
  return { cols: size * 2 + 6, rows: size * 2 + 6 }
}

function estimateActiveRatio(settings: GenerationSettings): number {
  if (settings.mapLayout === 'rectangle') {
    return 1
  }
  if (settings.mapLayout === 'rorschach') {
    return clamp(0.28 + settings.propagation * 0.0038, 0.26, 0.66)
  }
  const armFactor = (settings.snowflakeArms - 3) * 0.028
  return clamp(0.26 + armFactor + settings.propagation * 0.0034, 0.24, 0.78)
}

export function estimatePlayableCells(settings: GenerationSettings): number {
  const { cols, rows } = getGridDimensions(settings)
  const total = cols * rows
  return Math.max(8, Math.round(total * estimateActiveRatio(settings)))
}

export function normalizeSettings(settings: GenerationSettings): GenerationSettings {
  const mapSize = clamp(Math.round(settings.mapSize), 8, 24)
  const mapLayout: MapLayout = settings.mapLayout ?? 'rectangle'
  const propagation = clamp(Math.round(settings.propagation), 20, 95)
  const snowflakeArms = settings.snowflakeArms <= 3 ? 3 : 6
  const rectCols = clamp(Math.round(settings.rectCols), 8, 40)
  const rectRows = clamp(Math.round(settings.rectRows), 8, 32)
  return { mapSize, mapLayout, propagation, snowflakeArms, rectCols, rectRows }
}

export function getMineTargetFromActiveCells(activeCells: number): number {
  return clamp(Math.round((activeCells * DEFAULT_MINE_PERCENT) / 100), 1, Math.max(1, activeCells - 1))
}
