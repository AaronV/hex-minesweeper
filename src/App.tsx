import { useCallback, useEffect, useReducer, useState } from 'react'
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
import { useBackgroundGeneration } from './hooks/useBackgroundGeneration'

interface UiState {
  stage: WorkflowStage
  debugToolsEnabled: boolean
  xrayMode: boolean
  isMineAutoStepping: boolean
}

type UiAction =
  | { type: 'start_background_generation' }
  | { type: 'show_debug_layout' }
  | { type: 'show_debug_mines' }
  | { type: 'enter_play' }
  | { type: 'toggle_debug_tools' }
  | { type: 'set_xray_mode'; enabled: boolean }
  | { type: 'toggle_mine_auto_step' }
  | { type: 'stop_mine_auto_step' }

const INITIAL_UI_STATE: UiState = {
  stage: 'play',
  debugToolsEnabled: false,
  xrayMode: false,
  isMineAutoStepping: false,
}

function uiReducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case 'start_background_generation':
      return { ...state, stage: 'setup', isMineAutoStepping: false }
    case 'show_debug_layout':
      return { ...state, stage: 'layout', isMineAutoStepping: false }
    case 'show_debug_mines':
      return { ...state, stage: 'mines' }
    case 'enter_play':
      return { ...state, stage: 'play', isMineAutoStepping: false }
    case 'toggle_debug_tools':
      return { ...state, debugToolsEnabled: !state.debugToolsEnabled, isMineAutoStepping: false }
    case 'set_xray_mode':
      return { ...state, xrayMode: action.enabled }
    case 'toggle_mine_auto_step':
      return { ...state, isMineAutoStepping: !state.isMineAutoStepping }
    case 'stop_mine_auto_step':
      return { ...state, isMineAutoStepping: false }
    default:
      return state
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

interface ResetOptions {
  cancelBackground?: boolean
  clearSession?: boolean
  clearUndo?: boolean
}

function App() {
  const [uiState, dispatchUi] = useReducer(uiReducer, INITIAL_UI_STATE)
  const [settings, setSettings] = useState<GenerationSettings>(INITIAL_SETTINGS)
  const [seedText, setSeedText] = useState<string>(INITIAL_SEED_TEXT)
  const [layoutPhase, setLayoutPhase] = useState<LayoutPhaseResult | null>(INITIAL_LAYOUT.phase)
  const [layoutSeed, setLayoutSeed] = useState<number>(INITIAL_LAYOUT_SEED)
  const [mineGenerationSession, setMineGenerationSession] = useState<MineGenerationSession | null>(null)
  const [game, setGame] = useState<GameState | null>(INITIAL_GAME)
  const [undoGame, setUndoGame] = useState<GameState | null>(null)
  const {
    progress: generationProgress,
    start: startBackgroundGeneration,
    cancel: cancelBackgroundGeneration,
  } = useBackgroundGeneration()

  const canGenerateMines = layoutPhase !== null

  const resetTransientUiState = useCallback(
    ({ cancelBackground = true, clearSession = true, clearUndo = true }: ResetOptions = {}) => {
      if (cancelBackground) cancelBackgroundGeneration()
      if (clearSession) setMineGenerationSession(null)
      if (clearUndo) setUndoGame(null)
      dispatchUi({ type: 'stop_mine_auto_step' })
    },
    [cancelBackgroundGeneration],
  )

  const startNonDebugGeneration = useCallback(
    (nextSettings: GenerationSettings, seed: number) => {
      resetTransientUiState()
      dispatchUi({ type: 'start_background_generation' })
      startBackgroundGeneration(nextSettings, seed, (result) => {
        setLayoutSeed(result.seed)
        setLayoutPhase(result.phase)
        setMineGenerationSession(result.session)
        setGame(result.game)
        setUndoGame(null)
        dispatchUi({ type: 'enter_play' })
      })
    },
    [resetTransientUiState, startBackgroundGeneration],
  )

  const onSettingsChange = useCallback(
    (partial: Partial<GenerationSettings>) => {
      const next = normalizeSettings({ ...settings, ...partial })
      const seed = parseSeed(seedText) ?? randomSeed()
      setSettings(next)

      if (uiState.debugToolsEnabled) {
        resetTransientUiState()
        const { phase, game: layoutGame } = generateLayoutOnly(next, seed)
        setLayoutSeed(seed)
        setLayoutPhase(phase)
        setGame(layoutGame)
        dispatchUi({ type: 'show_debug_layout' })
        return
      }

      startNonDebugGeneration(next, seed)
    },
    [resetTransientUiState, seedText, settings, startNonDebugGeneration, uiState.debugToolsEnabled],
  )

  const onGenerateLayout = useCallback(() => {
    resetTransientUiState()
    const seed = randomSeed()
    const { phase, game: layoutGame } = generateLayoutOnly(settings, seed)
    setSeedText(String(seed))
    setLayoutSeed(seed)
    setLayoutPhase(phase)
    setGame(layoutGame)
    dispatchUi({ type: 'show_debug_layout' })
  }, [resetTransientUiState, settings])

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

    resetTransientUiState({ cancelBackground: false, clearSession: false })
    setMineGenerationSession(result.session)
    setGame(result.game)
    dispatchUi({ type: 'show_debug_mines' })
  }, [layoutPhase, layoutSeed, mineGenerationSession, resetTransientUiState, seedText, settings])

  const onStartPlaying = useCallback(() => {
    if (!game) return
    resetTransientUiState({ cancelBackground: false, clearSession: false })
    dispatchUi({ type: 'enter_play' })
  }, [game, resetTransientUiState])

  const onToggleMineAutoStep = useCallback(() => {
    if (!canGenerateMines) return
    dispatchUi({ type: 'toggle_mine_auto_step' })
  }, [canGenerateMines])

  useEffect(() => {
    if (!uiState.isMineAutoStepping) return
    if (uiState.stage !== 'mines' && uiState.stage !== 'layout') return
    if (!canGenerateMines) return
    if (mineGenerationSession?.done) return

    const id = window.setInterval(() => {
      onGenerateMines()
    }, 100)

    return () => window.clearInterval(id)
  }, [canGenerateMines, mineGenerationSession?.done, onGenerateMines, uiState.isMineAutoStepping, uiState.stage])

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
      if (uiState.stage !== 'play') return
      applyMove((previous) => revealCell(previous, index))
    },
    [applyMove, uiState.stage],
  )

  const onRightClick = useCallback(
    (index: number) => {
      if (uiState.stage !== 'play') return
      applyMove((previous) => applyRightClick(previous, index))
    },
    [applyMove, uiState.stage],
  )

  const onUndo = useCallback(() => {
    if (uiState.stage !== 'play') return
    setUndoGame((previousUndo) => {
      if (!previousUndo) return previousUndo
      setGame(previousUndo)
      return null
    })
  }, [uiState.stage])

  const generationComplete =
    uiState.stage === 'mines' &&
    mineGenerationSession !== null &&
    (layoutPhase !== null && mineGenerationSession.assignedSet.size >= layoutPhase.activeIndices.length)

  const canStartPlaying =
    uiState.stage === 'mines' &&
    game !== null &&
    generationComplete &&
    game.mineCount > 0 &&
    game.generationReport.noGuessSolvePassed

  const effectiveXrayMode = uiState.debugToolsEnabled ? (uiState.stage !== 'play' ? true : uiState.xrayMode) : false
  const generationMessages = game?.generationReport.messageLog ?? []
  const progressVisible = !uiState.debugToolsEnabled && generationProgress !== null
  const progressRatio = progressVisible
    ? Math.max(0, Math.min(1, generationProgress.assigned / generationProgress.total))
    : 0

  return (
    <>
      <ControlPanel
        settings={settings}
        seedText={seedText}
        game={game}
        stage={uiState.stage}
        debugToolsEnabled={uiState.debugToolsEnabled}
        xrayMode={effectiveXrayMode}
        canUndo={undoGame !== null}
        canGenerateMines={canGenerateMines}
        canStartPlaying={canStartPlaying}
        isMineAutoStepping={uiState.isMineAutoStepping}
        mineStepCount={mineGenerationSession?.stepCount ?? 0}
        onGenerateBoardQuick={onGenerateBoardQuick}
        onGenerateLayout={onGenerateLayout}
        onGenerateMines={onGenerateMines}
        onStartPlaying={onStartPlaying}
        onToggleDebugTools={() => {
          cancelBackgroundGeneration()
          dispatchUi({ type: 'toggle_debug_tools' })
        }}
        onToggleMineAutoStep={onToggleMineAutoStep}
        onUndo={onUndo}
        onToggleXrayMode={(enabled) => dispatchUi({ type: 'set_xray_mode', enabled })}
        onSeedTextChange={setSeedText}
        onSettingsChange={onSettingsChange}
      />
      <BoardCanvas
        game={game}
        xrayMode={effectiveXrayMode}
        interactive={uiState.stage === 'play'}
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
      {uiState.debugToolsEnabled ? (
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
