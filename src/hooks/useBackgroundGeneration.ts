import { useCallback, useEffect, useRef, useState } from 'react'
import {
  advanceMineGeneration,
  type GameState,
  type GenerationSettings,
  type LayoutPhaseResult,
  type MineGenerationSession,
  generateLayoutOnly,
} from '../game'

interface GenerationProgress {
  assigned: number
  total: number
}

export interface BackgroundGenerationResult {
  seed: number
  phase: LayoutPhaseResult
  session: MineGenerationSession
  game: GameState
}

function getAssignedCount(session: MineGenerationSession | null): number {
  if (!session) return 0
  return session.assignedSet.size
}

export function useBackgroundGeneration() {
  const [progress, setProgress] = useState<GenerationProgress | null>(null)
  const runIdRef = useRef(0)

  const cancel = useCallback(() => {
    runIdRef.current += 1
    setProgress(null)
  }, [])

  const start = useCallback(
    (settings: GenerationSettings, seed: number, onComplete: (result: BackgroundGenerationResult) => void) => {
      const runId = runIdRef.current + 1
      runIdRef.current = runId

      const { phase } = generateLayoutOnly(settings, seed)
      const total = Math.max(1, phase.activeIndices.length)
      setProgress({ assigned: 0, total })

      const stepsPerFrame = 12
      let session: MineGenerationSession | null = null
      let finalGame: GameState | null = null

      const runFrame = () => {
        if (runIdRef.current !== runId) return

        let latestSession = session
        let latestGame: GameState | null = null
        for (let step = 0; step < stepsPerFrame; step += 1) {
          const stepOffset = latestSession ? latestSession.stepCount + 1 : 1
          const stepSeed = (seed + stepOffset) >>> 0
          const next = advanceMineGeneration(settings, phase, seed, latestSession, stepSeed)
          latestSession = next.session
          latestGame = next.game
          if (latestSession.done) break
        }

        session = latestSession
        setProgress({ assigned: getAssignedCount(latestSession), total })
        if (latestGame) finalGame = latestGame

        if (latestSession?.done && finalGame) {
          if (runIdRef.current !== runId) return
          setProgress(null)
          onComplete({ seed, phase, session: latestSession, game: finalGame })
          return
        }

        window.requestAnimationFrame(runFrame)
      }

      window.requestAnimationFrame(runFrame)
    },
    [],
  )

  useEffect(
    () => () => {
      runIdRef.current += 1
    },
    [],
  )

  return {
    progress,
    start,
    cancel,
    isRunning: progress !== null,
  }
}
