import type { LayoutPhaseResult } from '../../types'
import type { SmartMineSession } from '../types'
import { selectStartIndexRandom } from '../shared'

/**
 * Smart transaction decision tree (minimal reset):
 * 1. Simulated player starts by opening the guaranteed start cell (hint 0).
 * 2. Pressing "Next Mine Step" runs exactly one transaction tick.
 * 3. This minimal version does not pick cells, hints, or mines yet.
 * 4. It only advances step count and preserves current state.
 * 5. Future rules will be added incrementally from this baseline.
 */

/**
 * Creates the initial smart generation session for a layout.
 *
 * Why this exists:
 * - The UI and game engine need a stable, serializable session object before any steps run.
 * - It chooses the deterministic start cell for the seed and applies the smart generator's first invariant:
 *   start cell is assigned with adjacent hint value 0.
 * - It separates one-time setup from step execution so "Next Mine Step" can be called repeatedly
 *   without re-initializing state.
 */
export function initializeSmartMineSession(
  phase: LayoutPhaseResult,
  seed: number,
): SmartMineSession {
  const startIndex = selectStartIndexRandom(phase, seed ^ 0x9e3779b9)
  const assignedSet = new Set<number>(startIndex >= 0 ? [startIndex] : [])
  const hintAssignments = new Map<number, number>()
  if (startIndex >= 0) hintAssignments.set(startIndex, 0)
  return {
    system: 'smart',
    startIndex,
    assignedSet,
    hintAssignments,
    mineSet: new Set<number>(),
    stepCount: 0,
    seed,
    done: startIndex < 0,
    lastAction: startIndex >= 0 ? `assigned start @ ${startIndex} with hint 0` : 'no active start available',
  }
}

/**
 * Applies exactly one smart transaction step and returns the next session.
 *
 * Why this exists:
 * - The outside caller should not know generator internals; it only asks for "next step".
 * - This function is the single place where step-by-step smart logic evolves over time.
 * - Returning a new session (instead of mutating external state) keeps stepping predictable,
 *   easier to debug, and compatible with auto-step replay.
 */
export function advanceSmartMineSession(
  phase: LayoutPhaseResult,
  session: SmartMineSession,
): SmartMineSession {
  void phase
  return {
    ...session,
    stepCount: session.stepCount + 1,
    done: session.done,
    lastAction: `tx step ${session.stepCount + 1}: skeleton no-op`,
  }
}
