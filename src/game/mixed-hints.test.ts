import { describe, expect, it } from 'vitest'
import { buildHintAttemptOrder } from './mine-generators/utilities'
import { getAxisConstraintCells } from './hint-constraints'
import { createTruthBoard, revealCellRegion } from './truth'
import { chordReveal } from './transitions'
import type { CellState, GameState } from './types'

describe('axis-pair constraints', () => {
  it('traverses across voids and includes active cells further down the ray', () => {
    const rows = 1
    const cols = 9
    const activeMask = [true, true, false, true, true, false, true, true, true]
    const scope = getAxisConstraintCells(4, 2, rows, cols, activeMask)
    expect(scope).toEqual([3, 1, 0, 6, 7, 8])
  })

  it('supports hint attempt ranges above six', () => {
    const order = buildHintAttemptOrder(12345, 44, 5, 12)
    expect(order).toContain(12)
    expect(order.length).toBe(8)
  })
})

describe('axis gameplay behavior', () => {
  it('zero axis flood reveals the full selected line across voids', () => {
    const rows = 1
    const cols = 9
    const activeMask = [true, true, false, true, true, false, true, true, true]
    const truth = createTruthBoard(rows, cols, new Set<number>(), activeMask)
    const cells: CellState[] = truth.map((cell, index) => ({
      ...cell,
      revealed: false,
      flagged: false,
      start: index === 4,
      assigned: true,
      exploded: false,
    }))
    cells[4].hintKind = 'axisPairLine'
    cells[4].axisPair = 2
    cells[4].hints.axisPairLine = 0

    revealCellRegion(cells, rows, cols, 4, 'adjacent')

    const revealed = cells.map((cell) => cell.revealed)
    expect(revealed).toEqual([true, true, false, true, true, false, true, true, true])
  })

  it('axis chording reveals only cells on the selected axis line', () => {
    const rows = 3
    const cols = 5
    const activeMask = new Array(rows * cols).fill(true)
    const mineSet = new Set<number>([9])
    const truth = createTruthBoard(rows, cols, mineSet, activeMask)
    const cells: CellState[] = truth.map((cell, index) => ({
      ...cell,
      revealed: false,
      flagged: index === 9,
      start: false,
      assigned: true,
      exploded: false,
    }))

    for (let i = 0; i < cells.length; i += 1) {
      if (cells[i].mine) continue
      cells[i].hintKind = 'adjacent'
      cells[i].hints.adjacent = 1
    }
    cells[7].hintKind = 'axisPairLine'
    cells[7].axisPair = 2
    cells[7].hints.axisPairLine = 1
    cells[7].revealed = true

    const game: GameState = {
      rows,
      cols,
      hintType: 'adjacent',
      mineCount: 1,
      safeStartCount: 1,
      activeCellCount: rows * cols,
      seed: 1,
      status: 'playing',
      cells,
      generationReport: {
        layoutSeed: 1,
        mineSeed: 1,
        activeCells: rows * cols,
        targetMines: 1,
        acceptedTargetMines: 1,
        generatedMines: 1,
        attemptsUsed: 1,
        attemptBudget: 1,
        noGuessSolvePassed: true,
        note: '',
        messageLog: [],
        currentTargetIndex: -1,
      },
    }

    const next = chordReveal(game, 7)

    expect(next.status).toBe('playing')
    expect(next.cells[5].revealed).toBe(true)
    expect(next.cells[6].revealed).toBe(true)
    expect(next.cells[8].revealed).toBe(true)
    expect(next.cells[2].revealed).toBe(false)
  })
})

