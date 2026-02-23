import { useCallback, useEffect, useState } from 'react'
import { BoardCanvas } from './components/BoardCanvas'
import { ControlPanel } from './components/ControlPanel'
import {
  applyRightClick,
  DEFAULT_SETTINGS,
  type GameState,
  makeGame,
  normalizeSettings,
  randomSeed,
  revealCell,
  type GenerationSettings,
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
  const [game, setGame] = useState(() => makeGame(loadInitialSettings(), randomSeed()))
  const [undoGame, setUndoGame] = useState<GameState | null>(null)
  const [xrayMode, setXrayMode] = useState(false)

  const onGenerateLevel = useCallback(() => {
    setUndoGame(null)
    setGame(makeGame(settings, randomSeed()))
  }, [settings])

  const onSettingsChange = useCallback((partial: Partial<GenerationSettings>) => {
    setSettings((previous) => {
      const next = normalizeSettings({ ...previous, ...partial })
      setUndoGame(null)
      setGame(makeGame(next, randomSeed()))
      return next
    })
  }, [])

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  const applyMove = useCallback((move: (previous: GameState) => GameState) => {
    setGame((previous) => {
      const next = move(previous)
      if (next !== previous) setUndoGame(previous)
      return next
    })
  }, [])

  const onReveal = useCallback((index: number) => {
    applyMove((previous) => revealCell(previous, index))
  }, [applyMove])

  const onRightClick = useCallback((index: number) => {
    applyMove((previous) => applyRightClick(previous, index))
  }, [applyMove])

  const onUndo = useCallback(() => {
    setUndoGame((previousUndo) => {
      if (!previousUndo) return previousUndo
      setGame(previousUndo)
      return null
    })
  }, [])

  return (
    <>
      <ControlPanel
        settings={settings}
        game={game}
        xrayMode={xrayMode}
        canUndo={undoGame !== null}
        onGenerateLevel={onGenerateLevel}
        onUndo={onUndo}
        onToggleXrayMode={setXrayMode}
        onSettingsChange={onSettingsChange}
      />
      <BoardCanvas game={game} xrayMode={xrayMode} onReveal={onReveal} onRightClick={onRightClick} />
    </>
  )
}

export default App
