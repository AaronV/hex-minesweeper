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

interface CubeCoord {
  x: number
  y: number
  z: number
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
  const snowflakeArms = settings.snowflakeArms <= 3 ? 3 : 6
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

function rowColToCube(row: number, col: number): CubeCoord {
  const q = col - ((row - (row & 1)) >> 1)
  const r = row
  const x = q
  const z = r
  const y = -x - z
  return { x, y, z }
}

function subCube(a: CubeCoord, b: CubeCoord): CubeCoord {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

function rotateCube60(cube: CubeCoord): CubeCoord {
  return { x: -cube.z, y: -cube.x, z: -cube.y }
}

function rotateCubeSteps(cube: CubeCoord, steps: number): CubeCoord {
  let next = cube
  for (let i = 0; i < steps; i += 1) {
    next = rotateCube60(next)
  }
  return next
}

function cubeDistance(cube: CubeCoord): number {
  return Math.max(Math.abs(cube.x), Math.abs(cube.y), Math.abs(cube.z))
}

function cubeKey(cube: CubeCoord): string {
  return `${cube.x},${cube.y},${cube.z}`
}

function hashUnit(seed: number, a: number, b: number, c: number): number {
  let h = seed >>> 0
  h ^= Math.imul(a + 0x9e3779b9, 0x85ebca6b)
  h = (h << 13) | (h >>> 19)
  h ^= Math.imul(b + 0xc2b2ae35, 0x27d4eb2f)
  h = (h << 11) | (h >>> 21)
  h ^= Math.imul(c + 0x165667b1, 0x9e3779b1)
  return (h >>> 0) / 4294967296
}

function compareCubeLex(a: CubeCoord, b: CubeCoord): number {
  if (a.x !== b.x) return a.x - b.x
  if (a.y !== b.y) return a.y - b.y
  return a.z - b.z
}

function canonicalRotation(cube: CubeCoord, step: number): CubeCoord {
  let best = cube
  for (let k = step; k < 6; k += step) {
    const rotated = rotateCubeSteps(cube, k)
    if (compareCubeLex(rotated, best) < 0) best = rotated
  }
  return best
}

function toPrimaryWedge(cube: CubeCoord, step: number): CubeCoord {
  let fallback = cube
  for (let k = 0; k < 6; k += step) {
    const rotated = rotateCubeSteps(cube, k)
    if (rotated.x > fallback.x) fallback = rotated
    if (rotated.x >= 0 && rotated.y <= 0 && rotated.z <= 0) return rotated
  }
  return fallback
}

function enforceConnectivityFromSeed(
  active: boolean[],
  rows: number,
  cols: number,
  startIndex: number,
): boolean[] {
  if (!active[startIndex]) return active
  const connected = new Array(active.length).fill(false)
  const queue = [startIndex]
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

function generateRorschachMask(
  rows: number,
  cols: number,
  propagation: number,
  seed: number,
): boolean[] {
  const leftActive = new Array<boolean>(rows * cols).fill(false)
  const midCol = Math.floor((cols - 1) / 2)
  const centerRow = Math.floor(rows / 2)
  const centerLeft = getIndex(centerRow, midCol, cols)
  const spanX = Math.max(1, midCol)
  const spanY = Math.max(1, Math.floor(rows / 2))

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col <= midCol; col += 1) {
      const dx = (col - midCol) / spanX
      const dy = (row - centerRow) / spanY
      const radius = Math.hypot(dx, dy)
      const curl = Math.sin((row * 0.62 + col * 0.91) * 0.7) * 0.08
      const noise = hashUnit(seed, row, col, propagation)
      const chance = (propagation / 100) * 0.45 + (1 - radius) * 0.64 + curl + noise * 0.22 - 0.54
      if (chance > 0) leftActive[getIndex(row, col, cols)] = true
    }
  }

  leftActive[centerLeft] = true
  const connectedLeft = new Array(leftActive.length).fill(false)
  const queue = [centerLeft]
  while (queue.length > 0) {
    const index = queue.shift()
    if (index === undefined || connectedLeft[index] || !leftActive[index]) continue
    const col = index % cols
    if (col > midCol) continue
    connectedLeft[index] = true
    for (const neighbor of getNeighbors(index, rows, cols)) {
      const neighborCol = neighbor % cols
      if (neighborCol <= midCol && !connectedLeft[neighbor] && leftActive[neighbor]) queue.push(neighbor)
    }
  }

  const full = new Array<boolean>(rows * cols).fill(false)
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col <= midCol; col += 1) {
      const leftIndex = getIndex(row, col, cols)
      if (!connectedLeft[leftIndex]) continue
      full[leftIndex] = true
      const mirrorCol = cols - 1 - col
      full[getIndex(row, mirrorCol, cols)] = true
    }
  }

  return full
}

function generateSnowflakeMask(
  rows: number,
  cols: number,
  propagation: number,
  arms: number,
  mapSize: number,
  seed: number,
): boolean[] {
  const active = new Array<boolean>(rows * cols).fill(false)
  const centerRow = Math.floor(rows / 2)
  const centerCol = Math.floor(cols / 2)
  const centerCube = rowColToCube(centerRow, centerCol)
  const step = arms === 6 ? 1 : 2
  const radiusLimit = mapSize + 2
  const orbitCache = new Map<string, boolean>()

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const index = getIndex(row, col, cols)
      const rel = subCube(rowColToCube(row, col), centerCube)
      const dist = cubeDistance(rel)
      if (dist > radiusLimit) continue

      const canonical = canonicalRotation(rel, step)
      const key = cubeKey(canonical)
      if (!orbitCache.has(key)) {
        const wedge = toPrimaryWedge(canonical, step)
        const wedgeDist = cubeDistance(wedge)
        const distNorm = wedgeDist / Math.max(1, radiusLimit)
        const lateral = Math.abs(wedge.y - wedge.z)
        const lateralRatio = lateral / Math.max(1, wedge.x + 1)
        const noise = hashUnit(seed, canonical.x, canonical.y, canonical.z)
        const chance =
          (propagation / 100) * 0.52 +
          (1 - distNorm) * 0.6 -
          lateralRatio * 0.52 +
          noise * 0.2 -
          0.44
        orbitCache.set(key, chance > 0)
      }
      active[index] = orbitCache.get(key) ?? false
    }
  }

  const centerIndex = getIndex(centerRow, centerCol, cols)
  active[centerIndex] = true
  return enforceConnectivityFromSeed(active, rows, cols, centerIndex)
}

function generateActiveMask(
  settings: GenerationSettings,
  rows: number,
  cols: number,
  seed: number,
): boolean[] {
  if (settings.mapShape === 'rorschach') {
    return generateRorschachMask(rows, cols, settings.propagation, seed)
  }
  return generateSnowflakeMask(rows, cols, settings.propagation, settings.snowflakeArms, settings.mapSize, seed)
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

interface SolverConstraint {
  unknown: number[]
  remaining: number
}

interface ComponentSolveResult {
  forcedSafe: number[]
  forcedMine: number[]
  hasSolution: boolean
}

function revealForSolver(
  truth: CellTruth[],
  rows: number,
  cols: number,
  revealed: boolean[],
  flagged: boolean[],
  startIndex: number,
): boolean {
  const queue = [startIndex]
  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) continue
    if (revealed[current] || flagged[current]) continue
    const cell = truth[current]
    if (!cell.active || cell.mine) return false
    revealed[current] = true
    if (cell.adjacentMines > 0) continue
    for (const neighbor of getNeighbors(current, rows, cols)) {
      const n = truth[neighbor]
      if (n.active && !n.mine && !revealed[neighbor] && !flagged[neighbor]) {
        queue.push(neighbor)
      }
    }
  }
  return true
}

function collectConstraints(
  truth: CellTruth[],
  rows: number,
  cols: number,
  revealed: boolean[],
  flagged: boolean[],
): SolverConstraint[] | null {
  const constraints: SolverConstraint[] = []
  for (let index = 0; index < truth.length; index += 1) {
    const cell = truth[index]
    if (!cell.active || !revealed[index] || cell.mine) continue
    const neighbors = getNeighbors(index, rows, cols).filter((neighbor) => truth[neighbor].active)
    const unknown = neighbors.filter((n) => !revealed[n] && !flagged[n]).sort((a, b) => a - b)
    if (unknown.length === 0) continue
    const flaggedCount = neighbors.filter((n) => flagged[n]).length
    const remaining = cell.adjacentMines - flaggedCount
    if (remaining < 0 || remaining > unknown.length) return null
    constraints.push({ unknown, remaining })
  }
  return constraints
}

function splitConstraintComponents(constraints: SolverConstraint[]): Array<{ cells: number[]; constraints: number[] }> {
  const byCell = new Map<number, number[]>()
  for (let i = 0; i < constraints.length; i += 1) {
    for (const cell of constraints[i].unknown) {
      const list = byCell.get(cell)
      if (list) list.push(i)
      else byCell.set(cell, [i])
    }
  }

  const visitedCells = new Set<number>()
  const visitedConstraints = new Set<number>()
  const components: Array<{ cells: number[]; constraints: number[] }> = []

  for (const startCell of byCell.keys()) {
    if (visitedCells.has(startCell)) continue
    const queueCells = [startCell]
    const queueConstraints: number[] = []
    const compCells: number[] = []
    const compConstraints: number[] = []

    while (queueCells.length > 0 || queueConstraints.length > 0) {
      const cell = queueCells.shift()
      if (cell !== undefined) {
        if (visitedCells.has(cell)) continue
        visitedCells.add(cell)
        compCells.push(cell)
        for (const constraintIndex of byCell.get(cell) ?? []) {
          if (!visitedConstraints.has(constraintIndex)) queueConstraints.push(constraintIndex)
        }
      }

      const constraintIndex = queueConstraints.shift()
      if (constraintIndex !== undefined) {
        if (visitedConstraints.has(constraintIndex)) continue
        visitedConstraints.add(constraintIndex)
        compConstraints.push(constraintIndex)
        for (const nextCell of constraints[constraintIndex].unknown) {
          if (!visitedCells.has(nextCell)) queueCells.push(nextCell)
        }
      }
    }

    components.push({
      cells: compCells.sort((a, b) => a - b),
      constraints: compConstraints.sort((a, b) => a - b),
    })
  }

  return components
}

function solveConstraintComponent(
  allConstraints: SolverConstraint[],
  componentCells: number[],
  componentConstraintIndexes: number[],
): ComponentSolveResult {
  const vars = componentCells
  const constraints = componentConstraintIndexes.map((i) => allConstraints[i])
  const assignment: Array<boolean | null> = new Array(vars.length).fill(null)
  const varIndex = new Map<number, number>()
  for (let i = 0; i < vars.length; i += 1) varIndex.set(vars[i], i)

  let solutionCount = 0
  const mineHits = new Array(vars.length).fill(0)
  const maxSolutions = 60000

  const recurse = (position: number) => {
    if (solutionCount > maxSolutions) return

    for (const constraint of constraints) {
      let assignedMines = 0
      let unknownLeft = 0
      for (const cell of constraint.unknown) {
        const idx = varIndex.get(cell)
        if (idx === undefined) continue
        const value = assignment[idx]
        if (value === null) unknownLeft += 1
        else if (value) assignedMines += 1
      }
      if (assignedMines > constraint.remaining) return
      if (assignedMines + unknownLeft < constraint.remaining) return
    }

    if (position >= vars.length) {
      for (const constraint of constraints) {
        let assignedMines = 0
        for (const cell of constraint.unknown) {
          const idx = varIndex.get(cell)
          if (idx !== undefined && assignment[idx]) assignedMines += 1
        }
        if (assignedMines !== constraint.remaining) return
      }
      solutionCount += 1
      for (let i = 0; i < vars.length; i += 1) {
        if (assignment[i]) mineHits[i] += 1
      }
      return
    }

    assignment[position] = false
    recurse(position + 1)
    assignment[position] = true
    recurse(position + 1)
    assignment[position] = null
  }

  recurse(0)
  if (solutionCount === 0 || solutionCount > maxSolutions) {
    return { forcedSafe: [], forcedMine: [], hasSolution: false }
  }

  const forcedSafe: number[] = []
  const forcedMine: number[] = []
  for (let i = 0; i < vars.length; i += 1) {
    if (mineHits[i] === 0) forcedSafe.push(vars[i])
    else if (mineHits[i] === solutionCount) forcedMine.push(vars[i])
  }
  return { forcedSafe, forcedMine, hasSolution: true }
}

function deterministicSolveFromStarts(
  truth: CellTruth[],
  rows: number,
  cols: number,
  initialStarts: Set<number>,
): boolean {
  const revealed = new Array(truth.length).fill(false)
  const flagged = new Array(truth.length).fill(false)

  for (const start of initialStarts) {
    if (!revealForSolver(truth, rows, cols, revealed, flagged, start)) return false
  }

  const allSafeRevealed = () => truth.every((cell, index) => !cell.active || cell.mine || revealed[index])

  while (!allSafeRevealed()) {
    const constraints = collectConstraints(truth, rows, cols, revealed, flagged)
    if (!constraints) return false
    if (constraints.length === 0) return false

    const components = splitConstraintComponents(constraints)
    let progress = false

    for (const component of components) {
      if (component.cells.length === 0) continue
      if (component.cells.length > 22) return false
      const solved = solveConstraintComponent(constraints, component.cells, component.constraints)
      if (!solved.hasSolution) return false

      for (const mineCell of solved.forcedMine) {
        if (!flagged[mineCell]) {
          flagged[mineCell] = true
          progress = true
        }
      }

      for (const safeCell of solved.forcedSafe) {
        if (!revealed[safeCell] && !flagged[safeCell]) {
          const ok = revealForSolver(truth, rows, cols, revealed, flagged, safeCell)
          if (!ok) return false
          progress = true
        }
      }
    }

    if (!progress) return false
  }

  return allSafeRevealed()
}

interface ShapePhaseResult {
  rows: number
  cols: number
  activeMask: boolean[]
  activeIndices: number[]
  startIndex: number
}

function selectStartCell(activeIndices: number[], rows: number, cols: number, random: () => number): number {
  if (activeIndices.length === 0) return -1
  const centerRow = Math.floor(rows / 2)
  const centerCol = Math.floor(cols / 2)
  const ranked = [...activeIndices].sort((a, b) => {
    const ar = Math.floor(a / cols)
    const ac = a % cols
    const br = Math.floor(b / cols)
    const bc = b % cols
    return Math.hypot(ar - centerRow, ac - centerCol) - Math.hypot(br - centerRow, bc - centerCol)
  })
  const band = ranked.slice(0, Math.max(1, Math.floor(ranked.length * 0.5)))
  const [picked] = sampleWithoutReplacement(band, 1, random)
  return picked ?? ranked[0]
}

function generateShapePhase(settings: GenerationSettings, seed: number): ShapePhaseResult {
  const { cols, rows } = getGridDimensions(settings)
  const total = rows * cols
  const allIndices = Array.from({ length: total }, (_, index) => index)
  const random = mulberry32(seed ^ 0x6f7a3c11)

  let activeMask: boolean[] = []
  for (let attempt = 0; attempt < 6; attempt += 1) {
    activeMask = generateActiveMask(settings, rows, cols, seed + attempt * 97)
    if (activeMask.filter(Boolean).length >= 12) break
  }
  if (settings.mapShape === 'rorschach') {
    activeMask = ensureMinimumActiveCells(activeMask, rows, cols, 12)
  }

  const activeIndices = allIndices.filter((index) => activeMask[index])
  const startIndex = selectStartCell(activeIndices, rows, cols, random)
  return { rows, cols, activeMask, activeIndices, startIndex }
}

function adjustMineCount(
  mineMask: boolean[],
  targetMineCount: number,
  eligible: number[],
  cols: number,
  startIndex: number,
  seed: number,
): boolean[] {
  const next = [...mineMask]
  const startRow = Math.floor(startIndex / cols)
  const startCol = startIndex % cols
  const currentCount = () => eligible.reduce((count, idx) => count + (next[idx] ? 1 : 0), 0)

  const score = (index: number) => {
    const row = Math.floor(index / cols)
    const col = index % cols
    const dist = Math.hypot(row - startRow, col - startCol)
    return dist * 0.8 + hashUnit(seed, row, col, 911) * 0.6
  }

  let count = currentCount()
  if (count < targetMineCount) {
    const addOrder = [...eligible].filter((i) => !next[i]).sort((a, b) => score(b) - score(a))
    for (const index of addOrder) {
      if (count >= targetMineCount) break
      next[index] = true
      count += 1
    }
  } else if (count > targetMineCount) {
    const removeOrder = [...eligible].filter((i) => next[i]).sort((a, b) => score(a) - score(b))
    for (const index of removeOrder) {
      if (count <= targetMineCount) break
      next[index] = false
      count -= 1
    }
  }

  return next
}

function generateMinesFromCA(
  settings: GenerationSettings,
  phase: ShapePhaseResult,
  targetMineCount: number,
  seed: number,
): Set<number> {
  const { rows, cols, activeMask, startIndex, activeIndices } = phase
  const startNeighbors = new Set(getNeighbors(startIndex, rows, cols).filter((n) => activeMask[n]))
  const safeZone = new Set<number>([startIndex, ...startNeighbors])
  const eligible = activeIndices.filter((index) => !safeZone.has(index))
  const mineMask = new Array<boolean>(rows * cols).fill(false)
  const startRow = Math.floor(startIndex / cols)
  const startCol = startIndex % cols

  const baseline = clamp(settings.minePercent / 100, 0.08, 0.38)
  for (const index of eligible) {
    const row = Math.floor(index / cols)
    const col = index % cols
    const dist = Math.hypot(row - startRow, col - startCol)
    const distNorm = dist / Math.max(2, settings.mapSize * 1.25)
    const localNoise = hashUnit(seed, row, col, settings.propagation)
    const mineScore = baseline * 0.72 + distNorm * 0.34 + localNoise * 0.42 - 0.44
    mineMask[index] = mineScore > 0
  }

  const iterations = 2 + Math.round(settings.propagation / 32)
  for (let step = 0; step < iterations; step += 1) {
    const next = [...mineMask]
    for (const index of eligible) {
      const neighbors = getNeighbors(index, rows, cols).filter((n) => activeMask[n] && !safeZone.has(n))
      const mineNeighbors = neighbors.reduce((count, n) => count + (mineMask[n] ? 1 : 0), 0)
      const jitter = hashUnit(seed + step * 101, index, mineNeighbors, settings.mapSize)
      const bornMin = settings.propagation > 60 ? 2 : 3
      const surviveMin = settings.propagation > 55 ? 1 : 2
      const surviveMax = settings.propagation > 70 ? 5 : 4

      if (mineMask[index]) {
        next[index] = mineNeighbors >= surviveMin && mineNeighbors <= surviveMax
      } else {
        next[index] = mineNeighbors >= bornMin && mineNeighbors <= 4 && jitter > 0.34
      }
    }
    for (const safeIndex of safeZone) next[safeIndex] = false
    for (let i = 0; i < mineMask.length; i += 1) mineMask[i] = next[i]
  }

  const normalized = adjustMineCount(mineMask, targetMineCount, eligible, cols, startIndex, seed)
  const mineSet = new Set<number>()
  for (const index of eligible) {
    if (normalized[index]) mineSet.add(index)
  }
  return mineSet
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
  const phase = generateShapePhase(normalized, seed)
  const { rows, cols, activeMask, activeIndices, startIndex } = phase
  const targetMineCount = clamp(
    Math.round((activeIndices.length * normalized.minePercent) / 100),
    1,
    Math.max(1, activeIndices.length - 1),
  )
  let mineCount = targetMineCount
  let mineSet = new Set<number>()
  let truth: CellTruth[] = createTruthBoard(rows, cols, mineSet, activeMask)
  let solved = false

  for (let currentMineCount = targetMineCount; currentMineCount >= 1 && !solved; currentMineCount -= 1) {
    for (let attempt = 0; attempt < 36; attempt += 1) {
      const caSeed = seed + currentMineCount * 4099 + attempt * 811
      mineSet = generateMinesFromCA(normalized, phase, currentMineCount, caSeed)
      truth = createTruthBoard(rows, cols, mineSet, activeMask)
      if (deterministicSolveFromStarts(truth, rows, cols, new Set([startIndex]))) {
        mineCount = currentMineCount
        solved = true
        break
      }
    }
  }

  if (!solved) {
    mineCount = 0
    mineSet = new Set<number>()
    truth = createTruthBoard(rows, cols, mineSet, activeMask)
  }

  const cells: CellState[] = truth.map((cell, index) => ({
    ...cell,
    revealed: false,
    flagged: false,
    start: cell.active ? index === startIndex : false,
    exploded: false,
  }))

  return {
    cols,
    rows,
    mineCount,
    safeStartCount: 1,
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
  const hasAnyRevealed = previous.cells.some((cell) => cell.active && cell.revealed)
  if (!hasAnyRevealed && !target.start) return previous

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
