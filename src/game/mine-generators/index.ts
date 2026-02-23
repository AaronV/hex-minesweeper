import type { GenerationSettings, LayoutPhaseResult, MineGenerationSystem } from '../types'
import {
  advanceSmartMineSession,
  initializeSmartMineSession,
} from './smart'
import {
  advanceWeightedMineSession,
  generateMinesWeighted,
  initializeWeightedMineSession,
} from './weighted'
import type {
  MineGenerationCandidate,
  MineGenerationSession,
} from './types'

export function generateMinesBySystem(
  system: MineGenerationSystem,
  settings: GenerationSettings,
  phase: LayoutPhaseResult,
  target: number,
  seed: number,
): MineGenerationCandidate {
  if (system === 'smart') {
    void settings
    void target
    const session = initializeSmartMineSession(phase, seed)
    return { startIndex: session.startIndex, mineSet: new Set<number>() }
  }
  return generateMinesWeighted(settings, phase, target, seed)
}

export function initializeMineGenerationSession(
  system: MineGenerationSystem,
  phase: LayoutPhaseResult,
  seed: number,
): MineGenerationSession {
  if (system === 'smart') return initializeSmartMineSession(phase, seed)
  return initializeWeightedMineSession(phase, seed)
}

export function advanceMineGenerationSession(
  settings: GenerationSettings,
  phase: LayoutPhaseResult,
  target: number,
  session: MineGenerationSession,
): MineGenerationSession {
  if (session.system === 'smart') {
    return advanceSmartMineSession(phase, session)
  }
  return advanceWeightedMineSession(settings, phase, target, session)
}

export type {
  MineGenerationCandidate,
  MineGenerationSession,
  SmartMineSession,
  WeightedMineSession,
} from './types'
