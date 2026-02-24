import { useCallback, useEffect, useRef, useState } from 'react'
import { BoardCanvas } from './components/BoardCanvas'
import { ControlPanel, type WorkflowStage } from './components/ControlPanel'
import {
  advanceMineGeneration,
  applyRightClick,
  DEFAULT_SETTINGS,
  generateLayoutOnly,
  generateMinesForLayout,
  type GameState,
  type MineGenerationSession,
  normalizeSettings,
  randomSeed,
  revealCell,
  type GenerationSettings,
  type LayoutPhaseResult,
} from './game'

function parseSeed(seedText: string): number | null {
  const trimmed = seedText.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return null
  const normalized = Math.floor(Math.abs(parsed)) >>> 0
  return normalized
}

function getAssignedCount(session: MineGenerationSession | null): number {
  if (!session) return 0
  return session.system === 'smart' ? session.assignedSet.size : 0
}

const INITIAL_SETTINGS: GenerationSettings = DEFAULT_SETTINGS
const INITIAL_LAYOUT_SEED = randomSeed()
const INITIAL_SEED_TEXT = String(INITIAL_LAYOUT_SEED)
const INITIAL_LAYOUT = generateLayoutOnly(INITIAL_SETTINGS, INITIAL_LAYOUT_SEED)
const INITIAL_GAME = generateMinesForLayout(
  INITIAL_SETTINGS,
  INITIAL_LAYOUT.phase,
  INITIAL_LAYOUT_SEED,
  (INITIAL_LAYOUT_SEED + 4099) >>> 0,
)

function App() {
  const [settings, setSettings] = useState<GenerationSettings>(INITIAL_SETTINGS)
  const [seedText, setSeedText] = useState<string>(INITIAL_SEED_TEXT)
  const [stage, setStage] = useState<WorkflowStage>('play')
  const [layoutPhase, setLayoutPhase] = useState<LayoutPhaseResult | null>(INITIAL_LAYOUT.phase)
  const [layoutSeed, setLayoutSeed] = useState<number>(INITIAL_LAYOUT_SEED)
  const [mineGenerationSession, setMineGenerationSession] = useState<MineGenerationSession | null>(null)
  const [isMineAutoStepping, setIsMineAutoStepping] = useState(false)
  const [game, setGame] = useState<GameState | null>(INITIAL_GAME)
  const [undoGame, setUndoGame] = useState<GameState | null>(null)
  const [xrayMode, setXrayMode] = useState(false)
  const [debugToolsEnabled, setDebugToolsEnabled] = useState(false)
  const [generationProgress, setGenerationProgress] = useState<{ assigned: number; total: number } | null>(null)
  const backgroundGenerationRunIdRef = useRef(0)
  const canGenerateMines = layoutPhase !== null

  const cancelBackgroundGeneration = useCallback(() => {
    backgroundGenerationRunIdRef.current += 1
    setGenerationProgress(null)
  }, [])

  const startNonDebugGeneration = useCallback((nextSettings: GenerationSettings, seed: number) => {
    const runId = backgroundGenerationRunIdRef.current + 1
    backgroundGenerationRunIdRef.current = runId

    const { phase } = generateLayoutOnly(nextSettings, seed)
    const total = Math.max(1, phase.activeIndices.length)

    setStage('setup')
    setUndoGame(null)
    setIsMineAutoStepping(false)
    setMineGenerationSession(null)
    setGenerationProgress({ assigned: 0, total })

    const stepsPerFrame = 12
    let session: MineGenerationSession | null = null
    let finalGame: GameState | null = null

    const runFrame = () => {
      if (backgroundGenerationRunIdRef.current !== runId) return

      let latestSession = session
      let latestGame: GameState | null = null
      for (let step = 0; step < stepsPerFrame; step += 1) {
        const stepOffset = latestSession ? latestSession.stepCount + 1 : 1
        const stepSeed = (seed + stepOffset) >>> 0
        const result = advanceMineGeneration(nextSettings, phase, seed, latestSession, stepSeed)
        latestSession = result.session
        latestGame = result.game
        if (latestSession.done) break
      }

      session = latestSession
      setGenerationProgress({ assigned: getAssignedCount(latestSession), total })
      if (latestGame) finalGame = latestGame

      if (latestSession?.done) {
        if (backgroundGenerationRunIdRef.current !== runId) return
        if (finalGame) {
          setLayoutSeed(seed)
          setLayoutPhase(phase)
          setMineGenerationSession(latestSession)
          setGame(finalGame)
        }
        setStage('play')
        setGenerationProgress(null)
        return
      }
      window.requestAnimationFrame(runFrame)
    }

    window.requestAnimationFrame(runFrame)
  }, [])

  const onSettingsChange = useCallback((partial: Partial<GenerationSettings>) => {
    const next = normalizeSettings({ ...settings, ...partial })
    const seed = parseSeed(seedText) ?? randomSeed()
    setSettings(next)
    if (debugToolsEnabled) {
      cancelBackgroundGeneration()
      const { phase, game: layoutGame } = generateLayoutOnly(next, seed)
      setLayoutSeed(seed)
      setLayoutPhase(phase)
      setMineGenerationSession(null)
      setGame(layoutGame)
      setStage('layout')
      setUndoGame(null)
      setIsMineAutoStepping(false)
      return
    }
    startNonDebugGeneration(next, seed)
  }, [cancelBackgroundGeneration, debugToolsEnabled, seedText, settings, startNonDebugGeneration])

  const onGenerateLayout = useCallback(() => {
    cancelBackgroundGeneration()
    const seed = randomSeed()
    const { phase, game: layoutGame } = generateLayoutOnly(settings, seed)
    setSeedText(String(seed))
    setLayoutSeed(seed)
    setLayoutPhase(phase)
    setMineGenerationSession(null)
    setGame(layoutGame)
    setStage('layout')
    setUndoGame(null)
    setIsMineAutoStepping(false)
  }, [cancelBackgroundGeneration, settings])

  const onGenerateBoardQuick = useCallback(() => {
    const nextSeed = randomSeed()
    setSeedText(String(nextSeed))
    startNonDebugGeneration(settings, nextSeed)
  }, [settings, startNonDebugGeneration])

  const onGenerateMines = useCallback(() => {
    if (!layoutPhase) return
    const baseSeed = parseSeed(seedText)
    const stepOffset = mineGenerationSession ? mineGenerationSession.stepCount + 1 : 1
    const result = advanceMineGeneration(
      settings,
      layoutPhase,
      layoutSeed,
      mineGenerationSession,
      baseSeed !== null ? (baseSeed + stepOffset) >>> 0 : randomSeed(),
    )
    setMineGenerationSession(result.session)
    setGame(result.game)
    setStage('mines')
    setUndoGame(null)
    if (result.session.done) {
      setIsMineAutoStepping(false)
    }
  }, [layoutPhase, layoutSeed, mineGenerationSession, seedText, settings])

  const onStartPlaying = useCallback(() => {
    if (!game) return
    setStage('play')
    setUndoGame(null)
    setIsMineAutoStepping(false)
  }, [game])

  const onToggleMineAutoStep = useCallback(() => {
    if (!canGenerateMines) return
    setIsMineAutoStepping((previous) => !previous)
  }, [canGenerateMines])

  useEffect(() => () => {
    backgroundGenerationRunIdRef.current += 1
  }, [])

  useEffect(() => {
    if (!isMineAutoStepping) return
    if (stage !== 'mines' && stage !== 'layout') return
    if (!canGenerateMines) return
    if (mineGenerationSession?.done) return

    const id = window.setInterval(() => {
      onGenerateMines()
    }, 100)
    return () => window.clearInterval(id)
  }, [canGenerateMines, isMineAutoStepping, mineGenerationSession?.done, onGenerateMines, stage])

  const applyMove = useCallback((move: (previous: GameState) => GameState) => {
    setGame((previous) => {
      if (!previous) return previous
      const next = move(previous)
      if (next !== previous) setUndoGame(previous)
      return next
    })
  }, [])

  const onReveal = useCallback(
    (index: number) => {
      if (stage !== 'play') return
      applyMove((previous) => revealCell(previous, index))
    },
    [applyMove, stage],
  )

  const onRightClick = useCallback(
    (index: number) => {
      if (stage !== 'play') return
      applyMove((previous) => applyRightClick(previous, index))
    },
    [applyMove, stage],
  )

  const onUndo = useCallback(() => {
    if (stage !== 'play') return
    setUndoGame((previousUndo) => {
      if (!previousUndo) return previousUndo
      setGame(previousUndo)
      return null
    })
  }, [stage])

  const generationComplete =
    stage === 'mines' &&
    mineGenerationSession !== null &&
    (mineGenerationSession.system === 'smart'
      ? layoutPhase !== null && mineGenerationSession.assignedSet.size >= layoutPhase.activeIndices.length
      : mineGenerationSession.done)
  const canStartPlaying =
    stage === 'mines' &&
    game !== null &&
    generationComplete &&
    game.mineCount > 0 &&
    game.generationReport.noGuessSolvePassed
  const effectiveXrayMode = debugToolsEnabled ? (stage !== 'play' ? true : xrayMode) : false
  const generationMessages = game?.generationReport.messageLog ?? []
  const progressVisible = !debugToolsEnabled && generationProgress !== null
  const progressRatio = progressVisible
    ? Math.max(0, Math.min(1, generationProgress.assigned / generationProgress.total))
    : 0

  return (
    <>
      <ControlPanel
        settings={settings}
        seedText={seedText}
        game={game}
        stage={stage}
        debugToolsEnabled={debugToolsEnabled}
        xrayMode={effectiveXrayMode}
        canUndo={undoGame !== null}
        canGenerateMines={canGenerateMines}
        canStartPlaying={canStartPlaying}
        isMineAutoStepping={isMineAutoStepping}
        mineStepCount={mineGenerationSession?.stepCount ?? 0}
        onGenerateBoardQuick={onGenerateBoardQuick}
        onGenerateLayout={onGenerateLayout}
        onGenerateMines={onGenerateMines}
        onStartPlaying={onStartPlaying}
        onToggleDebugTools={() => setDebugToolsEnabled((previous) => !previous)}
        onToggleMineAutoStep={onToggleMineAutoStep}
        onUndo={onUndo}
        onToggleXrayMode={setXrayMode}
        onSeedTextChange={setSeedText}
        onSettingsChange={onSettingsChange}
      />
      <BoardCanvas
        game={game}
        xrayMode={effectiveXrayMode}
        interactive={stage === 'play'}
        onReveal={onReveal}
        onRightClick={onRightClick}
      />
      {progressVisible ? (
        <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center">
          <div className="w-[min(92vw,460px)] rounded-xl border border-slate-300 bg-white/95 px-5 py-4 text-slate-800 shadow-2xl backdrop-blur-sm">
            <div className="mb-2 text-sm font-semibold">Generating Level</div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full w-full origin-left bg-emerald-600 transition-transform duration-100"
                style={{ transform: `scaleX(${progressRatio})` }}
              />
            </div>
            <div className="mt-2 text-right text-xs text-slate-600">
              {generationProgress.assigned}/{generationProgress.total} cells assigned
            </div>
          </div>
        </div>
      ) : null}
      {debugToolsEnabled ? (
        <div className="fixed bottom-3 right-3 z-10 w-[560px] rounded-lg border border-slate-300/90 bg-white/88 p-3 text-left text-slate-700 shadow-lg backdrop-blur-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-wide text-slate-900">Mine Messages</h2>
            <span className="text-[11px] text-slate-500">{generationMessages.length}</span>
          </div>
          <div className="max-h-44 overflow-y-auto rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-700">
            {generationMessages.length > 0 ? (
              <ul className="space-y-1">
                {[...generationMessages].reverse().map((message, index) => (
                  <li key={`${index}:${message}`} className="whitespace-pre-wrap">
                    {message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500">No generator messages yet.</p>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}

export default App
