import type { CellTruth, HintType } from '../types'
import { adjacentHintStrategy } from './adjacent'
import { axisPairLineHintStrategy } from './axis-pair-line'
import type { HintRenderContext, HintVisibilityContext, HintStrategy } from './types'
export { getHintTargetCells, getUnsolvedHintTargets, hasActionableHintTargets } from './targets'

const hintStrategies: Record<HintType, HintStrategy> = {
  adjacent: adjacentHintStrategy,
  axisPairLine: axisPairLineHintStrategy,
}

function resolveHintType(cell: CellTruth, fallback: HintType): HintType {
  return cell.hintKind ?? fallback
}

export function getHintStrategy(hintType: HintType): HintStrategy {
  return hintStrategies[hintType]
}

export function getCellHintValue(cell: CellTruth, hintType: HintType): number {
  return getHintStrategy(resolveHintType(cell, hintType)).getValue(cell)
}

export function isZeroExpansionHint(cell: CellTruth, hintType: HintType): boolean {
  return getHintStrategy(resolveHintType(cell, hintType)).isZeroExpansionHint(cell)
}

export function canAutoChord(cell: CellTruth, hintType: HintType): boolean {
  return getHintStrategy(resolveHintType(cell, hintType)).canAutoChord(cell)
}

export function shouldShowHint(context: HintVisibilityContext, hintType: HintType): boolean {
  const cell = context.game.cells[context.index]
  if (!cell) return false
  return getHintStrategy(resolveHintType(cell, hintType)).shouldShowHint(context)
}

export function renderHint(context: HintRenderContext, hintType: HintType): void {
  const cell = context.game.cells[context.index]
  if (!cell) return
  getHintStrategy(resolveHintType(cell, hintType)).renderHint(context)
}

export type { HintStrategy, HintRenderContext, HintVisibilityContext }
