export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff)
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function getIndex(row: number, col: number, cols: number): number {
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

export function sampleWithoutReplacement(values: number[], count: number, random: () => number): number[] {
  const pool = [...values]
  const limit = Math.min(count, pool.length)
  for (let i = 0; i < limit; i += 1) {
    const swapIndex = i + Math.floor(random() * (pool.length - i))
    ;[pool[i], pool[swapIndex]] = [pool[swapIndex], pool[i]]
  }
  return pool.slice(0, limit)
}

export function hashUnit(seed: number, a: number, b: number, c: number): number {
  let h = seed >>> 0
  h ^= Math.imul(a + 0x9e3779b9, 0x85ebca6b)
  h = (h << 13) | (h >>> 19)
  h ^= Math.imul(b + 0xc2b2ae35, 0x27d4eb2f)
  h = (h << 11) | (h >>> 21)
  h ^= Math.imul(c + 0x165667b1, 0x9e3779b1)
  return (h >>> 0) / 4294967296
}
