export type GameStatus = 'playing' | 'won' | 'lost'

export interface CellTruth {
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
  cols: number
  rows: number
  minePercent: number
  minSafeStarts: number
}

export interface GameState {
  cols: number
  rows: number
  mineCount: number
  safeStartCount: number
  seed: number
  status: GameStatus
  cells: CellState[]
}

export const DEFAULT_SETTINGS: GenerationSettings = {
  cols: 16,
  rows: 12,
  minePercent: 20,
  minSafeStarts: 1,
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff)
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function getIndex(row: number, col: number, cols: number): number {
  return row * cols + col
}

export function getNeighbors(index: number, rows: number, cols: number): number[] {
  const row = Math.floor(index / cols)
  const col = index % cols
  const evenRowOffsets = [
    [-1, -1],
    [-1, 0],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
  ]
  const oddRowOffsets = [
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, 0],
    [1, 1],
  ]
  const offsets = row % 2 === 0 ? evenRowOffsets : oddRowOffsets
  const result: number[] = []

  for (const [dRow, dCol] of offsets) {
    const nextRow = row + dRow
    const nextCol = col + dCol
    if (nextRow < 0 || nextRow >= rows || nextCol < 0 || nextCol >= cols) continue
    result.push(getIndex(nextRow, nextCol, cols))
  }

  return result
}

function sampleWithoutReplacement(values: number[], count: number, random: () => number): number[] {
  const pool = [...values]
  const limit = Math.min(count, pool.length)
  for (let i = 0; i < limit; i += 1) {
    const swapIndex = i + Math.floor(random() * (pool.length - i))
    ;[pool[i], pool[swapIndex]] = [pool[swapIndex], pool[i]]
  }
  return pool.slice(0, limit)
}

export function normalizeSettings(settings: GenerationSettings): GenerationSettings {
  const cols = clamp(Math.round(settings.cols), 6, 36)
  const rows = clamp(Math.round(settings.rows), 6, 28)
  const minePercent = clamp(Math.round(settings.minePercent), 8, 38)
  const cellCount = cols * rows
  const mineCount = clamp(Math.round((cellCount * minePercent) / 100), 1, cellCount - 1)
  const safeMax = cellCount - mineCount
  const minSafeStarts = clamp(Math.round(settings.minSafeStarts), 1, safeMax)
  return { cols, rows, minePercent, minSafeStarts }
}

function createTruthBoard(rows: number, cols: number, mineSet: Set<number>): CellTruth[] {
  const total = rows * cols
  const truth: CellTruth[] = new Array(total)

  for (let index = 0; index < total; index += 1) {
    const mine = mineSet.has(index)
    truth[index] = { mine, adjacentMines: 0 }
  }

  for (let index = 0; index < total; index += 1) {
    if (truth[index].mine) continue
    let adjacent = 0
    for (const neighbor of getNeighbors(index, rows, cols)) {
      if (truth[neighbor].mine) adjacent += 1
    }
    truth[index].adjacentMines = adjacent
  }

  return truth
}

function isSubset(small: number[], large: number[]): boolean {
  if (small.length > large.length) return false
  const lookup = new Set(large)
  return small.every((value) => lookup.has(value))
}

function difference(source: number[], toRemove: number[]): number[] {
  const removeSet = new Set(toRemove)
  return source.filter((value) => !removeSet.has(value))
}

function computeSafeStarts(
  truth: CellTruth[],
  rows: number,
  cols: number,
  initialStarts: Set<number>,
): Set<number> {
  const revealed = new Array(truth.length).fill(false)
  const flagged = new Array(truth.length).fill(false)
  const safeStarts = new Set(initialStarts)

  for (const start of initialStarts) revealed[start] = true

  const allSafeRevealed = () => truth.every((cell, index) => cell.mine || revealed[index])

  while (!allSafeRevealed()) {
    let progress = false

    for (let index = 0; index < truth.length; index += 1) {
      if (!revealed[index] || truth[index].mine) continue

      const neighbors = getNeighbors(index, rows, cols)
      const unknown = neighbors.filter((n) => !revealed[n] && !flagged[n])
      const flaggedCount = neighbors.filter((n) => flagged[n]).length
      const remainingMines = truth[index].adjacentMines - flaggedCount
      if (unknown.length === 0) continue

      if (remainingMines === 0) {
        for (const target of unknown) {
          if (!revealed[target]) {
            revealed[target] = true
            progress = true
          }
        }
      } else if (remainingMines === unknown.length) {
        for (const target of unknown) {
          if (!flagged[target]) {
            flagged[target] = true
            progress = true
          }
        }
      }
    }

    const constraints: Array<{ unknown: number[]; remaining: number }> = []
    for (let index = 0; index < truth.length; index += 1) {
      if (!revealed[index] || truth[index].mine) continue
      const neighbors = getNeighbors(index, rows, cols)
      const unknown = neighbors.filter((n) => !revealed[n] && !flagged[n]).sort((a, b) => a - b)
      if (unknown.length === 0) continue
      const flaggedCount = neighbors.filter((n) => flagged[n]).length
      const remaining = truth[index].adjacentMines - flaggedCount
      if (remaining < 0 || remaining > unknown.length) continue
      constraints.push({ unknown, remaining })
    }

    for (let i = 0; i < constraints.length; i += 1) {
      for (let j = i + 1; j < constraints.length; j += 1) {
        const a = constraints[i]
        const b = constraints[j]

        if (isSubset(a.unknown, b.unknown)) {
          const diff = difference(b.unknown, a.unknown)
          const minesDiff = b.remaining - a.remaining
          if (minesDiff === 0) {
            for (const target of diff) {
              if (!revealed[target] && !flagged[target]) {
                revealed[target] = true
                progress = true
              }
            }
          } else if (minesDiff === diff.length) {
            for (const target of diff) {
              if (!flagged[target]) {
                flagged[target] = true
                progress = true
              }
            }
          }
        }

        if (isSubset(b.unknown, a.unknown)) {
          const diff = difference(a.unknown, b.unknown)
          const minesDiff = a.remaining - b.remaining
          if (minesDiff === 0) {
            for (const target of diff) {
              if (!revealed[target] && !flagged[target]) {
                revealed[target] = true
                progress = true
              }
            }
          } else if (minesDiff === diff.length) {
            for (const target of diff) {
              if (!flagged[target]) {
                flagged[target] = true
                progress = true
              }
            }
          }
        }
      }
    }

    if (progress) continue

    const hintIndex = truth.findIndex((cell, index) => !cell.mine && !revealed[index])
    if (hintIndex === -1) break
    revealed[hintIndex] = true
    safeStarts.add(hintIndex)
  }

  return safeStarts
}

function revealCellRegion(cells: CellState[], rows: number, cols: number, startIndex: number): void {
  const queue = [startIndex]

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) continue

    const cell = cells[current]
    if (cell.revealed || cell.flagged) continue
    cell.revealed = true
    if (cell.adjacentMines > 0 || cell.mine) continue

    for (const neighbor of getNeighbors(current, rows, cols)) {
      const neighborCell = cells[neighbor]
      if (!neighborCell.revealed && !neighborCell.flagged && !neighborCell.mine) {
        queue.push(neighbor)
      }
    }
  }
}

export function checkWin(cells: CellState[]): boolean {
  const allSafeRevealed = cells.every((cell) => cell.mine || cell.revealed)
  const allMinesFlagged = cells.every((cell) => (cell.mine ? cell.flagged : !cell.flagged))
  return allSafeRevealed && allMinesFlagged
}

export function makeGame(settings: GenerationSettings, seed: number): GameState {
  const normalized = normalizeSettings(settings)
  const { cols, rows, minePercent, minSafeStarts } = normalized
  const random = mulberry32(seed)
  const total = rows * cols
  const mineCount = clamp(Math.round((total * minePercent) / 100), 1, total - 1)
  const allIndices = Array.from({ length: total }, (_, index) => index)

  const mineIndices = sampleWithoutReplacement(allIndices, mineCount, random)
  const mineSet = new Set(mineIndices)
  const truth = createTruthBoard(rows, cols, mineSet)
  const safeCandidates = allIndices.filter((index) => !mineSet.has(index))
  const initialStarts = new Set(sampleWithoutReplacement(safeCandidates, minSafeStarts, random))
  const safeStarts = computeSafeStarts(truth, rows, cols, initialStarts)

  const cells: CellState[] = truth.map((cell, index) => ({
    ...cell,
    revealed: safeStarts.has(index),
    flagged: false,
    start: safeStarts.has(index),
    exploded: false,
  }))

  return {
    cols,
    rows,
    mineCount,
    safeStartCount: safeStarts.size,
    seed,
    status: 'playing',
    cells,
  }
}

export function getMineTargetFromSettings(settings: GenerationSettings): number {
  const normalized = normalizeSettings(settings)
  const cellCount = normalized.cols * normalized.rows
  return clamp(Math.round((cellCount * normalized.minePercent) / 100), 1, cellCount - 1)
}

export function revealCell(previous: GameState, index: number): GameState {
  if (previous.status !== 'playing') return previous
  const target = previous.cells[index]
  if (!target || target.revealed || target.flagged) return previous

  const cells = previous.cells.map((cell) => ({ ...cell }))
  if (cells[index].mine) {
    for (const cell of cells) {
      if (cell.mine) cell.revealed = true
    }
    cells[index].exploded = true
    return { ...previous, cells, status: 'lost' }
  }

  revealCellRegion(cells, previous.rows, previous.cols, index)
  const status: GameStatus = checkWin(cells) ? 'won' : 'playing'
  return { ...previous, cells, status }
}

export function toggleFlag(previous: GameState, index: number): GameState {
  if (previous.status !== 'playing') return previous
  const target = previous.cells[index]
  if (!target || target.revealed) return previous

  const cells = previous.cells.map((cell, cellIndex) =>
    cellIndex === index ? { ...cell, flagged: !cell.flagged } : cell,
  )
  const status: GameStatus = checkWin(cells) ? 'won' : 'playing'
  return { ...previous, cells, status }
}

export function chordReveal(previous: GameState, index: number): GameState {
  if (previous.status !== 'playing') return previous
  const target = previous.cells[index]
  if (!target || !target.revealed || target.mine || target.adjacentMines === 0) return previous

  const neighbors = getNeighbors(index, previous.rows, previous.cols)
  const flaggedCount = neighbors.filter((neighbor) => previous.cells[neighbor].flagged).length
  if (flaggedCount !== target.adjacentMines) return previous

  const cells = previous.cells.map((cell) => ({ ...cell }))

  for (const neighbor of neighbors) {
    const cell = cells[neighbor]
    if (cell.revealed || cell.flagged) continue

    if (cell.mine) {
      for (const mineCell of cells) {
        if (mineCell.mine) mineCell.revealed = true
      }
      cell.exploded = true
      return { ...previous, cells, status: 'lost' }
    }

    revealCellRegion(cells, previous.rows, previous.cols, neighbor)
  }

  const status: GameStatus = checkWin(cells) ? 'won' : 'playing'
  return { ...previous, cells, status }
}

export function applyRightClick(previous: GameState, index: number): GameState {
  const target = previous.cells[index]
  if (!target) return previous
  if (target.revealed) return chordReveal(previous, index)
  return toggleFlag(previous, index)
}
