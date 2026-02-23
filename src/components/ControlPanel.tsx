import type { GameState, GenerationSettings, MapShape } from '../game'

interface ControlPanelProps {
  settings: GenerationSettings
  game: GameState
  remainingFlags: number
  canUndo: boolean
  onGenerateLevel: () => void
  onUndo: () => void
  onSettingsChange: (partial: Partial<GenerationSettings>) => void
}

export function ControlPanel({
  settings,
  game,
  remainingFlags,
  canUndo,
  onGenerateLevel,
  onUndo,
  onSettingsChange,
}: ControlPanelProps) {
  return (
    <div className="fixed left-3 top-3 z-10 w-[320px] rounded-lg border border-slate-300/90 bg-white/88 p-3 text-slate-700 shadow-lg backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h1 className="text-sm font-semibold tracking-wide text-slate-900">Hex Minesweeper</h1>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 enabled:hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={onGenerateLevel}
            className="rounded bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-500"
          >
            New Level
          </button>
        </div>
      </div>

      <div className="grid gap-2 text-xs">
        <label className="block">
          <div className="mb-1 flex justify-between">
            <span>Shape</span>
            <span className="capitalize">{settings.mapShape}</span>
          </div>
          <select
            value={settings.mapShape}
            onChange={(event) => onSettingsChange({ mapShape: event.target.value as MapShape })}
            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
          >
            <option value="rorschach">Rorschach Mirror</option>
            <option value="snowflake">Snowflake</option>
          </select>
        </label>

        <label className="block">
          <div className="mb-1 flex justify-between">
            <span>Map Size</span>
            <span>{settings.mapSize}</span>
          </div>
          <input
            type="range"
            min={8}
            max={24}
            value={settings.mapSize}
            onChange={(event) => onSettingsChange({ mapSize: Number(event.target.value) })}
            className="w-full"
          />
        </label>

        <label className="block">
          <div className="mb-1 flex justify-between">
            <span>Propagation</span>
            <span>{settings.propagation}</span>
          </div>
          <input
            type="range"
            min={20}
            max={95}
            value={settings.propagation}
            onChange={(event) => onSettingsChange({ propagation: Number(event.target.value) })}
            className="w-full"
          />
        </label>

        {settings.mapShape === 'snowflake' ? (
          <label className="block">
            <div className="mb-1 flex justify-between">
              <span>Snowflake Arms</span>
              <span>{settings.snowflakeArms}</span>
            </div>
            <select
              value={settings.snowflakeArms}
              onChange={(event) => onSettingsChange({ snowflakeArms: Number(event.target.value) })}
              className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
            >
              <option value={3}>3</option>
              <option value={6}>6</option>
            </select>
          </label>
        ) : null}

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

      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
        <span>Status</span>
        <span className="text-right font-semibold text-slate-900">
          {game.status === 'playing' ? 'Playing' : game.status === 'won' ? 'Won' : 'Lost'}
        </span>
        <span>Mines</span>
        <span className="text-right">{game.mineCount}</span>
        <span>Active Cells</span>
        <span className="text-right">{game.activeCellCount}</span>
        <span>Flags Left</span>
        <span className="text-right">{remainingFlags}</span>
        <span>Start Cell</span>
        <span className="text-right">Marked safe</span>
        <span>Seed</span>
        <span className="truncate text-right">{game.seed}</span>
      </div>

      <p className="mt-3 text-[11px] text-slate-500">
        Controls: Left click to reveal, right click to flag, drag to pan, wheel to zoom.
      </p>
    </div>
  )
}
