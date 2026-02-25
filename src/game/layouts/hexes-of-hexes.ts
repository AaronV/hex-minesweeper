import { getNeighbors, hashUnit } from '../grid'
import { getAxisConstraintCells } from '../hint-constraints'
import type { AxisPair } from '../types'
import { rowColToCube, type CubeCoord } from './shared'

function cubeToRowCol(cube: CubeCoord): { row: number; col: number } {
  const row = cube.z
  const col = cube.x + ((row - (row & 1)) >> 1)
  return { row, col }
}

function diameterToRadius(diameter: number): number {
  const clamped = Math.max(1, Math.min(6, Math.round(diameter)))
  // True hex diameters are odd in this coordinate system; map even values up.
  const normalizedDiameter = clamped % 2 === 0 ? clamped + 1 : clamped
  return Math.max(0, Math.floor((normalizedDiameter - 1) / 2))
}

function collectIslandCells(centerIndex: number, radius: number, rows: number, cols: number): number[] {
  const centerRow = Math.floor(centerIndex / cols)
  const centerCol = centerIndex % cols
  const centerCube = rowColToCube(centerRow, centerCol)
  const cells: number[] = []

  for (let dx = -radius; dx <= radius; dx += 1) {
    const minDy = Math.max(-radius, -dx - radius)
    const maxDy = Math.min(radius, -dx + radius)
    for (let dy = minDy; dy <= maxDy; dy += 1) {
      const dz = -dx - dy
      const cube: CubeCoord = {
        x: centerCube.x + dx,
        y: centerCube.y + dy,
        z: centerCube.z + dz,
      }
      const { row, col } = cubeToRowCol(cube)
      if (row < 0 || row >= rows || col < 0 || col >= cols) return []
      cells.push(row * cols + col)
    }
  }
  return cells
}

function tryPlaceIsland(
  active: boolean[],
  blocked: boolean[],
  centerIndex: number,
  radius: number,
  rows: number,
  cols: number,
  requireOneGapConnection: boolean,
): boolean {
  const island = collectIslandCells(centerIndex, radius, rows, cols)
  if (island.length === 0) return false
  for (const index of island) {
    if (active[index] || blocked[index]) return false
  }
  if (requireOneGapConnection) {
    let connected = false
    for (const index of island) {
      for (const gapCell of getNeighbors(index, rows, cols)) {
        if (active[gapCell]) continue
        for (const next of getNeighbors(gapCell, rows, cols)) {
          if (active[next]) {
            connected = true
            break
          }
        }
        if (connected) break
      }
      if (connected) break
    }
    if (!connected) return false
  }

  for (const index of island) {
    active[index] = true
  }
  for (const index of island) {
    blocked[index] = true
    for (const neighbor of getNeighbors(index, rows, cols)) {
      blocked[neighbor] = true
    }
  }
  return true
}

function generateAttempt(
  rows: number,
  cols: number,
  propagation: number,
  seed: number,
  salt: number,
): { active: boolean[]; placedIslands: number; activeCells: number; noOrphans: boolean } {
  const total = rows * cols
  const active = new Array<boolean>(total).fill(false)
  const blocked = new Array<boolean>(total).fill(false)
  const islandCount = 3 + Math.floor(hashUnit(seed ^ 0x51f2c74d, rows + salt, cols, propagation) * 7)
  const attemptsPerIsland = Math.max(80, Math.floor((rows + cols) * 1.2))
  let placedIslands = 0

  for (let island = 0; island < islandCount; island += 1) {
    const rawDiameter = 1 + Math.floor(hashUnit(seed ^ 0x1ab35d79, island, salt, propagation) * 6)
    const preferredRadius = diameterToRadius(rawDiameter)
    let placed = false

    for (let radius = preferredRadius; radius >= 0 && !placed; radius -= 1) {
      for (let attempt = 0; attempt < attemptsPerIsland; attempt += 1) {
        const row = Math.floor(hashUnit(seed ^ 0x6c9e4a3b, island, salt, attempt + radius * 131) * rows)
        const col = Math.floor(hashUnit(seed ^ 0x7d3b5e11, island, salt * 17 + attempt, radius + 29) * cols)
        const centerIndex = row * cols + col
        const requireOneGapConnection = placedIslands > 0
        if (tryPlaceIsland(active, blocked, centerIndex, radius, rows, cols, requireOneGapConnection)) {
          placed = true
          placedIslands += 1
          break
        }
      }
    }
  }

  return {
    active,
    placedIslands,
    activeCells: active.filter(Boolean).length,
    noOrphans: hasNoOrphanIslands(active, rows, cols),
  }
}

function getComponentIndices(active: boolean[], rows: number, cols: number): Int32Array {
  const components = new Int32Array(active.length).fill(-1)
  let componentId = 0
  for (let index = 0; index < active.length; index += 1) {
    if (!active[index] || components[index] !== -1) continue
    const queue = [index]
    while (queue.length > 0) {
      const current = queue.shift()
      if (current === undefined || components[current] !== -1 || !active[current]) continue
      components[current] = componentId
      for (const neighbor of getNeighbors(current, rows, cols)) {
        if (active[neighbor] && components[neighbor] === -1) queue.push(neighbor)
      }
    }
    componentId += 1
  }
  return components
}

function hasNoOrphanIslands(active: boolean[], rows: number, cols: number): boolean {
  const components = getComponentIndices(active, rows, cols)
  const componentCount = components.reduce((max, value) => Math.max(max, value), -1) + 1
  if (componentCount <= 1) return true

  const visible = Array.from({ length: componentCount }, () => new Set<number>())
  const axes: AxisPair[] = [0, 1, 2]
  for (let index = 0; index < active.length; index += 1) {
    if (!active[index]) continue
    const sourceComponent = components[index]
    for (const axis of axes) {
      const scope = getAxisConstraintCells(index, axis, rows, cols, active)
      for (const target of scope) {
        const targetComponent = components[target]
        if (targetComponent < 0 || targetComponent === sourceComponent) continue
        visible[sourceComponent].add(targetComponent)
        visible[targetComponent].add(sourceComponent)
      }
    }
  }

  return visible.every((neighbors) => neighbors.size > 0)
}

export function generateHexesOfHexesMask(
  rows: number,
  cols: number,
  propagation: number,
  seed: number,
): boolean[] {
  let best: { active: boolean[]; placedIslands: number; activeCells: number; noOrphans: boolean } | null = null

  for (let salt = 0; salt < 20; salt += 1) {
    const candidate = generateAttempt(rows, cols, propagation, seed, salt)
    if (candidate.placedIslands >= 3 && candidate.noOrphans) return candidate.active
    if (
      !best ||
      (candidate.noOrphans && !best.noOrphans) ||
      (candidate.noOrphans === best.noOrphans && candidate.placedIslands > best.placedIslands) ||
      (candidate.noOrphans === best.noOrphans &&
        candidate.placedIslands === best.placedIslands &&
        candidate.activeCells > best.activeCells)
    ) {
      best = candidate
    }
  }

  return best?.active ?? new Array<boolean>(rows * cols).fill(false)
}
