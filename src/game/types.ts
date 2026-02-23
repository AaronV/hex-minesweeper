export type GameStatus = 'playing' | 'won' | 'lost'
export type MapLayout = 'rectangle' | 'rorschach' | 'snowflake'

export interface CellTruth {
  active: boolean
  mine: boolean
  adjacentMines: number
}

export interface CellState extends CellTruth {
  revealed: boolean
  flagged: boolean
  start: boolean
  exploded: boolean
}

export interface GenerationSettings {
  mapSize: number
  mapLayout: MapLayout
  propagation: number
  snowflakeArms: number
  rectCols: number
  rectRows: number
}

export interface GameState {
  cols: number
  rows: number
  mineCount: number
  safeStartCount: number
  activeCellCount: number
  seed: number
  status: GameStatus
  cells: CellState[]
  generationReport: GenerationReport
}

export const DEFAULT_SETTINGS: GenerationSettings = {
  mapSize: 14,
  mapLayout: 'rectangle',
  propagation: 62,
  snowflakeArms: 6,
  rectCols: 20,
  rectRows: 14,
}

export interface LayoutPhaseResult {
  rows: number
  cols: number
  activeMask: boolean[]
  activeIndices: number[]
  startIndex: number
}

export interface GenerationReport {
  layoutSeed: number
  mineSeed: number
  activeCells: number
  targetMines: number
  acceptedTargetMines: number
  generatedMines: number
  attemptsUsed: number
  attemptBudget: number
  noGuessSolvePassed: boolean
  note: string
}
