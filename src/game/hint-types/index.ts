import type { CellTruth, HintType } from '../types'
import { adjacentHintStrategy } from './adjacent'
import { axisPairLineHintStrategy } from './axis-pair-line'
import type { HintRenderContext, HintVisibilityContext, HintStrategy } from './types'

const hintStrategies: Record<HintType, HintStrategy> = {
  adjacent: adjacentHintStrategy,
  axisPairLine: axisPairLineHintStrategy,
}

export function getHintStrategy(hintType: HintType): HintStrategy {
  return hintStrategies[hintType]
}

export function getCellHintValue(cell: CellTruth, hintType: HintType): number {
  return getHintStrategy(hintType).getValue(cell)
}

export function isZeroExpansionHint(cell: CellTruth, hintType: HintType): boolean {
  return getHintStrategy(hintType).isZeroExpansionHint(cell)
}

export function canAutoChord(cell: CellTruth, hintType: HintType): boolean {
  return getHintStrategy(hintType).canAutoChord(cell)
}

export function shouldShowHint(context: HintVisibilityContext, hintType: HintType): boolean {
  return getHintStrategy(hintType).shouldShowHint(context)
}

export function renderHint(context: HintRenderContext, hintType: HintType): void {
  getHintStrategy(hintType).renderHint(context)
}

export type { HintStrategy, HintRenderContext, HintVisibilityContext }
