import { getIndex, getNeighbors, hashUnit } from './grid'
import { getGridDimensions } from './settings'
import type { GenerationSettings, ShapePhaseResult } from './types'

interface CubeCoord {
  x: number
  y: number
  z: number
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
  if (settings.mapShape === 'rectangle') {
    return new Array<boolean>(rows * cols).fill(true)
  }
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

export function generateShapePhase(settings: GenerationSettings, seed: number): ShapePhaseResult {
  const { cols, rows } = getGridDimensions(settings)
  const total = rows * cols
  const allIndices = Array.from({ length: total }, (_, index) => index)

  let activeMask = generateActiveMask(settings, rows, cols, seed)
  activeMask = ensureMinimumActiveCells(activeMask, rows, cols, 12)

  const activeIndices = allIndices.filter((index) => activeMask[index])
  return { rows, cols, activeMask, activeIndices, startIndex: -1 }
}
