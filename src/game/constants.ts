import type { GenerationSettings } from './types'

export const MAP_SIZE_MIN = 10
export const MAP_SIZE_MAX = 20
export const PROPAGATION_MIN = 30
export const PROPAGATION_MAX = 50
export const RECT_COLS_MIN = 8
export const RECT_COLS_MAX = 40
export const RECT_ROWS_MIN = 8
export const RECT_ROWS_MAX = 32
export const DEFAULT_MINE_PERCENT = 20

export const DEFAULT_SETTINGS: GenerationSettings = {
  mapSize: MAP_SIZE_MIN,
  mapLayout: 'rorschach',
  hintType: 'adjacent',
  propagation: PROPAGATION_MIN,
  snowflakeArms: 6,
  rectCols: 20,
  rectRows: 14,
}
