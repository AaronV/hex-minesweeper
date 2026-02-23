import { getGridDimensions } from './settings'
import type { GenerationSettings, LayoutPhaseResult } from './types'
import {
  ensureMinimumActiveCells,
  generateRectangleMask,
  generateRorschachMask,
  generateSnowflakeMask,
} from './layouts'

function generateActiveMask(
  settings: GenerationSettings,
  rows: number,
  cols: number,
  seed: number,
): boolean[] {
  if (settings.mapLayout === 'rectangle') {
    return generateRectangleMask(rows, cols)
  }
  if (settings.mapLayout === 'rorschach') {
    return generateRorschachMask(rows, cols, settings.propagation, seed)
  }
  return generateSnowflakeMask(rows, cols, settings.propagation, settings.snowflakeArms, settings.mapSize, seed)
}

export function generateLayoutPhase(settings: GenerationSettings, seed: number): LayoutPhaseResult {
  const { cols, rows } = getGridDimensions(settings)
  const total = rows * cols
  const allIndices = Array.from({ length: total }, (_, index) => index)

  let activeMask = generateActiveMask(settings, rows, cols, seed)
  activeMask = ensureMinimumActiveCells(activeMask, rows, cols, 12)

  const activeIndices = allIndices.filter((index) => activeMask[index])
  return { rows, cols, activeMask, activeIndices, startIndex: -1 }
}
