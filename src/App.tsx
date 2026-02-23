import { useCallback, useEffect, useState } from 'react'
import { BoardCanvas } from './components/BoardCanvas'
import { ControlPanel, type WorkflowStage } from './components/ControlPanel'
import {
  advancePrototypeMineGeneration,
  applyRightClick,
  DEFAULT_SETTINGS,
  generateLayoutOnly,
  generateMinesForLayout,
  type GameState,
  normalizeSettings,
  randomSeed,
  revealCell,
  type GenerationSettings,
  type LayoutPhaseResult,
  type PrototypeMineSession,
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
  const [prototypeMineSession, setPrototypeMineSession] = useState<PrototypeMineSession | null>(null)
  const [isPrototypeAutoRunning, setIsPrototypeAutoRunning] = useState(false)
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
      setPrototypeMineSession(null)
      setGame(generated.game)
      setStage('layout')
      setUndoGame(null)
      setIsPrototypeAutoRunning(false)
      return next
    })
  }, [seedText])

  const onGenerateLayout = useCallback(() => {
    const seed = parseSeed(seedText) ?? randomSeed()
    const { phase, game: layoutGame } = generateLayoutOnly(settings, seed)
    setLayoutSeed(seed)
    setLayoutPhase(phase)
    setPrototypeMineSession(null)
    setGame(layoutGame)
    setStage('layout')
    setUndoGame(null)
    setIsPrototypeAutoRunning(false)
  }, [seedText, settings])

  const onGenerateMines = useCallback(() => {
    if (!layoutPhase) return
    if (settings.mineGenerationSystem === 'prototypeNoop') {
      const baseSeed = parseSeed(seedText)
      const stepOffset = prototypeMineSession ? prototypeMineSession.stepCount + 1 : 1
      const result = advancePrototypeMineGeneration(
        settings,
        layoutPhase,
        layoutSeed,
        prototypeMineSession,
        baseSeed !== null ? (baseSeed + stepOffset) >>> 0 : randomSeed(),
      )
      setPrototypeMineSession(result.session)
      setGame(result.game)
      setStage('mines')
      setUndoGame(null)
      if (
        result.session.lastAction === 'no frontier cells available' ||
        result.session.lastAction.startsWith('transaction failed:')
      ) {
        setIsPrototypeAutoRunning(false)
      }
      return
    }

    const mineSeed = parseSeed(seedText) !== null ? ((parseSeed(seedText) ?? 0) + 1) >>> 0 : randomSeed()
    const next = generateMinesForLayout(settings, layoutPhase, layoutSeed, mineSeed)
    setPrototypeMineSession(null)
    setGame(next)
    setStage('mines')
    setUndoGame(null)
    setIsPrototypeAutoRunning(false)
  }, [layoutPhase, layoutSeed, prototypeMineSession, seedText, settings])

  const onStartPlaying = useCallback(() => {
    if (!game) return
    setStage('play')
    setUndoGame(null)
    setIsPrototypeAutoRunning(false)
  }, [game])

  const onTogglePrototypeAutoRun = useCallback(() => {
    if (!canGenerateMines || settings.mineGenerationSystem !== 'prototypeNoop') return
    setIsPrototypeAutoRunning((previous) => !previous)
  }, [canGenerateMines, settings.mineGenerationSystem])

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    window.localStorage.setItem(SEED_STORAGE_KEY, seedText)
  }, [seedText])

  useEffect(() => {
    if (!isPrototypeAutoRunning) return
    if (settings.mineGenerationSystem !== 'prototypeNoop') return
    if (stage !== 'mines' && stage !== 'layout') return
    if (!canGenerateMines) return

    const id = window.setInterval(() => {
      onGenerateMines()
    }, 100)
    return () => window.clearInterval(id)
  }, [canGenerateMines, isPrototypeAutoRunning, onGenerateMines, settings.mineGenerationSystem, stage])

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

  const prototypeAssignmentComplete =
    settings.mineGenerationSystem === 'prototypeNoop' &&
    stage === 'mines' &&
    layoutPhase !== null &&
    prototypeMineSession !== null &&
    prototypeMineSession.assignedSet.size >= layoutPhase.activeIndices.length
  const canStartPlaying =
    stage === 'mines' &&
    game !== null &&
    (prototypeAssignmentComplete || (game.mineCount > 0 && game.generationReport.noGuessSolvePassed))
  const effectiveXrayMode = stage !== 'play' ? true : xrayMode

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
        isPrototypeAutoRunning={isPrototypeAutoRunning}
        prototypeStepCount={prototypeMineSession?.stepCount ?? 0}
        onGenerateLayout={onGenerateLayout}
        onGenerateMines={onGenerateMines}
        onStartPlaying={onStartPlaying}
        onTogglePrototypeAutoRun={onTogglePrototypeAutoRun}
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
    </>
  )
}

export default App
