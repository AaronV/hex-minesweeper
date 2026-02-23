// Compatibility barrel. Mine generators now live under ./mine-generators.
export {
  advanceMineGenerationSession,
  generateMinesBySystem,
  initializeMineGenerationSession,
} from './mine-generators'
export type { MineGenerationCandidate, MineGenerationSession, SmartMineSession } from './mine-generators'
