import type { GenerationSettings, LayoutPhaseResult } from '../types'

export interface MineGenerationCandidate {
  startIndex: number
  mineSet: Set<number>
}

export interface BaseMineGenerationSession {
  system: 'smart'
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

export type MineGenerationSession = SmartMineSession

export interface MineGenerator<TSession extends SmartMineSession = SmartMineSession> {
  initialize: (phase: LayoutPhaseResult, seed: number) => TSession
  step: (
    settings: GenerationSettings,
    phase: LayoutPhaseResult,
    targetMineCount: number,
    session: TSession,
  ) => TSession
}
