import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { drawGameBoard, findCellAtPoint, type BoardLayout, type CameraState } from '../board'
import type { GameState } from '../game'
import { computeLayout } from '../board/layout'

const INITIAL_ZOOM = 0.9
const LONG_PRESS_MS = 350
const LONG_PRESS_FEEDBACK_MS = 260
const MIN_ZOOM = 0.7
const MAX_ZOOM = 3

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function distanceBetweenPoints(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function midpointBetweenPoints(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function drawFeedbackHex(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  ctx.beginPath()
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i - 30)
    const hx = x + radius * Math.cos(angle)
    const hy = y + radius * Math.sin(angle)
    if (i === 0) ctx.moveTo(hx, hy)
    else ctx.lineTo(hx, hy)
  }
  ctx.closePath()
}

function computeCenteredCamera(game: GameState | null, canvas: HTMLCanvasElement): CameraState {
  const rect = canvas.getBoundingClientRect()
  const targetCenterX = rect.width / 2
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
  const availableWidth = Math.max(180, rect.width - 24)
  const availableHeight = Math.max(180, rect.height - 24)
  const fitZoom = Math.min(availableWidth / activeWidth, availableHeight / activeHeight)
  const zoom = clamp(fitZoom * 0.95, MIN_ZOOM, MAX_ZOOM)

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

interface ActiveBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
  padding: number
}

function computeActiveBounds(game: GameState, width: number, height: number): ActiveBounds | null {
  const layout = computeLayout(width, height, game.rows, game.cols)
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let foundActive = false

  for (let index = 0; index < game.cells.length; index += 1) {
    if (!game.cells[index].active) continue
    foundActive = true
    const center = layout.centers[index]
    if (center.x < minX) minX = center.x
    if (center.x > maxX) maxX = center.x
    if (center.y < minY) minY = center.y
    if (center.y > maxY) maxY = center.y
  }

  if (!foundActive) return null
  return {
    minX,
    maxX,
    minY,
    maxY,
    padding: layout.radius * 1.15,
  }
}

function constrainCameraToBoard(
  camera: CameraState,
  canvas: HTMLCanvasElement | null,
  game: GameState | null,
): CameraState {
  if (!canvas || !game) return camera
  const rect = canvas.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return camera
  const bounds = computeActiveBounds(game, rect.width, rect.height)
  if (!bounds) return camera

  const minVisibleX = Math.min(120, rect.width * 0.35)
  const minVisibleY = Math.min(120, rect.height * 0.35)
  const cx = rect.width / 2
  const cy = rect.height / 2
  const boardLeft = (bounds.minX - bounds.padding - cx) * camera.zoom + cx
  const boardRight = (bounds.maxX + bounds.padding - cx) * camera.zoom + cx
  const boardTop = (bounds.minY - bounds.padding - cy) * camera.zoom + cy
  const boardBottom = (bounds.maxY + bounds.padding - cy) * camera.zoom + cy

  const minPanX = minVisibleX - boardRight
  const maxPanX = rect.width - minVisibleX - boardLeft
  const minPanY = minVisibleY - boardBottom
  const maxPanY = rect.height - minVisibleY - boardTop
  const panX = minPanX <= maxPanX ? clamp(camera.panX, minPanX, maxPanX) : (minPanX + maxPanX) / 2
  const panY = minPanY <= maxPanY ? clamp(camera.panY, minPanY, maxPanY) : (minPanY + maxPanY) / 2

  if (panX === camera.panX && panY === camera.panY) return camera
  return { ...camera, panX, panY }
}

export function BoardCanvas({ game, xrayMode, interactive, recenterToken = 0, onReveal, onRightClick }: BoardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const layoutRef = useRef<BoardLayout | null>(null)
  const [camera, setCamera] = useState<CameraState>({ zoom: 1, panX: 0, panY: 0 })
  const cameraRef = useRef<CameraState>(camera)
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
  const activeTouchPointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchRef = useRef({
    active: false,
    startDistance: 0,
    startZoom: 1,
    anchorWorldX: 0,
    anchorWorldY: 0,
  })
  const longPressRef = useRef({
    timerId: 0 as number,
    pointerId: -1,
    startX: 0,
    startY: 0,
    fired: false,
  })
  const longPressFeedbackRef = useRef<{
    x: number
    y: number
    startedAt: number
  } | null>(null)

  const clearLongPress = useCallback(() => {
    if (longPressRef.current.timerId !== 0) {
      window.clearTimeout(longPressRef.current.timerId)
    }
    longPressRef.current.timerId = 0
    longPressRef.current.pointerId = -1
    longPressRef.current.fired = false
  }, [])

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

    const feedback = longPressFeedbackRef.current
    if (!feedback) return
    const elapsed = performance.now() - feedback.startedAt
    if (elapsed >= LONG_PRESS_FEEDBACK_MS) {
      longPressFeedbackRef.current = null
      return
    }

    const progress = elapsed / LONG_PRESS_FEEDBACK_MS
    const radius = 78 - 60 * progress
    const alpha = 0.5 * (1 - progress)
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    drawFeedbackHex(ctx, feedback.x, feedback.y, radius)
    ctx.fillStyle = `rgba(16, 185, 129, ${alpha.toFixed(3)})`
    ctx.fill()
    drawFeedbackHex(ctx, feedback.x, feedback.y, Math.max(8, radius - 7))
    ctx.strokeStyle = `rgba(5, 150, 105, ${(alpha * 1.2).toFixed(3)})`
    ctx.lineWidth = 2.2
    ctx.stroke()
  }, [camera, game, hoveredCellIndex, interactive, xrayMode])

  useEffect(() => {
    draw()
    window.addEventListener('resize', draw)
    return () => {
      window.removeEventListener('resize', draw)
    }
  }, [draw])

  useEffect(() => {
    cameraRef.current = camera
  }, [camera])

  useEffect(() => {
    let rafId = 0
    const animate = () => {
      draw()
      rafId = window.requestAnimationFrame(animate)
    }
    rafId = window.requestAnimationFrame(animate)
    return () => window.cancelAnimationFrame(rafId)
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

      if (event.pointerType === 'touch') {
        event.preventDefault()
        activeTouchPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      }

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

      if (event.pointerType === 'touch') {
        const touchPointers = [...activeTouchPointersRef.current.values()]
        if (touchPointers.length >= 2) {
          clearLongPress()
          const [a, b] = touchPointers
          const startDistance = Math.max(1, distanceBetweenPoints(a, b))
          const midpoint = midpointBetweenPoints(a, b)
          const rect = canvas.getBoundingClientRect()
          const pointerX = midpoint.x - rect.left
          const pointerY = midpoint.y - rect.top
          const activeCamera = cameraRef.current
          const cx = rect.width / 2
          const cy = rect.height / 2

          pinchRef.current = {
            active: true,
            startDistance,
            startZoom: activeCamera.zoom,
            anchorWorldX: (pointerX - activeCamera.panX - cx) / activeCamera.zoom + cx,
            anchorWorldY: (pointerY - activeCamera.panY - cy) / activeCamera.zoom + cy,
          }
          dragRef.current.moved = true
          return
        }

        if (interactive && touchPointers.length === 1) {
          clearLongPress()
          longPressRef.current.pointerId = event.pointerId
          longPressRef.current.startX = event.clientX
          longPressRef.current.startY = event.clientY
          longPressRef.current.timerId = window.setTimeout(() => {
            if (longPressRef.current.pointerId !== event.pointerId) return
            if (!interactive) return
            const index = findIndexAtClientPoint(longPressRef.current.startX, longPressRef.current.startY)
            if (index >= 0) {
              const rect = canvas.getBoundingClientRect()
              longPressFeedbackRef.current = {
                x: longPressRef.current.startX - rect.left,
                y: longPressRef.current.startY - rect.top,
                startedAt: performance.now(),
              }
              onRightClick(index)
              longPressRef.current.fired = true
              dragRef.current.moved = true
            }
            longPressRef.current.timerId = 0
          }, LONG_PRESS_MS)
        }
      }
    },
    [camera.panX, camera.panY, clearLongPress, findIndexAtClientPoint, interactive, onRightClick],
  )

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'touch') {
      event.preventDefault()
      activeTouchPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      const touchPointers = [...activeTouchPointersRef.current.values()]

      if (touchPointers.length >= 2 && pinchRef.current.active) {
        const [a, b] = touchPointers
        const nextDistance = Math.max(1, distanceBetweenPoints(a, b))
        const midpoint = midpointBetweenPoints(a, b)
        const canvas = canvasRef.current
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const pointerX = midpoint.x - rect.left
        const pointerY = midpoint.y - rect.top
        const pinch = pinchRef.current

        setCamera(() => {
          const nextZoom = clamp(pinch.startZoom * (nextDistance / pinch.startDistance), MIN_ZOOM, MAX_ZOOM)
          const cx = rect.width / 2
          const cy = rect.height / 2
          const panX = pointerX - ((pinch.anchorWorldX - cx) * nextZoom + cx)
          const panY = pointerY - ((pinch.anchorWorldY - cy) * nextZoom + cy)
          return constrainCameraToBoard({ zoom: nextZoom, panX, panY }, canvas, game)
        })
        clearLongPress()
        dragRef.current.moved = true
        return
      }

      const longPress = longPressRef.current
      if (longPress.pointerId === event.pointerId && longPress.timerId !== 0) {
        const movedX = event.clientX - longPress.startX
        const movedY = event.clientY - longPress.startY
        if (Math.hypot(movedX, movedY) > 12) {
          clearLongPress()
        }
      }
    }

    const drag = dragRef.current
    if (drag.active && drag.pointerId === event.pointerId && drag.button === 0) {
      const deltaX = event.clientX - drag.startX
      const deltaY = event.clientY - drag.startY
      if (Math.abs(deltaX) + Math.abs(deltaY) > 4) {
        dragRef.current.moved = true
      }

      setCamera((previous) =>
        constrainCameraToBoard(
          {
            ...previous,
            panX: drag.startPanX + deltaX,
            panY: drag.startPanY + deltaY,
          },
          canvasRef.current,
          game,
        ),
      )
      return
    }

    if (event.pointerType === 'touch') return
    if (drag.active && drag.pointerId === event.pointerId) return
    const index = findIndexAtClientPoint(event.clientX, event.clientY)
    setHoveredCellIndex((previous) => (previous === index ? previous : index >= 0 ? index : null))
  }, [clearLongPress, findIndexAtClientPoint])

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (event.pointerType === 'touch') {
        event.preventDefault()
        activeTouchPointersRef.current.delete(event.pointerId)
        const touchPointers = [...activeTouchPointersRef.current.values()]
        if (touchPointers.length < 2) {
          pinchRef.current.active = false
        }
      }

      const drag = dragRef.current
      if (!drag.active || drag.pointerId !== event.pointerId) return
      const didLongPress = longPressRef.current.pointerId === event.pointerId && longPressRef.current.fired
      if (interactive && drag.button === 0 && !drag.moved && !didLongPress) {
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

      if (longPressRef.current.pointerId === event.pointerId) {
        clearLongPress()
      }
    },
    [clearLongPress, findIndexAtClientPoint, interactive, onReveal, onRightClick],
  )

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (event.pointerType === 'touch') {
        activeTouchPointersRef.current.delete(event.pointerId)
        if (activeTouchPointersRef.current.size < 2) {
          pinchRef.current.active = false
        }
      }
      if (longPressRef.current.pointerId === event.pointerId) {
        clearLongPress()
      }
      if (dragRef.current.pointerId === event.pointerId) {
        dragRef.current.active = false
        dragRef.current.pointerId = -1
        dragRef.current.button = -1
        dragRef.current.moved = false
      }
    },
    [clearLongPress],
  )

  useEffect(() => clearLongPress, [clearLongPress])

  const onWheel = useCallback((event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const pointerX = event.clientX - rect.left
    const pointerY = event.clientY - rect.top

    setCamera((previous) => {
      const zoomFactor = event.deltaY < 0 ? 1.12 : 1 / 1.12
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, previous.zoom * zoomFactor))
      const cx = rect.width / 2
      const cy = rect.height / 2
      const worldX = (pointerX - previous.panX - cx) / previous.zoom + cx
      const worldY = (pointerY - previous.panY - cy) / previous.zoom + cy
      const panX = pointerX - ((worldX - cx) * nextZoom + cx)
      const panY = pointerY - ((worldY - cy) * nextZoom + cy)
      return constrainCameraToBoard({ zoom: nextZoom, panX, panY }, canvas, game)
    })
  }, [game])

  return (
    <canvas
      ref={canvasRef}
      className="block h-screen w-screen touch-none select-none cursor-grab active:cursor-grabbing"
      aria-label="Hex minesweeper board"
      style={{ WebkitTouchCallout: 'none', WebkitTapHighlightColor: 'transparent' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={() => setHoveredCellIndex(null)}
      onWheel={onWheel}
      onDragStart={(event) => event.preventDefault()}
      onContextMenu={(event) => event.preventDefault()}
    />
  )
}
