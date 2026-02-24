import type { GenerationSettings, LayoutPhaseResult, MineGenerationSession } from '../types'

export interface MineGenerationCandidate {
  startIndex: number
  mineSet: Set<number>
}

export interface MineGenerator {
  initialize: (phase: LayoutPhaseResult, seed: number) => MineGenerationSession
  step: (
    settings: GenerationSettings,
    phase: LayoutPhaseResult,
    targetMineCount: number,
    session: MineGenerationSession,
  ) => MineGenerationSession
}
