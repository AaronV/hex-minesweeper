import { getNeighbors, type GameState } from '../game'

export interface RevealAnimationState {
  remaining: number[]
  finalStatus: GameState['status']
}

export function buildRevealAnimation(
  previous: GameState,
  next: GameState,
  triggerIndex: number,
): { initial: GameState; animation: RevealAnimationState } | null {
  if (next.status === 'lost') return null

  const revealedSafes: number[] = []
  for (let index = 0; index < next.cells.length; index += 1) {
    const before = previous.cells[index]
    const after = next.cells[index]
    if (!before.active || after.mine) continue
    if (!before.revealed && after.revealed) revealedSafes.push(index)
  }

  if (revealedSafes.length < 2) return null

  const fallbackStart = revealedSafes[0]
  const isValidStart =
    triggerIndex >= 0 &&
    triggerIndex < next.cells.length &&
    next.cells[triggerIndex].active &&
    !next.cells[triggerIndex].mine
  const start = isValidStart ? triggerIndex : fallbackStart

  const distance = new Array<number>(next.cells.length).fill(Number.POSITIVE_INFINITY)
  const queue: number[] = [start]
  distance[start] = 0

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) continue
    for (const neighbor of getNeighbors(current, previous.rows, previous.cols)) {
      if (!next.cells[neighbor]?.active || next.cells[neighbor].mine) continue
      const candidateDistance = distance[current] + 1
      if (candidateDistance >= distance[neighbor]) continue
      distance[neighbor] = candidateDistance
      queue.push(neighbor)
    }
  }

  const orderedReveals = [...revealedSafes].sort((a, b) => {
    const distanceDelta = distance[a] - distance[b]
    if (Number.isFinite(distanceDelta) && distanceDelta !== 0) return distanceDelta
    return a - b
  })

  const [firstReveal, ...remainingReveals] = orderedReveals
  const cells = previous.cells.map((cell, index) =>
    index === firstReveal ? { ...next.cells[index], revealed: true } : { ...cell },
  )
  const initial: GameState = { ...next, cells, status: 'playing' }
  return { initial, animation: { remaining: remainingReveals, finalStatus: next.status } }
}
