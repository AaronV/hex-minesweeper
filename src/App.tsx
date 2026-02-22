import { useCallback, useMemo, useState } from 'react'
import { BoardCanvas } from './components/BoardCanvas'
import { ControlPanel } from './components/ControlPanel'
import {
  applyRightClick,
  DEFAULT_SETTINGS,
  getMineTargetFromSettings,
  makeGame,
  normalizeSettings,
  randomSeed,
  revealCell,
  type GenerationSettings,
} from './game'

function App() {
  const [settings, setSettings] = useState<GenerationSettings>(DEFAULT_SETTINGS)
  const [game, setGame] = useState(() => makeGame(DEFAULT_SETTINGS, randomSeed()))

  const onGenerateLevel = useCallback(() => {
    setGame(makeGame(settings, randomSeed()))
  }, [settings])

  const onSettingsChange = useCallback((partial: Partial<GenerationSettings>) => {
    setSettings((previous) => normalizeSettings({ ...previous, ...partial }))
  }, [])

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

  const mineTarget = getMineTargetFromSettings(settings)
  const maxSafeStarts = settings.cols * settings.rows - mineTarget

  return (
    <>
      <ControlPanel
        settings={settings}
        game={game}
        remainingFlags={remainingFlags}
        maxSafeStarts={maxSafeStarts}
        onGenerateLevel={onGenerateLevel}
        onSettingsChange={onSettingsChange}
      />
      <BoardCanvas game={game} onReveal={onReveal} onRightClick={onRightClick} />
    </>
  )
}

export default App
