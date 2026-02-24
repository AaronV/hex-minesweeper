type DebugToolsStage = 'setup' | 'layout' | 'mines' | 'play'

interface DebugToolsProps {
  stage: DebugToolsStage
  canGenerateMines: boolean
  canStartPlaying: boolean
  isMineAutoStepping: boolean
  xrayMode: boolean
  onGenerateLayout: () => void
  onGenerateMines: () => void
  onToggleMineAutoStep: () => void
  onStartPlaying: () => void
  onToggleXrayMode: (enabled: boolean) => void
}

export function DebugTools({
  stage,
  canGenerateMines,
  canStartPlaying,
  isMineAutoStepping,
  xrayMode,
  onGenerateLayout,
  onGenerateMines,
  onToggleMineAutoStep,
  onStartPlaying,
  onToggleXrayMode,
}: DebugToolsProps) {
  const mineButtonLabel = stage === 'mines' ? '2. Next Mine Step' : '2. Generate Mines'

  return (
    <div className="grid grid-cols-1 gap-1.5 rounded border border-slate-300 bg-slate-50 p-2">
      <button
        type="button"
        onClick={onGenerateLayout}
        className="rounded bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
      >
        1. Generate Layout
      </button>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onGenerateMines}
          disabled={!canGenerateMines}
          className="flex-1 rounded bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white enabled:hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {mineButtonLabel}
        </button>
        <label className="flex items-center gap-1 text-xs text-slate-700">
          <span>Auto-Step</span>
          <input
            type="checkbox"
            checked={isMineAutoStepping}
            disabled={!canGenerateMines}
            onChange={onToggleMineAutoStep}
          />
        </label>
      </div>
      <button
        type="button"
        onClick={onStartPlaying}
        disabled={!canStartPlaying}
        className="rounded bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white enabled:hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-45"
      >
        3. Start Playing
      </button>
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
  )
}
