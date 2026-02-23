import { getIndex, getNeighbors, hashUnit } from '../grid'
import { rowColToCube, subCube, type CubeCoord } from './shared'

function addCube(a: CubeCoord, b: CubeCoord): CubeCoord {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}

function cubeToRowCol(cube: CubeCoord): { row: number; col: number } {
  const row = cube.z
  const col = cube.x + ((row - (row & 1)) >> 1)
  return { row, col }
}

// Reflect across the vertical mirror axis in pointy-top axial space.
function reflectAcrossVerticalAxis(relative: CubeCoord): CubeCoord {
  return { x: relative.y, y: relative.x, z: relative.z }
}

export function generateRorschachMask(
  rows: number,
  cols: number,
  propagation: number,
  seed: number,
): boolean[] {
  const leftActive = new Array<boolean>(rows * cols).fill(false)
  const centerCol = Math.floor(cols / 2)
  const centerRow = Math.floor(rows / 2)
  const centerIndex = getIndex(centerRow, centerCol, cols)
  const centerCube = rowColToCube(centerRow, centerCol)
  const spanX = Math.max(1, centerCol)
  const spanY = Math.max(1, Math.floor(rows / 2))

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col <= centerCol; col += 1) {
      const dx = (col - centerCol) / spanX
      const dy = (row - centerRow) / spanY
      const radius = Math.hypot(dx, dy)
      const curl = Math.sin((row * 0.62 + col * 0.91) * 0.7) * 0.08
      const noise = hashUnit(seed, row, col, propagation)
      const chance = (propagation / 100) * 0.45 + (1 - radius) * 0.64 + curl + noise * 0.22 - 0.54
      if (chance > 0) leftActive[getIndex(row, col, cols)] = true
    }
  }

  leftActive[centerIndex] = true
  const connectedLeft = new Array(leftActive.length).fill(false)
  const queue = [centerIndex]
  while (queue.length > 0) {
    const index = queue.shift()
    if (index === undefined || connectedLeft[index] || !leftActive[index]) continue
    const col = index % cols
    if (col > centerCol) continue
    connectedLeft[index] = true
    for (const neighbor of getNeighbors(index, rows, cols)) {
      const neighborCol = neighbor % cols
      if (neighborCol <= centerCol && !connectedLeft[neighbor] && leftActive[neighbor]) queue.push(neighbor)
    }
  }

  const full = new Array<boolean>(rows * cols).fill(false)
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col <= centerCol; col += 1) {
      const leftIndex = getIndex(row, col, cols)
      if (!connectedLeft[leftIndex]) continue
      full[leftIndex] = true
      const relative = subCube(rowColToCube(row, col), centerCube)
      const reflected = reflectAcrossVerticalAxis(relative)
      const mirrored = addCube(centerCube, reflected)
      const { row: mirrorRow, col: mirrorCol } = cubeToRowCol(mirrored)
      if (mirrorRow >= 0 && mirrorRow < rows && mirrorCol >= 0 && mirrorCol < cols) {
        full[getIndex(mirrorRow, mirrorCol, cols)] = true
      }
    }
  }

  return full
}
