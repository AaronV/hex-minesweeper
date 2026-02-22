export type GameStatus = 'playing' | 'won' | 'lost'
export type MapShape = 'rorschach' | 'snowflake'

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
  minePercent: number
  mapShape: MapShape
  propagation: number
  snowflakeArms: number
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
}

export const DEFAULT_SETTINGS: GenerationSettings = {
  mapSize: 14,
  minePercent: 20,
  mapShape: 'rorschach',
  propagation: 62,
  snowflakeArms: 6,
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

function getGridDimensions(settings: GenerationSettings): { cols: number; rows: number } {
  const size = settings.mapSize
  if (settings.mapShape === 'rorschach') {
    return { cols: size * 2 + 10, rows: size * 2 + 2 }
  }
  return { cols: size * 2 + 6, rows: size * 2 + 6 }
}

function estimateActiveRatio(settings: GenerationSettings): number {
  if (settings.mapShape === 'rorschach') {
    return clamp(0.28 + settings.propagation * 0.0038, 0.26, 0.66)
  }
  const armFactor = (settings.snowflakeArms - 3) * 0.028
  return clamp(0.26 + armFactor + settings.propagation * 0.0034, 0.24, 0.78)
}

export function estimatePlayableCells(settings: GenerationSettings): number {
  const { cols, rows } = getGridDimensions(settings)
  const total = cols * rows
  return Math.max(8, Math.round(total * estimateActiveRatio(settings)))
}

export function normalizeSettings(settings: GenerationSettings): GenerationSettings {
  const mapSize = clamp(Math.round(settings.mapSize), 8, 24)
  const minePercent = clamp(Math.round(settings.minePercent), 8, 38)
  const mapShape: MapShape = settings.mapShape ?? 'rorschach'
  const propagation = clamp(Math.round(settings.propagation), 20, 95)
  const snowflakeArms = clamp(Math.round(settings.snowflakeArms), 3, 6)
  const playableEstimate = estimatePlayableCells({
    mapSize,
    minePercent,
    mapShape,
    propagation,
    snowflakeArms,
  })
  const mineCount = clamp(Math.round((playableEstimate * minePercent) / 100), 1, playableEstimate - 1)
  void mineCount
  return { mapSize, minePercent, mapShape, propagation, snowflakeArms }
}

function getCellPoint(row: number, col: number, cols: number, rows: number): { x: number; y: number } {
  const x = col + (row % 2 === 0 ? 0.5 : 1) - cols / 2
  const y = row * 0.8660254038 - (rows - 1) * 0.4330127019
  return { x, y }
}

function generateRorschachMask(
  rows: number,
  cols: number,
  propagation: number,
  random: () => number,
): boolean[] {
  const total = rows * cols
  const active = new Array<boolean>(total).fill(false)
  const midCol = Math.floor((cols - 1) / 2)
  const centerRow = Math.floor(rows / 2)
  const centerLeft = getIndex(centerRow, midCol, cols)
  const queue: number[] = [centerLeft]
  const visited = new Set<number>()

  while (queue.length > 0) {
    const index = queue.shift()
    if (index === undefined || visited.has(index)) continue
    visited.add(index)

    const row = Math.floor(index / cols)
    const col = index % cols
    if (col > midCol) continue

    const { x, y } = getCellPoint(row, col, cols, rows)
    const radius = Math.sqrt(x * x + y * y)
    const radiusMax = Math.sqrt((cols / 2) ** 2 + (rows / 2) ** 2)
    const radiusNorm = radius / radiusMax
    const baseChance = propagation / 100
    const chance = baseChance * 0.42 + (1 - radiusNorm) * 0.44 + random() * 0.24 - 0.38

    if (chance > 0) {
      active[index] = true
      const mirrorCol = cols - 1 - col
      active[getIndex(row, mirrorCol, cols)] = true
    }

    for (const neighbor of getNeighbors(index, rows, cols)) {
      const neighborCol = neighbor % cols
      if (neighborCol <= midCol && !visited.has(neighbor)) queue.push(neighbor)
    }
  }

  return active
}

function carveMirroredVoids(
  active: boolean[],
  rows: number,
  cols: number,
  propagation: number,
  random: () => number,
): boolean[] {
  const next = [...active]
  const midCol = Math.floor((cols - 1) / 2)
  const strength = 1 - propagation / 100
  const voidCount = clamp(Math.round(2 + strength * 9), 2, 10)
  const baseRadius = clamp(Math.round(1 + strength * 3), 1, 4)

  for (let i = 0; i < voidCount; i += 1) {
    const centerRow = Math.floor(random() * rows)
    const centerCol = Math.floor(random() * (midCol + 1))
    const radius = Math.max(1, baseRadius + (random() > 0.65 ? 1 : 0))

    for (let row = centerRow - radius; row <= centerRow + radius; row += 1) {
      if (row < 0 || row >= rows) continue
      for (let col = centerCol - radius; col <= centerCol + radius; col += 1) {
        if (col < 0 || col > midCol) continue

        const distance = Math.hypot(row - centerRow, col - centerCol)
        const cutoff = radius - 0.3 + random() * 0.65
        if (distance > cutoff) continue

        const leftIndex = getIndex(row, col, cols)
        const mirrorCol = cols - 1 - col
        const rightIndex = getIndex(row, mirrorCol, cols)
        next[leftIndex] = false
        next[rightIndex] = false
      }
    }
  }

  return next
}

function generateSnowflakeMask(
  rows: number,
  cols: number,
  propagation: number,
  arms: number,
): boolean[] {
  const total = rows * cols
  const active = new Array<boolean>(total).fill(false)
  const maxRadius = Math.sqrt((cols / 2) ** 2 + (rows / 2) ** 2)
  const sector = (Math.PI * 2) / arms

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const index = getIndex(row, col, cols)
      const { x, y } = getCellPoint(row, col, cols, rows)
      const radius = Math.sqrt(x * x + y * y)
      const radiusNorm = radius / maxRadius
      if (radiusNorm > 1) continue

      const angle = Math.atan2(y, x) + Math.PI
      const inSector = (angle % sector) / sector
      const spoke = 1 - Math.abs(inSector - 0.5) * 2
      const chance =
        (propagation / 100) * 0.48 +
        spoke * 0.5 -
        radiusNorm * 0.6 +
        Math.sin(radiusNorm * 9 + inSector * 5.3) * 0.08 +
        Math.cos(radiusNorm * 13 - inSector * 4.2) * 0.045 -
        0.21

      active[index] = chance > 0
    }
  }

  return active
}

function enforceConnectivity(active: boolean[], rows: number, cols: number): boolean[] {
  const seeds = active.map((value, index) => ({ value, index })).filter((entry) => entry.value)
  if (seeds.length === 0) return active

  const start = seeds[Math.floor(seeds.length / 2)].index
  const connected = new Array(active.length).fill(false)
  const queue = [start]

  while (queue.length > 0) {
    const index = queue.shift()
    if (index === undefined || connected[index] || !active[index]) continue
    connected[index] = true
    for (const neighbor of getNeighbors(index, rows, cols)) {
      if (!connected[neighbor] && active[neighbor]) queue.push(neighbor)
    }
  }

  return connected
}

function generateActiveMask(
  settings: GenerationSettings,
  rows: number,
  cols: number,
  random: () => number,
): boolean[] {
  if (settings.mapShape === 'rorschach') {
    const raw = generateRorschachMask(rows, cols, settings.propagation, random)
    const carved = carveMirroredVoids(raw, rows, cols, settings.propagation, random)
    return enforceConnectivity(carved, rows, cols)
  }
  return enforceConnectivity(
    generateSnowflakeMask(rows, cols, settings.propagation, settings.snowflakeArms),
    rows,
    cols,
  )
}

function ensureMinimumActiveCells(
  activeMask: boolean[],
  rows: number,
  cols: number,
  minimum: number,
): boolean[] {
  const currentCount = activeMask.filter(Boolean).length
  if (currentCount >= minimum) return activeMask

  const next = [...activeMask]
  const center = getIndex(Math.floor(rows / 2), Math.floor(cols / 2), cols)
  const queue = [center]
  const visited = new Set<number>()

  while (queue.length > 0 && next.filter(Boolean).length < minimum) {
    const index = queue.shift()
    if (index === undefined || visited.has(index)) continue
    visited.add(index)
    next[index] = true

    for (const neighbor of getNeighbors(index, rows, cols)) {
      if (!visited.has(neighbor)) queue.push(neighbor)
    }
  }

  return next
}

function createTruthBoard(
  rows: number,
  cols: number,
  mineSet: Set<number>,
  activeMask: boolean[],
): CellTruth[] {
  const total = rows * cols
  const truth: CellTruth[] = new Array(total)

  for (let index = 0; index < total; index += 1) {
    const active = activeMask[index]
    truth[index] = { active, mine: active && mineSet.has(index), adjacentMines: 0 }
  }

  for (let index = 0; index < total; index += 1) {
    if (!truth[index].active || truth[index].mine) continue
    let adjacent = 0
    for (const neighbor of getNeighbors(index, rows, cols)) {
      if (truth[neighbor].active && truth[neighbor].mine) adjacent += 1
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

  const allSafeRevealed = () => truth.every((cell, index) => !cell.active || cell.mine || revealed[index])

  while (!allSafeRevealed()) {
    let progress = false

    for (let index = 0; index < truth.length; index += 1) {
      if (!truth[index].active || !revealed[index] || truth[index].mine) continue

      const neighbors = getNeighbors(index, rows, cols).filter((neighbor) => truth[neighbor].active)
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
      if (!truth[index].active || !revealed[index] || truth[index].mine) continue
      const neighbors = getNeighbors(index, rows, cols).filter((neighbor) => truth[neighbor].active)
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

    const hintIndex = truth.findIndex((cell, index) => cell.active && !cell.mine && !revealed[index])
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
    if (!cell.active || cell.revealed || cell.flagged) continue
    cell.revealed = true
    if (cell.adjacentMines > 0 || cell.mine) continue

    for (const neighbor of getNeighbors(current, rows, cols)) {
      const neighborCell = cells[neighbor]
      if (neighborCell.active && !neighborCell.revealed && !neighborCell.flagged && !neighborCell.mine) {
        queue.push(neighbor)
      }
    }
  }
}

export function checkWin(cells: CellState[]): boolean {
  const allSafeRevealed = cells.every((cell) => !cell.active || cell.mine || cell.revealed)
  const allMinesFlagged = cells.every((cell) =>
    !cell.active ? true : cell.mine ? cell.flagged : !cell.flagged,
  )
  return allSafeRevealed && allMinesFlagged
}

export function makeGame(settings: GenerationSettings, seed: number): GameState {
  const normalized = normalizeSettings(settings)
  const { cols, rows } = getGridDimensions(normalized)
  const { minePercent } = normalized
  const random = mulberry32(seed)
  const total = rows * cols
  const allIndices = Array.from({ length: total }, (_, index) => index)

  let activeMask: boolean[] = []
  for (let attempt = 0; attempt < 6; attempt += 1) {
    activeMask = generateActiveMask(normalized, rows, cols, random)
    if (activeMask.filter(Boolean).length >= 12) break
  }
  activeMask = ensureMinimumActiveCells(activeMask, rows, cols, 12)
  const activeIndices = allIndices.filter((index) => activeMask[index])

  const mineCount = clamp(Math.round((activeIndices.length * minePercent) / 100), 1, activeIndices.length - 1)
  const minSafeStarts = 1
  const mineIndices = sampleWithoutReplacement(activeIndices, mineCount, random)
  const mineSet = new Set(mineIndices)
  const truth = createTruthBoard(rows, cols, mineSet, activeMask)
  const safeCandidates = activeIndices.filter((index) => !mineSet.has(index))
  const initialStarts = new Set(sampleWithoutReplacement(safeCandidates, minSafeStarts, random))
  const safeStarts = computeSafeStarts(truth, rows, cols, initialStarts)

  const cells: CellState[] = truth.map((cell, index) => ({
    ...cell,
    revealed: cell.active ? safeStarts.has(index) : false,
    flagged: false,
    start: cell.active ? safeStarts.has(index) : false,
    exploded: false,
  }))

  return {
    cols,
    rows,
    mineCount,
    safeStartCount: safeStarts.size,
    activeCellCount: activeIndices.length,
    seed,
    status: 'playing',
    cells,
  }
}

export function getMineTargetFromSettings(settings: GenerationSettings): number {
  const normalized = normalizeSettings(settings)
  const estimatedPlayable = estimatePlayableCells(normalized)
  return clamp(Math.round((estimatedPlayable * normalized.minePercent) / 100), 1, estimatedPlayable - 1)
}

export function revealCell(previous: GameState, index: number): GameState {
  if (previous.status !== 'playing') return previous
  const target = previous.cells[index]
  if (!target || !target.active || target.revealed || target.flagged) return previous

  const cells = previous.cells.map((cell) => ({ ...cell }))
  if (cells[index].mine) {
    for (const cell of cells) {
      if (cell.active && cell.mine) cell.revealed = true
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
  if (!target || !target.active || target.revealed) return previous

  const cells = previous.cells.map((cell, cellIndex) =>
    cellIndex === index ? { ...cell, flagged: !cell.flagged } : cell,
  )
  const status: GameStatus = checkWin(cells) ? 'won' : 'playing'
  return { ...previous, cells, status }
}

export function chordReveal(previous: GameState, index: number): GameState {
  if (previous.status !== 'playing') return previous
  const target = previous.cells[index]
  if (!target || !target.active || !target.revealed || target.mine || target.adjacentMines === 0) return previous

  const neighbors = getNeighbors(index, previous.rows, previous.cols).filter(
    (neighbor) => previous.cells[neighbor].active,
  )
  const flaggedCount = neighbors.filter((neighbor) => previous.cells[neighbor].flagged).length
  if (flaggedCount !== target.adjacentMines) return previous

  const cells = previous.cells.map((cell) => ({ ...cell }))

  for (const neighbor of neighbors) {
    const cell = cells[neighbor]
    if (cell.revealed || cell.flagged) continue

    if (cell.mine) {
      for (const mineCell of cells) {
        if (mineCell.active && mineCell.mine) mineCell.revealed = true
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
  if (!target || !target.active) return previous
  if (target.revealed) return chordReveal(previous, index)
  return toggleFlag(previous, index)
}
