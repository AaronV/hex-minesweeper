import { getConstraintCellsForHintCell } from '../hint-constraints'
import type { GameState } from '../types'

export function getHintTargetCells(game: GameState, index: number): number[] {
  const cell = game.cells[index]
  if (!cell || !cell.active || cell.mine) return []
  const activeMask = game.cells.map((candidate) => candidate.active)
  return getConstraintCellsForHintCell(index, cell, game.rows, game.cols, activeMask)
}

export function getUnsolvedHintTargets(game: GameState, index: number): number[] {
  const scope = getHintTargetCells(game, index)
  return scope.filter((candidateIndex) => {
    const candidate = game.cells[candidateIndex]
    return candidate.active && !candidate.revealed && !candidate.flagged
  })
}

export function hasActionableHintTargets(game: GameState, index: number): boolean {
  const scope = getHintTargetCells(game, index)
  return scope.some((candidateIndex) => {
    const candidate = game.cells[candidateIndex]
    return candidate.active && !candidate.revealed && !candidate.flagged
  })
}
