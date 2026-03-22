import type { GameState, GenerationSettings, MapLayout } from '../game'
import { DebugTools } from './DebugTools'
import type { WorkflowStage } from '../app/types'
import {
  MAP_SIZE_MAX,
  MAP_SIZE_MIN,
  PROPAGATION_MAX,
  PROPAGATION_MIN,
  RECT_COLS_MAX,
  RECT_COLS_MIN,
  RECT_ROWS_MAX,
  RECT_ROWS_MIN,
} from '../game'

interface ControlPanelProps {
  isOpen: boolean
  settings: GenerationSettings
  seedText: string
  game: GameState | null
  stage: WorkflowStage
  debugToolsEnabled: boolean
  xrayMode: boolean
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
  onClose: () => void
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
  return (
    <>
      <label className="block">
        <div className="mb-1">
          <span>Layout</span>
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
        <div className="mb-1">
          <span>Seed</span>
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
              min={RECT_COLS_MIN}
              max={RECT_COLS_MAX}
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
              min={RECT_ROWS_MIN}
              max={RECT_ROWS_MAX}
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
              min={MAP_SIZE_MIN}
              max={MAP_SIZE_MAX}
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
              min={PROPAGATION_MIN}
              max={PROPAGATION_MAX}
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

      <p className="mt-3 text-[11px] text-slate-500">
        Controls: Left click to reveal, right click to flag, drag to pan, wheel to zoom. Right click a revealed hint to
        auto-clear neighboring cells when your flags match the hint.
      </p>
    </>
  )
}

export function ControlPanel({
  isOpen,
  settings,
  seedText,
  game,
  stage,
  debugToolsEnabled,
  xrayMode,
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
  onClose,
  onToggleXrayMode,
  onSeedTextChange,
  onSettingsChange,
}: ControlPanelProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/35 px-3 py-6" onClick={onClose}>
      <div
        className="w-[min(92vw,420px)] rounded-xl border border-slate-300 bg-white p-4 text-slate-700 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <h1 className="text-sm font-semibold tracking-wide text-slate-900">New Board</h1>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
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
    </div>
  )
}

interface QuickButtonPanelProps {
  game: GameState | null
  canUndo: boolean
  stage: WorkflowStage
  onUndo: () => void
  onNewGame: () => void
  onOpenSettings: () => void
  onOpenTutorial: () => void
}

export function QuickButtonPanel({
  game,
  canUndo,
  stage,
  onUndo,
  onNewGame,
  onOpenSettings,
  onOpenTutorial,
}: QuickButtonPanelProps) {
  const flaggedCount = game ? game.cells.filter((cell) => cell.active && cell.flagged).length : 0
  const totalMines = game?.mineCount ?? 0
  const bombsRemaining = Math.max(0, totalMines - flaggedCount)
  const finalStretchThreshold = Math.max(1, Math.ceil(totalMines * 0.25))
  const inFinalStretch = game !== null && totalMines > 0 && bombsRemaining <= finalStretchThreshold
  const showSummary = game !== null && (inFinalStretch || game.status !== 'playing')

  return (
    <div className="fixed left-1/2 top-3 z-10 -translate-x-1/2 rounded-lg border border-slate-300/90 bg-white/90 p-2 text-slate-700 shadow-lg backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onNewGame}
          className="rounded bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
        >
          New Game
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Settings
        </button>
        <button
          type="button"
          onClick={onOpenTutorial}
          aria-label="Open rules"
          title="Open rules"
          className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          ?
        </button>
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo || stage !== 'play'}
          className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 enabled:hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Undo
        </button>
      </div>
      {showSummary ? (
        <div className="mt-1.5 flex items-center justify-between rounded border border-slate-300 bg-white/80 px-2 py-1 text-[11px]">
          <span>Mines Remaining: {bombsRemaining}</span>
          {game.status === 'won' || game.status === 'lost' ? (
            <span className="font-semibold">{game.status === 'won' ? 'Win' : 'Loss'}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
