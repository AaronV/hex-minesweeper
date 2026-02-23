import { useCallback, useEffect, useState } from 'react'
import { BoardCanvas } from './components/BoardCanvas'
import { ControlPanel, type WorkflowStage } from './components/ControlPanel'
import {
  advanceMineGeneration,
  applyRightClick,
  DEFAULT_SETTINGS,
  generateLayoutOnly,
  type GameState,
  type MineGenerationSession,
  normalizeSettings,
  randomSeed,
  revealCell,
  type GenerationSettings,
  type LayoutPhaseResult,
} from './game'

const SETTINGS_STORAGE_KEY = 'hex-minesweeper:settings'
const SEED_STORAGE_KEY = 'hex-minesweeper:seed-text'

function loadInitialSettings(): GenerationSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<GenerationSettings>
    return normalizeSettings({ ...DEFAULT_SETTINGS, ...parsed })
  } catch {
    return DEFAULT_SETTINGS
  }
}

function loadInitialSeedText(): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(SEED_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function parseSeed(seedText: string): number | null {
  const trimmed = seedText.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return null
  const normalized = Math.floor(Math.abs(parsed)) >>> 0
  return normalized
}

const INITIAL_SETTINGS = loadInitialSettings()
const INITIAL_SEED_TEXT = loadInitialSeedText()
const INITIAL_LAYOUT_SEED = parseSeed(INITIAL_SEED_TEXT) ?? randomSeed()
const INITIAL_LAYOUT = generateLayoutOnly(INITIAL_SETTINGS, INITIAL_LAYOUT_SEED)

function App() {
  const [settings, setSettings] = useState<GenerationSettings>(INITIAL_SETTINGS)
  const [seedText, setSeedText] = useState<string>(INITIAL_SEED_TEXT)
  const [stage, setStage] = useState<WorkflowStage>('layout')
  const [layoutPhase, setLayoutPhase] = useState<LayoutPhaseResult | null>(INITIAL_LAYOUT.phase)
  const [layoutSeed, setLayoutSeed] = useState<number>(INITIAL_LAYOUT_SEED)
  const [mineGenerationSession, setMineGenerationSession] = useState<MineGenerationSession | null>(null)
  const [isMineAutoStepping, setIsMineAutoStepping] = useState(false)
  const [game, setGame] = useState<GameState | null>(INITIAL_LAYOUT.game)
  const [undoGame, setUndoGame] = useState<GameState | null>(null)
  const [xrayMode, setXrayMode] = useState(false)
  const canGenerateMines = layoutPhase !== null

  const onSettingsChange = useCallback((partial: Partial<GenerationSettings>) => {
    setSettings((previous) => {
      const next = normalizeSettings({ ...previous, ...partial })
      const seed = parseSeed(seedText) ?? randomSeed()
      const generated = generateLayoutOnly(next, seed)
      setLayoutSeed(seed)
      setLayoutPhase(generated.phase)
      setMineGenerationSession(null)
      setGame(generated.game)
      setStage('layout')
      setUndoGame(null)
      setIsMineAutoStepping(false)
      return next
    })
  }, [seedText])

  const onGenerateLayout = useCallback(() => {
    const seed = parseSeed(seedText) ?? randomSeed()
    const { phase, game: layoutGame } = generateLayoutOnly(settings, seed)
    setLayoutSeed(seed)
    setLayoutPhase(phase)
    setMineGenerationSession(null)
    setGame(layoutGame)
    setStage('layout')
    setUndoGame(null)
    setIsMineAutoStepping(false)
  }, [seedText, settings])

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

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    window.localStorage.setItem(SEED_STORAGE_KEY, seedText)
  }, [seedText])

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
    (settings.mineGenerationSystem === 'smart' || (game.mineCount > 0 && game.generationReport.noGuessSolvePassed))
  const effectiveXrayMode = stage !== 'play' ? true : xrayMode
  const generationMessages = game?.generationReport.messageLog ?? []

  return (
    <>
      <ControlPanel
        settings={settings}
        seedText={seedText}
        game={game}
        stage={stage}
        xrayMode={effectiveXrayMode}
        canUndo={undoGame !== null}
        canGenerateMines={canGenerateMines}
        canStartPlaying={canStartPlaying}
        isMineAutoStepping={isMineAutoStepping}
        mineStepCount={mineGenerationSession?.stepCount ?? 0}
        onGenerateLayout={onGenerateLayout}
        onGenerateMines={onGenerateMines}
        onStartPlaying={onStartPlaying}
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
      <div className="fixed bottom-3 right-3 z-10 w-[560px] rounded-lg border border-slate-300/90 bg-white/88 p-3 text-left text-slate-700 shadow-lg backdrop-blur-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-wide text-slate-900">Mine Messages</h2>
          <span className="text-[11px] text-slate-500">{generationMessages.length}</span>
        </div>
        <div className="max-h-44 overflow-y-auto rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-700">
          {generationMessages.length > 0 ? (
            <ul className="space-y-1">
              {generationMessages.map((message, index) => (
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
    </>
  )
}

export default App
