import type { GameState, GenerationSettings, MapLayout } from '../game'
import { DebugTools } from './DebugTools'
import type { WorkflowStage } from '../app/types'

interface ControlPanelProps {
  settings: GenerationSettings
  seedText: string
  game: GameState | null
  stage: WorkflowStage
  debugToolsEnabled: boolean
  xrayMode: boolean
  canUndo: boolean
  canGenerateMines: boolean
  canStartPlaying: boolean
  isMineAutoStepping: boolean
  mineStepCount: number
  onGenerateBoardQuick: () => void
  onGenerateLayout: () => void
  onGenerateMines: () => void
  onStartPlaying: () => void
  onToggleDebugTools: () => void
  onToggleMineAutoStep: () => void
  onUndo: () => void
  onToggleXrayMode: (enabled: boolean) => void
  onSeedTextChange: (value: string) => void
  onSettingsChange: (partial: Partial<GenerationSettings>) => void
}

interface LayoutSectionProps {
  settings: GenerationSettings
  seedText: string
  onSeedTextChange: (value: string) => void
  onSettingsChange: (partial: Partial<GenerationSettings>) => void
}

function LayoutSection({ settings, seedText, onSeedTextChange, onSettingsChange }: LayoutSectionProps) {
  const layoutLabel =
    settings.mapLayout === 'rorschach'
      ? 'Rorschach Mirror'
      : settings.mapLayout === 'snowflake'
        ? 'Snowflow'
        : 'Rectangle'

  return (
    <>
      <label className="block">
        <div className="mb-1 flex justify-between">
          <span>Layout</span>
          <span>{layoutLabel}</span>
        </div>
        <select
          value={settings.mapLayout}
          onChange={(event) => onSettingsChange({ mapLayout: event.target.value as MapLayout })}
          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
        >
          <option value="rorschach">Rorschach Mirror</option>
          <option value="snowflake">Snowflow</option>
          <option value="rectangle">Rectangle</option>
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
    </>
  )
}

interface ActionSectionProps {
  debugToolsEnabled: boolean
  canGenerateMines: boolean
  canStartPlaying: boolean
  isMineAutoStepping: boolean
  stage: WorkflowStage
  onGenerateBoardQuick: () => void
  onToggleDebugTools: () => void
  onGenerateLayout: () => void
  onGenerateMines: () => void
  onToggleMineAutoStep: () => void
  onStartPlaying: () => void
  onToggleXrayMode: (enabled: boolean) => void
  xrayMode: boolean
}

function ActionSection({
  debugToolsEnabled,
  canGenerateMines,
  canStartPlaying,
  isMineAutoStepping,
  stage,
  onGenerateBoardQuick,
  onToggleDebugTools,
  onGenerateLayout,
  onGenerateMines,
  onToggleMineAutoStep,
  onStartPlaying,
  onToggleXrayMode,
  xrayMode,
}: ActionSectionProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-1.5">
        <button
          type="button"
          onClick={onGenerateBoardQuick}
          className="rounded bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
        >
          New Board
        </button>
        <button
          type="button"
          onClick={onToggleDebugTools}
          className="rounded bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
        >
          {debugToolsEnabled ? 'Hide Debug Tools' : 'Show Debug Tools'}
        </button>
      </div>

      {debugToolsEnabled ? (
        <DebugTools
          stage={stage}
          canGenerateMines={canGenerateMines}
          canStartPlaying={canStartPlaying}
          isMineAutoStepping={isMineAutoStepping}
          xrayMode={xrayMode}
          onGenerateLayout={onGenerateLayout}
          onGenerateMines={onGenerateMines}
          onToggleMineAutoStep={onToggleMineAutoStep}
          onStartPlaying={onStartPlaying}
          onToggleXrayMode={onToggleXrayMode}
        />
      ) : null}
    </>
  )
}

interface StatsSectionProps {
  game: GameState | null
  stage: WorkflowStage
  debugToolsEnabled: boolean
  mineStepCount: number
}

function StatsSection({ game, stage, debugToolsEnabled, mineStepCount }: StatsSectionProps) {
  if (!game) {
    return <p className="mt-3 text-xs text-slate-600">Generate layout to begin.</p>
  }

  const flaggedCount = game.cells.filter((cell) => cell.active && cell.flagged).length

  return (
    <>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
        <span>Stage</span>
        <span className="text-right font-semibold text-slate-900 capitalize">{stage}</span>
        <span>Status</span>
        <span className="text-right font-semibold text-slate-900">
          {game.status === 'playing' ? 'Playing' : game.status === 'won' ? 'Won' : 'Lost'}
        </span>
        <span>Mines</span>
        <span className="text-right">
          {flaggedCount}/{game.mineCount}
        </span>
        <span>Seed</span>
        <span className="truncate text-right">{game.seed}</span>
        {debugToolsEnabled ? (
          <>
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
            <span>Generation Step</span>
            <span className="text-right font-semibold text-slate-900">{mineStepCount}</span>
          </>
        ) : null}
      </div>

      <p className="mt-3 text-[11px] text-slate-500">Controls: Left click to reveal, right click to flag, drag to pan, wheel to zoom.</p>
    </>
  )
}

export function ControlPanel({
  settings,
  seedText,
  game,
  stage,
  debugToolsEnabled,
  xrayMode,
  canUndo,
  canGenerateMines,
  canStartPlaying,
  isMineAutoStepping,
  mineStepCount,
  onGenerateBoardQuick,
  onGenerateLayout,
  onGenerateMines,
  onStartPlaying,
  onToggleDebugTools,
  onToggleMineAutoStep,
  onUndo,
  onToggleXrayMode,
  onSeedTextChange,
  onSettingsChange,
}: ControlPanelProps) {
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
        <LayoutSection
          settings={settings}
          seedText={seedText}
          onSeedTextChange={onSeedTextChange}
          onSettingsChange={onSettingsChange}
        />

        <ActionSection
          debugToolsEnabled={debugToolsEnabled}
          canGenerateMines={canGenerateMines}
          canStartPlaying={canStartPlaying}
          isMineAutoStepping={isMineAutoStepping}
          stage={stage}
          onGenerateBoardQuick={onGenerateBoardQuick}
          onToggleDebugTools={onToggleDebugTools}
          onGenerateLayout={onGenerateLayout}
          onGenerateMines={onGenerateMines}
          onToggleMineAutoStep={onToggleMineAutoStep}
          onStartPlaying={onStartPlaying}
          onToggleXrayMode={onToggleXrayMode}
          xrayMode={xrayMode}
        />
      </div>

      <StatsSection
        game={game}
        stage={stage}
        debugToolsEnabled={debugToolsEnabled}
        mineStepCount={mineStepCount}
      />
    </div>
  )
}
