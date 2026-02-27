interface TutorialModalProps {
  isOpen: boolean
  onClose: () => void
}

export function TutorialModal({ isOpen, onClose }: TutorialModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 px-4 py-6" role="dialog" aria-modal="true">
      <div className="w-[min(94vw,560px)] rounded-2xl border border-slate-200 bg-white/95 p-6 text-left text-slate-800 shadow-2xl backdrop-blur-sm">
        <h1 className="text-xl font-bold text-slate-900">Welcome to Hex Minesweeper</h1>
        <p className="mt-2 text-sm text-slate-600">
          Reveal safe hexes, use number hints to infer mine locations, and clear every non-mine cell to win.
        </p>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">How to Play</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Left click a cell to reveal it.</li>
            <li>Right click a hidden cell to place or remove a flag.</li>
            <li>Right click a revealed hint when your adjacent flags match to auto-clear neighbors.</li>
            <li>Drag to pan and use your scroll wheel to zoom.</li>
          </ul>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Start Playing
          </button>
        </div>
      </div>
    </div>
  )
}
