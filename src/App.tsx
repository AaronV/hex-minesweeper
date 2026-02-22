import { useEffect, useRef } from 'react'

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const drawHex = (x: number, y: number, radius: number, fillStyle: string, strokeStyle: string) => {
      ctx.beginPath()
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI / 180) * (60 * i - 30)
        const px = x + radius * Math.cos(angle)
        const py = y + radius * Math.sin(angle)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fillStyle = fillStyle
      ctx.strokeStyle = strokeStyle
      ctx.lineWidth = 1
      ctx.fill()
      ctx.stroke()
    }

    const render = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.floor(rect.width * dpr)
      canvas.height = Math.floor(rect.height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const { width, height } = rect

      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#020617'
      ctx.fillRect(0, 0, width, height)

      const radius = 22
      const xStep = Math.sqrt(3) * radius
      const yStep = 1.5 * radius
      const cols = Math.ceil(width / xStep) + 1
      const rows = Math.ceil(height / yStep) + 1

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const x = col * xStep + (row % 2 === 0 ? xStep / 2 : xStep)
          const y = row * yStep + radius
          drawHex(
            x,
            y,
            radius - 1,
            'rgba(15, 23, 42, 0.92)',
            'rgba(148, 163, 184, 0.24)',
          )
        }
      }
    }

    render()
    window.addEventListener('resize', render)

    return () => {
      window.removeEventListener('resize', render)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="block h-screen w-screen"
      aria-label="Static hex tile background"
    />
  )
}

export default App
