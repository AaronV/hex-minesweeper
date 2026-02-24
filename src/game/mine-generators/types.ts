import type { GenerationSettings, LayoutPhaseResult, MineGenerationSystem } from '../types'

export interface MineGenerationCandidate {
  startIndex: number
  mineSet: Set<number>
}

export interface BaseMineGenerationSession {
  system: MineGenerationSystem
  startIndex: number
  mineSet: Set<number>
  messages: string[]
  stepCount: number
  seed: number
  lastAction: string
  done: boolean
}

export interface SmartMineSession extends BaseMineGenerationSession {
  system: 'smart'
  assignedSet: Set<number>
  hintAssignments: Map<number, number>
  candidateIndices: number[]
  currentTargetIndex: number
}

export interface WeightedMineSession extends BaseMineGenerationSession {
  system: 'weighted'
}

export type MineGenerationSession = SmartMineSession | WeightedMineSession

export interface MineGenerator<TSession extends MineGenerationSession = MineGenerationSession> {
  initialize: (phase: LayoutPhaseResult, seed: number) => TSession
  step: (
    settings: GenerationSettings,
    phase: LayoutPhaseResult,
    targetMineCount: number,
    session: TSession,
  ) => TSession
}
