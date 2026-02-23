import type { GameState, GenerationSettings, MapLayout, MineGenerationSystem } from '../game'

export type WorkflowStage = 'setup' | 'layout' | 'mines' | 'play'

interface ControlPanelProps {
  settings: GenerationSettings
  seedText: string
  game: GameState | null
  stage: WorkflowStage
  xrayMode: boolean
  canUndo: boolean
  canGenerateMines: boolean
  canStartPlaying: boolean
  onGenerateLayout: () => void
  onGenerateMines: () => void
  onStartPlaying: () => void
  onUndo: () => void
  onToggleXrayMode: (enabled: boolean) => void
  onSeedTextChange: (value: string) => void
  onSettingsChange: (partial: Partial<GenerationSettings>) => void
}

export function ControlPanel({
  settings,
  seedText,
  game,
  stage,
  xrayMode,
  canUndo,
  canGenerateMines,
  canStartPlaying,
  onGenerateLayout,
  onGenerateMines,
  onStartPlaying,
  onUndo,
  onToggleXrayMode,
  onSeedTextChange,
  onSettingsChange,
}: ControlPanelProps) {
  const mineButtonLabel =
    settings.mineGenerationSystem === 'prototypeNoop' && stage === 'mines'
      ? '2. Next Prototype Step'
      : '2. Generate Mines'

  return (
    <div className="fixed left-3 top-3 z-10 w-[320px] rounded-lg border border-slate-300/90 bg-white/88 p-3 text-slate-700 shadow-lg backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h1 className="text-sm font-semibold tracking-wide text-slate-900">Hex Minesweeper</h1>
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo || stage !== 'play'}
          className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 enabled:hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Undo
        </button>
      </div>

      <div className="grid gap-2 text-xs">
        <label className="block">
          <div className="mb-1 flex justify-between">
            <span>Layout</span>
            <span className="capitalize">{settings.mapLayout}</span>
          </div>
          <select
            value={settings.mapLayout}
            onChange={(event) => onSettingsChange({ mapLayout: event.target.value as MapLayout })}
            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
          >
            <option value="rectangle">Rectangle</option>
            <option value="rorschach">Rorschach Mirror</option>
            <option value="snowflake">Snowflake</option>
          </select>
        </label>

        <label className="block">
          <div className="mb-1 flex justify-between">
            <span>Mine System</span>
            <span>{settings.mineGenerationSystem}</span>
          </div>
          <select
            value={settings.mineGenerationSystem}
            onChange={(event) => onSettingsChange({ mineGenerationSystem: event.target.value as MineGenerationSystem })}
            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
          >
            <option value="weighted">Weighted</option>
            <option value="prototypeNoop">Prototype (No-op)</option>
          </select>
        </label>

        <label className="block">
          <div className="mb-1 flex justify-between">
            <span>Seed</span>
            <span>{seedText.trim() === '' ? 'random' : 'fixed'}</span>
          </div>
          <input
            type="text"
            inputMode="numeric"
            value={seedText}
            onChange={(event) => onSeedTextChange(event.target.value.replace(/[^\d]/g, ''))}
            placeholder="Leave empty for random"
            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 placeholder:text-slate-400"
          />
        </label>

        {settings.mapLayout === 'rectangle' ? (
          <>
            <label className="block">
              <div className="mb-1 flex justify-between">
                <span>Columns</span>
                <span>{settings.rectCols}</span>
              </div>
              <input
                type="range"
                min={8}
                max={40}
                value={settings.rectCols}
                onChange={(event) => onSettingsChange({ rectCols: Number(event.target.value) })}
                className="w-full"
              />
            </label>

            <label className="block">
              <div className="mb-1 flex justify-between">
                <span>Rows</span>
                <span>{settings.rectRows}</span>
              </div>
              <input
                type="range"
                min={8}
                max={32}
                value={settings.rectRows}
                onChange={(event) => onSettingsChange({ rectRows: Number(event.target.value) })}
                className="w-full"
              />
            </label>
          </>
        ) : (
          <>
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
          </>
        )}

        {settings.mapLayout === 'snowflake' ? (
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

        <div className="grid grid-cols-1 gap-1.5">
          <button
            type="button"
            onClick={onGenerateLayout}
            className="rounded bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
          >
            1. Generate Layout
          </button>
          <button
            type="button"
            onClick={onGenerateMines}
            disabled={!canGenerateMines}
            className="rounded bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white enabled:hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {mineButtonLabel}
          </button>
          <button
            type="button"
            onClick={onStartPlaying}
            disabled={!canStartPlaying}
            className="rounded bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white enabled:hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-45"
          >
            3. Start Playing
          </button>
        </div>

        <label className="flex items-center justify-between rounded border border-slate-300 bg-white px-2 py-1.5">
          <span>X-Ray (debug)</span>
          <input
            type="checkbox"
            checked={xrayMode}
            disabled={stage !== 'play'}
            onChange={(event) => onToggleXrayMode(event.target.checked)}
          />
        </label>
      </div>

      {game ? (
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
          <span>Stage</span>
          <span className="text-right font-semibold text-slate-900 capitalize">{stage}</span>
          <span>Status</span>
          <span className="text-right font-semibold text-slate-900">
            {game.status === 'playing' ? 'Playing' : game.status === 'won' ? 'Won' : 'Lost'}
          </span>
          <span>Mines</span>
          <span className="text-right">{game.mineCount}</span>
          <span>Seed</span>
          <span className="truncate text-right">{game.seed}</span>
          <span>No-Guess Check</span>
          <span className="text-right">{game.generationReport.noGuessSolvePassed ? 'pass' : 'fail'}</span>
          <span>Target Mines</span>
          <span className="text-right">{game.generationReport.targetMines}</span>
          <span>Accepted Target</span>
          <span className="text-right">{game.generationReport.acceptedTargetMines}</span>
          <span>Generated Mines</span>
          <span className="text-right">{game.generationReport.generatedMines}</span>
          <span>Attempts</span>
          <span className="text-right">
            {game.generationReport.attemptsUsed}/{game.generationReport.attemptBudget}
          </span>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-600">Generate layout to begin.</p>
      )}

      <p className="mt-3 text-[11px] text-slate-500">
        Controls: Left click to reveal, right click to flag, drag to pan, wheel to zoom.
      </p>
      {game ? <p className="mt-1 text-[11px] text-slate-500">{game.generationReport.note}</p> : null}
    </div>
  )
}
