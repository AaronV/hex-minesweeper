import type { GenerationSettings, LayoutPhaseResult, MineGenerationSession } from '../types'
import { generator } from './generator'
import type {
  MineGenerationCandidate,
} from './types'

function runSessionToCompletion(
  settings: GenerationSettings,
  phase: LayoutPhaseResult,
  target: number,
  seed: number,
): MineGenerationSession {
  let session = generator.initialize(phase, seed)
  const maxSteps = Math.max(1, phase.activeIndices.length * 4)
  for (let step = 0; step < maxSteps && !session.done; step += 1) {
    session = generator.step(settings, phase, target, session)
  }
  return session
}

export function generateMinesForTarget(
  settings: GenerationSettings,
  phase: LayoutPhaseResult,
  target: number,
  seed: number,
): MineGenerationCandidate {
  const session = runSessionToCompletion(settings, phase, target, seed)
  return { startIndex: session.startIndex, mineSet: session.mineSet, hintAssignments: session.hintAssignments }
}

export function initializeGenerationSession(
  phase: LayoutPhaseResult,
  seed: number,
): MineGenerationSession {
  return generator.initialize(phase, seed)
}

export function advanceGenerationSession(
  settings: GenerationSettings,
  phase: LayoutPhaseResult,
  target: number,
  session: MineGenerationSession,
): MineGenerationSession {
  return generator.step(settings, phase, target, session)
}

export type {
  MineGenerator,
  MineGenerationCandidate,
} from './types'
export type { MineGenerationSession } from '../types'
