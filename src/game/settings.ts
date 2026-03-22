import { clamp } from './grid'
import type { GenerationSettings, MapLayout } from './types'
import {
  DEFAULT_MINE_PERCENT,
  MAP_SIZE_MAX,
  MAP_SIZE_MIN,
  PROPAGATION_MAX,
  PROPAGATION_MIN,
  RECT_COLS_MAX,
  RECT_COLS_MIN,
  RECT_ROWS_MAX,
  RECT_ROWS_MIN,
} from './constants'

export function getGridDimensions(settings: GenerationSettings): { cols: number; rows: number } {
  if (settings.mapLayout === 'rectangle') {
    return { cols: settings.rectCols, rows: settings.rectRows }
  }
  if (settings.mapLayout === 'hexesOfHexes') {
    const size = settings.mapSize
    return { cols: size * 2 + 14, rows: size * 2 + 10 }
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
  if (settings.mapLayout === 'hexesOfHexes') {
    return clamp(0.08 + settings.propagation * 0.0026, 0.1, 0.34)
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
  const mapSize = clamp(Math.round(settings.mapSize), MAP_SIZE_MIN, MAP_SIZE_MAX)
  // Temporarily disable buggy layout generator until fixed.
  const mapLayout: MapLayout =
    settings.mapLayout === 'hexesOfHexes'
      ? 'rorschach'
      : (settings.mapLayout ?? 'rorschach')
  const hintType = settings.hintType === 'axisPairLine' ? 'axisPairLine' : 'adjacent'
  const propagation = clamp(Math.round(settings.propagation), PROPAGATION_MIN, PROPAGATION_MAX)
  const snowflakeArms = settings.snowflakeArms <= 3 ? 3 : 6
  const rectCols = clamp(Math.round(settings.rectCols), RECT_COLS_MIN, RECT_COLS_MAX)
  const rectRows = clamp(Math.round(settings.rectRows), RECT_ROWS_MIN, RECT_ROWS_MAX)
  return { mapSize, mapLayout, hintType, propagation, snowflakeArms, rectCols, rectRows }
}

export function getMineTargetFromActiveCells(activeCells: number): number {
  return clamp(Math.round((activeCells * DEFAULT_MINE_PERCENT) / 100), 1, Math.max(1, activeCells - 1))
}
