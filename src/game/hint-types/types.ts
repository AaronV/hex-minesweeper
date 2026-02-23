import type { CellTruth, GameState, HintType } from '../types'

export interface HintRenderContext {
  ctx: CanvasRenderingContext2D
  game: GameState
  index: number
  x: number
  y: number
  radius: number
  value: number
}

export interface HintVisibilityContext {
  game: GameState
  index: number
  xrayMode: boolean
}

export interface HintStrategy {
  type: HintType
  getValue: (cell: CellTruth) => number
  isZeroExpansionHint: (cell: CellTruth) => boolean
  canAutoChord: (cell: CellTruth) => boolean
  shouldShowHint: (context: HintVisibilityContext) => boolean
  renderHint: (context: HintRenderContext) => void
}
