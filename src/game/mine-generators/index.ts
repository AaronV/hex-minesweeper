import type { GenerationSettings, LayoutPhaseResult, MineGenerationSystem } from '../types'
import type {
  MineGenerator,
  MineGenerationCandidate,
  MineGenerationSession,
  SmartMineSession,
  WeightedMineSession,
} from './types'
import { smartMineGenerator } from './smart'
import { weightedMineGenerator } from './weighted'

type MineGeneratorRegistry = {
  smart: MineGenerator<SmartMineSession>
  weighted: MineGenerator<WeightedMineSession>
}

const generators: MineGeneratorRegistry = {
  smart: smartMineGenerator,
  weighted: weightedMineGenerator,
}

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
  system: MineGenerationSystem,
  settings: GenerationSettings,
  phase: LayoutPhaseResult,
  target: number,
  seed: number,
): MineGenerationCandidate {
  const session =
    system === 'smart'
      ? runSessionToCompletion(generators.smart, settings, phase, target, seed)
      : runSessionToCompletion(generators.weighted, settings, phase, target, seed)
  return { startIndex: session.startIndex, mineSet: session.mineSet }
}

export function initializeMineGenerationSession(
  system: MineGenerationSystem,
  phase: LayoutPhaseResult,
  seed: number,
): MineGenerationSession {
  return generators[system].initialize(phase, seed)
}

export function advanceMineGenerationSession(
  settings: GenerationSettings,
  phase: LayoutPhaseResult,
  target: number,
  session: MineGenerationSession,
): MineGenerationSession {
  if (session.system === 'smart') return generators.smart.step(settings, phase, target, session)
  return generators.weighted.step(settings, phase, target, session)
}

export type {
  MineGenerator,
  MineGenerationCandidate,
  MineGenerationSession,
  SmartMineSession,
  WeightedMineSession,
} from './types'
