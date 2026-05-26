import { useCallback, useEffect, useRef } from 'react'

export default function SignaturePad({
  onChange,
  height = 140,
}: {
  onChange: (dataUrl: string | null) => void
  height?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const emit = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    onChange(canvas.toDataURL('image/png'))
  }, [onChange])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = canvas.offsetWidth * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)
    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
  }, [height])

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true
    const ctx = canvasRef.current?.getContext('2d')
    const { x, y } = getPoint(e)
    ctx?.beginPath()
    ctx?.moveTo(x, y)
  }

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    const { x, y } = getPoint(e)
    ctx?.lineTo(x, y)
    ctx?.stroke()
  }

  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    emit()
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    onChange(null)
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="w-full rounded-lg border border-[#2a2a2e] bg-[#0a0a0c] touch-none"
        style={{ height }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <button type="button" className="staff-portal__btn-ghost mt-2" onClick={clear}>
        Clear signature
      </button>
    </div>
  )
}
