import { getIndex, hashUnit } from '../grid'
import {
  canonicalRotation,
  cubeDistance,
  cubeKey,
  enforceConnectivityFromSeed,
  rowColToCube,
  subCube,
  toPrimaryWedge,
} from './shared'

export function generateSnowflakeMask(
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
