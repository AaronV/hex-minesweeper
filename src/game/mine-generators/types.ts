import type { MineGenerationSystem } from '../types'

export interface MineGenerationCandidate {
  startIndex: number
  mineSet: Set<number>
}

export interface BaseMineGenerationSession {
  system: MineGenerationSystem
  startIndex: number
  mineSet: Set<number>
  stepCount: number
  seed: number
  lastAction: string
  done: boolean
}

export interface SmartMineSession extends BaseMineGenerationSession {
  system: 'smart'
  assignedSet: Set<number>
  hintAssignments: Map<number, number>
}

export interface WeightedMineSession extends BaseMineGenerationSession {
  system: 'weighted'
}

export type MineGenerationSession = SmartMineSession | WeightedMineSession
