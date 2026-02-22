import type { GameState, GenerationSettings } from '../game'

interface ControlPanelProps {
  settings: GenerationSettings
  game: GameState
  remainingFlags: number
  maxSafeStarts: number
  onGenerateLevel: () => void
  onSettingsChange: (partial: Partial<GenerationSettings>) => void
}

export function ControlPanel({
  settings,
  game,
  remainingFlags,
  maxSafeStarts,
  onGenerateLevel,
  onSettingsChange,
}: ControlPanelProps) {
  return (
    <div className="fixed left-3 top-3 z-10 w-[320px] rounded-lg border border-slate-600/60 bg-slate-900/88 p-3 text-slate-100 shadow-lg backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-sm font-semibold tracking-wide text-slate-100">Hex Minesweeper</h1>
        <button
          type="button"
          onClick={onGenerateLevel}
          className="rounded bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-500"
        >
          New Level
        </button>
      </div>

      <div className="grid gap-2 text-xs">
        <label className="block">
          <div className="mb-1 flex justify-between">
            <span>Columns</span>
            <span>{settings.cols}</span>
          </div>
          <input
            type="range"
            min={6}
            max={36}
            value={settings.cols}
            onChange={(event) => onSettingsChange({ cols: Number(event.target.value) })}
            className="w-full"
          />
        </label>

        <label className="block">
          <div className="mb-1 flex justify-between">
            <span>Rows</span>
            <span>{settings.rows}</span>
          </div>
          <input
            type="range"
            min={6}
            max={28}
            value={settings.rows}
            onChange={(event) => onSettingsChange({ rows: Number(event.target.value) })}
            className="w-full"
          />
        </label>

        <label className="block">
          <div className="mb-1 flex justify-between">
            <span>Mine Density</span>
            <span>{settings.minePercent}%</span>
          </div>
          <input
            type="range"
            min={8}
            max={38}
            value={settings.minePercent}
            onChange={(event) => onSettingsChange({ minePercent: Number(event.target.value) })}
            className="w-full"
          />
        </label>

        <label className="block">
          <div className="mb-1 flex justify-between">
            <span>Min Safe Starts</span>
            <span>{settings.minSafeStarts}</span>
          </div>
          <input
            type="range"
            min={1}
            max={Math.max(1, maxSafeStarts)}
            value={Math.min(settings.minSafeStarts, Math.max(1, maxSafeStarts))}
            onChange={(event) => onSettingsChange({ minSafeStarts: Number(event.target.value) })}
            className="w-full"
          />
        </label>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-300">
        <span>Status</span>
        <span className="text-right font-semibold text-slate-100">
          {game.status === 'playing' ? 'Playing' : game.status === 'won' ? 'Won' : 'Lost'}
        </span>
        <span>Mines</span>
        <span className="text-right">{game.mineCount}</span>
        <span>Flags Left</span>
        <span className="text-right">{remainingFlags}</span>
        <span>Safe Starts Used</span>
        <span className="text-right">{game.safeStartCount}</span>
        <span>Seed</span>
        <span className="truncate text-right">{game.seed}</span>
      </div>
    </div>
  )
}
