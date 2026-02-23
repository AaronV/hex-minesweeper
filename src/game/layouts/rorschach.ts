import { getIndex, getNeighbors, hashUnit } from '../grid'

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
      const mirrorCol = cols - 1 - col
      full[getIndex(row, mirrorCol, cols)] = true
    }
  }

  return full
}
