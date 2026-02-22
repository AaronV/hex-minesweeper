import { type MouseEvent as ReactMouseEvent, useCallback, useEffect, useRef } from 'react'
import { drawGameBoard, findCellAtPoint, type BoardLayout } from '../board'
import type { GameState } from '../game'

interface BoardCanvasProps {
  game: GameState
  onReveal: (index: number) => void
  onToggleFlag: (index: number) => void
}

export function BoardCanvas({ game, onReveal, onToggleFlag }: BoardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const layoutRef = useRef<BoardLayout | null>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    layoutRef.current = drawGameBoard(canvas, game)
  }, [game])

  useEffect(() => {
    draw()
    window.addEventListener('resize', draw)
    return () => {
      window.removeEventListener('resize', draw)
    }
  }, [draw])

  const onMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const index = findCellAtPoint(x, y, layoutRef.current)
      if (index < 0) return
      if (event.button === 0) onReveal(index)
      if (event.button === 2) onToggleFlag(index)
    },
    [onReveal, onToggleFlag],
  )

  return (
    <canvas
      ref={canvasRef}
      className="block h-screen w-screen"
      aria-label="Hex minesweeper board"
      onMouseDown={onMouseDown}
      onContextMenu={(event) => event.preventDefault()}
    />
  )
}
