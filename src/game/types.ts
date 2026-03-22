export type GameStatus = 'playing' | 'won' | 'lost'
export type MapLayout = 'rectangle' | 'rorschach' | 'snowflake' | 'hexesOfHexes'
export type HintType = 'adjacent' | 'axisPairLine'
export type AxisPair = 0 | 1 | 2

export interface AssignedHintSpec {
  kind: HintType
  value: number
  axisPair?: AxisPair
}

export interface CellTruth {
  active: boolean
  mine: boolean
  adjacentMines: number
  hints: Record<HintType, number>
  hintKind: HintType
  axisPair: AxisPair | null
}

export interface CellState extends CellTruth {
  revealed: boolean
  flagged: boolean
  start: boolean
  assigned: boolean
  exploded: boolean
}

export interface GenerationSettings {
  mapSize: number
  mapLayout: MapLayout
  hintType: HintType
  propagation: number
  snowflakeArms: number
  rectCols: number
  rectRows: number
}

export interface GameState {
  cols: number
  rows: number
  hintType: HintType
  mineCount: number
  safeStartCount: number
  activeCellCount: number
  seed: number
  status: GameStatus
  cells: CellState[]
  generationReport: GenerationReport
}

export interface LayoutPhaseResult {
  rows: number
  cols: number
  activeMask: boolean[]
  activeIndices: number[]
  startIndex: number
}

export interface MineGenerationSession {
  startIndex: number
  mineSet: Set<number>
  messages: string[]
  stepCount: number
  seed: number
  lastAction: string
  done: boolean
  assignedSet: Set<number>
  hintAssignments: Map<number, AssignedHintSpec>
  candidateIndices: number[]
  currentTargetIndex: number
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
  messageLog: string[]
  currentTargetIndex: number
}
