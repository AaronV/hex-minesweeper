import type { GenerationSettings, LayoutPhaseResult } from '../types'
import type {
  MineGenerator,
  MineGenerationCandidate,
  MineGenerationSession,
} from './types'
import { smartMineGenerator } from './smart'

function runSessionToCompletion<TSession extends MineGenerationSession>(
  generator: MineGenerator<TSession>,
  settings: GenerationSettings,
  phase: LayoutPhaseResult,
  target: number,
  seed: number,
): TSession {
  let session = generator.initialize(phase, seed)
  const maxSteps = Math.max(1, phase.activeIndices.length * 4)
  for (let step = 0; step < maxSteps && !session.done; step += 1) {
    session = generator.step(settings, phase, target, session)
  }
  return session
}

export function generateMinesBySystem(
  settings: GenerationSettings,
  phase: LayoutPhaseResult,
  target: number,
  seed: number,
): MineGenerationCandidate {
  const session = runSessionToCompletion(smartMineGenerator, settings, phase, target, seed)
  return { startIndex: session.startIndex, mineSet: session.mineSet }
}

export function initializeMineGenerationSession(
  phase: LayoutPhaseResult,
  seed: number,
): MineGenerationSession {
  return smartMineGenerator.initialize(phase, seed)
}

export function advanceMineGenerationSession(
  settings: GenerationSettings,
  phase: LayoutPhaseResult,
  target: number,
  session: MineGenerationSession,
): MineGenerationSession {
  return smartMineGenerator.step(settings, phase, target, session)
}

export type {
  MineGenerator,
  MineGenerationCandidate,
  MineGenerationSession,
  SmartMineSession,
} from './types'
