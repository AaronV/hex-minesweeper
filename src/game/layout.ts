import { getGridDimensions } from './settings'
import type { GenerationSettings, LayoutPhaseResult } from './types'
import {
  ensureMinimumActiveCells,
  generateHexesOfHexesMask,
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
  if (settings.mapLayout === 'hexesOfHexes') {
    return generateHexesOfHexesMask(rows, cols, settings.propagation, seed)
  }
  return generateSnowflakeMask(rows, cols, settings.propagation, settings.snowflakeArms, settings.mapSize, seed)
}

export function generateLayoutPhase(settings: GenerationSettings, seed: number): LayoutPhaseResult {
  const { cols, rows } = getGridDimensions(settings)
  const total = rows * cols
  const allIndices = Array.from({ length: total }, (_, index) => index)

  let activeMask = generateActiveMask(settings, rows, cols, seed)
  const minimumActiveCells = settings.mapLayout === 'hexesOfHexes' ? 1 : 12
  activeMask = ensureMinimumActiveCells(activeMask, rows, cols, minimumActiveCells)

  const activeIndices = allIndices.filter((index) => activeMask[index])
  return { rows, cols, activeMask, activeIndices, startIndex: -1 }
}
