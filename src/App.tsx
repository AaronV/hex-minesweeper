import { useCallback, useEffect, useMemo, useState } from 'react'
import { BoardCanvas } from './components/BoardCanvas'
import { ControlPanel } from './components/ControlPanel'
import {
  applyRightClick,
  DEFAULT_SETTINGS,
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

  const onGenerateLevel = useCallback(() => {
    setGame(makeGame(settings, randomSeed()))
  }, [settings])

  const onSettingsChange = useCallback((partial: Partial<GenerationSettings>) => {
    setSettings((previous) => normalizeSettings({ ...previous, ...partial }))
  }, [])

  useEffect(() => {
    setGame(makeGame(settings, randomSeed()))
  }, [settings])

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  const onReveal = useCallback((index: number) => {
    setGame((previous) => revealCell(previous, index))
  }, [])

  const onRightClick = useCallback((index: number) => {
    setGame((previous) => applyRightClick(previous, index))
  }, [])

  const remainingFlags = useMemo(
    () => game.mineCount - game.cells.filter((cell) => cell.flagged).length,
    [game.cells, game.mineCount],
  )

  return (
    <>
      <ControlPanel
        settings={settings}
        game={game}
        remainingFlags={remainingFlags}
        onGenerateLevel={onGenerateLevel}
        onSettingsChange={onSettingsChange}
      />
      <BoardCanvas game={game} onReveal={onReveal} onRightClick={onRightClick} />
    </>
  )
}

export default App
