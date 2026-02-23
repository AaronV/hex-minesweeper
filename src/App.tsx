import { useCallback, useEffect, useState } from 'react'
import { BoardCanvas } from './components/BoardCanvas'
import { ControlPanel, type WorkflowStage } from './components/ControlPanel'
import {
  applyRightClick,
  DEFAULT_SETTINGS,
  generateLayoutOnly,
  generateMinesForLayout,
  type GameState,
  normalizeSettings,
  randomSeed,
  revealCell,
  type GenerationSettings,
  type ShapePhaseResult,
} from './game'

const SETTINGS_STORAGE_KEY = 'hex-minesweeper:settings'

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

function App() {
  const [settings, setSettings] = useState<GenerationSettings>(loadInitialSettings)
  const [stage, setStage] = useState<WorkflowStage>('setup')
  const [layoutPhase, setLayoutPhase] = useState<ShapePhaseResult | null>(null)
  const [layoutSeed, setLayoutSeed] = useState<number>(0)
  const [game, setGame] = useState<GameState | null>(null)
  const [undoGame, setUndoGame] = useState<GameState | null>(null)
  const [xrayMode, setXrayMode] = useState(false)

  const onSettingsChange = useCallback((partial: Partial<GenerationSettings>) => {
    setSettings((previous) => normalizeSettings({ ...previous, ...partial }))
    setStage('setup')
    setLayoutPhase(null)
    setGame(null)
    setUndoGame(null)
  }, [])

  const onGenerateLayout = useCallback(() => {
    const seed = randomSeed()
    const { phase, game: layoutGame } = generateLayoutOnly(settings, seed)
    setLayoutSeed(seed)
    setLayoutPhase(phase)
    setGame(layoutGame)
    setStage('layout')
    setUndoGame(null)
  }, [settings])

  const onGenerateMines = useCallback(() => {
    if (!layoutPhase) return
    const mineSeed = randomSeed()
    const next = generateMinesForLayout(settings, layoutPhase, layoutSeed, mineSeed)
    setGame(next)
    setStage('mines')
    setUndoGame(null)
  }, [layoutPhase, layoutSeed, settings])

  const onStartPlaying = useCallback(() => {
    if (!game) return
    setStage('play')
    setUndoGame(null)
  }, [game])

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

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

  const canGenerateMines = layoutPhase !== null
  const canStartPlaying =
    stage === 'mines' && game !== null && game.mineCount > 0 && game.generationReport.noGuessSolvePassed
  const effectiveXrayMode = stage !== 'play' ? true : xrayMode

  return (
    <>
      <ControlPanel
        settings={settings}
        game={game}
        stage={stage}
        xrayMode={effectiveXrayMode}
        canUndo={undoGame !== null}
        canGenerateMines={canGenerateMines}
        canStartPlaying={canStartPlaying}
        onGenerateLayout={onGenerateLayout}
        onGenerateMines={onGenerateMines}
        onStartPlaying={onStartPlaying}
        onUndo={onUndo}
        onToggleXrayMode={setXrayMode}
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
