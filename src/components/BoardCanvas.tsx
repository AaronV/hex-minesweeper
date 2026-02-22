import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { drawGameBoard, findCellAtPoint, type BoardLayout, type CameraState } from '../board'
import type { GameState } from '../game'

const INITIAL_ZOOM = 0.9
const CONTROL_PANEL_LEFT = 12
const CONTROL_PANEL_WIDTH = 320
const CONTROL_PANEL_GUTTER = 12

interface BoardCanvasProps {
  game: GameState
  onReveal: (index: number) => void
  onRightClick: (index: number) => void
}

export function BoardCanvas({ game, onReveal, onRightClick }: BoardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const layoutRef = useRef<BoardLayout | null>(null)
  const [camera, setCamera] = useState<CameraState>({ zoom: 1, panX: 0, panY: 0 })
  const initializedCameraRef = useRef(false)
  const dragRef = useRef({
    pointerId: -1,
    active: false,
    moved: false,
    button: -1,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
  })

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    layoutRef.current = drawGameBoard(canvas, game, camera)
  }, [camera, game])

  useEffect(() => {
    draw()
    window.addEventListener('resize', draw)
    return () => {
      window.removeEventListener('resize', draw)
    }
  }, [draw])

  useEffect(() => {
    if (initializedCameraRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const blockedLeft = CONTROL_PANEL_LEFT + CONTROL_PANEL_WIDTH + CONTROL_PANEL_GUTTER
    const targetCenterX = (blockedLeft + rect.width) / 2
    setCamera({
      zoom: INITIAL_ZOOM,
      panX: targetCenterX - rect.width / 2,
      panY: 0,
    })
    initializedCameraRef.current = true
  }, [])

  const findIndexAtClientPoint = useCallback(
    (clientX: number, clientY: number): number => {
      const canvas = canvasRef.current
      if (!canvas) return -1
      const rect = canvas.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      return findCellAtPoint(x, y, rect.width, rect.height, layoutRef.current, camera, game)
    },
    [camera, game],
  )

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return

      dragRef.current = {
        pointerId: event.pointerId,
        active: true,
        moved: false,
        button: event.button,
        startX: event.clientX,
        startY: event.clientY,
        startPanX: camera.panX,
        startPanY: camera.panY,
      }
      canvas.setPointerCapture(event.pointerId)
    },
    [camera.panX, camera.panY],
  )

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    if (!drag.active || drag.pointerId !== event.pointerId) return
    if (drag.button !== 0) return

    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY
    if (Math.abs(deltaX) + Math.abs(deltaY) > 4) {
      dragRef.current.moved = true
    }

    setCamera((previous) => ({
      ...previous,
      panX: drag.startPanX + deltaX,
      panY: drag.startPanY + deltaY,
    }))
  }, [])

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const drag = dragRef.current
      if (!drag.active || drag.pointerId !== event.pointerId) return

      if (drag.button === 0 && !drag.moved) {
        const index = findIndexAtClientPoint(event.clientX, event.clientY)
        if (index >= 0) onReveal(index)
      }
      if (drag.button === 2 && !drag.moved) {
        const index = findIndexAtClientPoint(event.clientX, event.clientY)
        if (index >= 0) onRightClick(index)
      }

      dragRef.current.active = false
      dragRef.current.pointerId = -1
      dragRef.current.button = -1
      dragRef.current.moved = false
    },
    [findIndexAtClientPoint, onReveal, onRightClick],
  )

  const onWheel = useCallback((event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const pointerX = event.clientX - rect.left
    const pointerY = event.clientY - rect.top

    setCamera((previous) => {
      const zoomFactor = event.deltaY < 0 ? 1.12 : 1 / 1.12
      const nextZoom = Math.min(3, Math.max(0.45, previous.zoom * zoomFactor))
      const cx = rect.width / 2
      const cy = rect.height / 2
      const worldX = (pointerX - previous.panX - cx) / previous.zoom + cx
      const worldY = (pointerY - previous.panY - cy) / previous.zoom + cy
      const panX = pointerX - ((worldX - cx) * nextZoom + cx)
      const panY = pointerY - ((worldY - cy) * nextZoom + cy)
      return { zoom: nextZoom, panX, panY }
    })
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="block h-screen w-screen cursor-grab active:cursor-grabbing"
      aria-label="Hex minesweeper board"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      onContextMenu={(event) => event.preventDefault()}
    />
  )
}
