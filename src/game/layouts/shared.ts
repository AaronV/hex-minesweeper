import { getIndex, getNeighbors } from '../grid'

export interface CubeCoord {
  x: number
  y: number
  z: number
}

export function rowColToCube(row: number, col: number): CubeCoord {
  const q = col - ((row - (row & 1)) >> 1)
  const r = row
  const x = q
  const z = r
  const y = -x - z
  return { x, y, z }
}

export function subCube(a: CubeCoord, b: CubeCoord): CubeCoord {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

export function rotateCube60(cube: CubeCoord): CubeCoord {
  return { x: -cube.z, y: -cube.x, z: -cube.y }
}

export function rotateCubeSteps(cube: CubeCoord, steps: number): CubeCoord {
  let next = cube
  for (let i = 0; i < steps; i += 1) {
    next = rotateCube60(next)
  }
  return next
}

export function cubeDistance(cube: CubeCoord): number {
  return Math.max(Math.abs(cube.x), Math.abs(cube.y), Math.abs(cube.z))
}

export function cubeKey(cube: CubeCoord): string {
  return `${cube.x},${cube.y},${cube.z}`
}

export function compareCubeLex(a: CubeCoord, b: CubeCoord): number {
  if (a.x !== b.x) return a.x - b.x
  if (a.y !== b.y) return a.y - b.y
  return a.z - b.z
}

export function canonicalRotation(cube: CubeCoord, step: number): CubeCoord {
  let best = cube
  for (let k = step; k < 6; k += step) {
    const rotated = rotateCubeSteps(cube, k)
    if (compareCubeLex(rotated, best) < 0) best = rotated
  }
  return best
}

export function toPrimaryWedge(cube: CubeCoord, step: number): CubeCoord {
  let fallback = cube
  for (let k = 0; k < 6; k += step) {
    const rotated = rotateCubeSteps(cube, k)
    if (rotated.x > fallback.x) fallback = rotated
    if (rotated.x >= 0 && rotated.y <= 0 && rotated.z <= 0) return rotated
  }
  return fallback
}

export function enforceConnectivityFromSeed(
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

export function ensureMinimumActiveCells(
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
