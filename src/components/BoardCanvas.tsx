import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { drawGameBoard, findCellAtPoint, type BoardLayout, type CameraState } from '../board'
import type { GameState } from '../game'
import { computeLayout } from '../board/layout'

const INITIAL_ZOOM = 0.9
const CONTROL_PANEL_LEFT = 12
const CONTROL_PANEL_WIDTH = 320
const CONTROL_PANEL_GUTTER = 12

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function computeCenteredCamera(game: GameState | null, canvas: HTMLCanvasElement): CameraState {
  const rect = canvas.getBoundingClientRect()
  const blockedLeft = CONTROL_PANEL_LEFT + CONTROL_PANEL_WIDTH + CONTROL_PANEL_GUTTER
  const targetCenterX = (blockedLeft + rect.width) / 2
  const targetCenterY = rect.height / 2

  if (!game) {
    return {
      zoom: INITIAL_ZOOM,
      panX: targetCenterX - rect.width / 2,
      panY: 0,
    }
  }

  const layout = computeLayout(rect.width, rect.height, game.rows, game.cols)
  const activeCenters = layout.centers.filter((_, index) => game.cells[index]?.active)
  if (activeCenters.length === 0) {
    return {
      zoom: INITIAL_ZOOM,
      panX: targetCenterX - rect.width / 2,
      panY: 0,
    }
  }

  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const center of activeCenters) {
    if (center.x < minX) minX = center.x
    if (center.x > maxX) maxX = center.x
    if (center.y < minY) minY = center.y
    if (center.y > maxY) maxY = center.y
  }

  const activeCenterX = (minX + maxX) / 2
  const activeCenterY = (minY + maxY) / 2
  const activeWidth = Math.max(layout.radius * Math.sqrt(3), maxX - minX + layout.radius * Math.sqrt(3))
  const activeHeight = Math.max(layout.radius * 2, maxY - minY + layout.radius * 2)
  const availableWidth = Math.max(180, rect.width - blockedLeft - 20)
  const availableHeight = Math.max(180, rect.height - 24)
  const fitZoom = Math.min(availableWidth / activeWidth, availableHeight / activeHeight)
  const zoom = clamp(fitZoom * 0.95, 0.45, 3)

  const panX = targetCenterX - ((activeCenterX - rect.width / 2) * zoom + rect.width / 2)
  const panY = targetCenterY - ((activeCenterY - rect.height / 2) * zoom + rect.height / 2)
  return { zoom, panX, panY }
}

interface BoardCanvasProps {
  game: GameState | null
  xrayMode: boolean
  interactive: boolean
  recenterToken?: number
  onReveal: (index: number) => void
  onRightClick: (index: number) => void
}

export function BoardCanvas({ game, xrayMode, interactive, recenterToken = 0, onReveal, onRightClick }: BoardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const layoutRef = useRef<BoardLayout | null>(null)
  const [camera, setCamera] = useState<CameraState>({ zoom: 1, panX: 0, panY: 0 })
  const [hoveredCellIndex, setHoveredCellIndex] = useState<number | null>(null)
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
    if (!game) {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.floor(rect.width * dpr)
      canvas.height = Math.floor(rect.height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(0, 0, rect.width, rect.height)
      layoutRef.current = null
      return
    }
    layoutRef.current = drawGameBoard(canvas, game, camera, xrayMode, !interactive && xrayMode, hoveredCellIndex)
  }, [camera, game, hoveredCellIndex, interactive, xrayMode])

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
    setCamera(computeCenteredCamera(game, canvas))
    initializedCameraRef.current = true
  }, [game])

  useEffect(() => {
    if (!initializedCameraRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    setCamera(computeCenteredCamera(game, canvas))
  }, [recenterToken])

  const findIndexAtClientPoint = useCallback(
    (clientX: number, clientY: number): number => {
      const canvas = canvasRef.current
      if (!canvas) return -1
      const rect = canvas.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      if (!game) return -1
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
    if (drag.active && drag.pointerId === event.pointerId && drag.button === 0) {
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
      return
    }

    if (drag.active && drag.pointerId === event.pointerId) return
    const index = findIndexAtClientPoint(event.clientX, event.clientY)
    setHoveredCellIndex((previous) => (previous === index ? previous : index >= 0 ? index : null))
  }, [findIndexAtClientPoint])

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const drag = dragRef.current
      if (!drag.active || drag.pointerId !== event.pointerId) return
      if (interactive && drag.button === 0 && !drag.moved) {
        const index = findIndexAtClientPoint(event.clientX, event.clientY)
        if (index >= 0) onReveal(index)
      }
      if (interactive && drag.button === 2 && !drag.moved) {
        const index = findIndexAtClientPoint(event.clientX, event.clientY)
        if (index >= 0) onRightClick(index)
      }
      const hoverIndex = findIndexAtClientPoint(event.clientX, event.clientY)
      setHoveredCellIndex((previous) => (previous === hoverIndex ? previous : hoverIndex >= 0 ? hoverIndex : null))

      dragRef.current.active = false
      dragRef.current.pointerId = -1
      dragRef.current.button = -1
      dragRef.current.moved = false
    },
    [findIndexAtClientPoint, interactive, onReveal, onRightClick],
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
      onPointerLeave={() => setHoveredCellIndex(null)}
      onWheel={onWheel}
      onContextMenu={(event) => event.preventDefault()}
    />
  )
}
