/**
 * ColorWheel — Interactive color wheel like Adobe Color
 *
 * Features:
 * - Circular hue wheel with draggable base point
 * - Harmony dots (analogous, complementary, triadic, etc.)
 * - Visual connection lines between harmony points
 * - Click/drag to change base hue
 */
import { useRef, useState, useCallback, useEffect } from 'react'

export type HarmonyMode = 'analogous' | 'complementary' | 'triadic' | 'split-complementary' | 'square' | 'monochromatic'

interface ColorWheelProps {
  baseHue: number
  mode: HarmonyMode
  size?: number
  onChange: (hue: number) => void
}

/** Get harmony hue offsets for each mode */
function getHarmonyOffsets(mode: HarmonyMode): number[] {
  switch (mode) {
    case 'analogous':           return [0, -30, 30, -60, 60]
    case 'complementary':       return [0, 180]
    case 'triadic':             return [0, 120, 240]
    case 'split-complementary': return [0, 150, 210]
    case 'square':              return [0, 90, 180, 270]
    case 'monochromatic':       return [0]
  }
}

/** Convert hue to position on the wheel */
function hueToXY(hue: number, radius: number, cx: number, cy: number): { x: number; y: number } {
  const rad = ((hue - 90) * Math.PI) / 180 // -90 so 0° is at top
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  }
}

/** Convert mouse position to hue */
function xyToHue(x: number, y: number, cx: number, cy: number): number {
  const rad = Math.atan2(y - cy, x - cx)
  return ((rad * 180) / Math.PI + 90 + 360) % 360
}

export function ColorWheel({ baseHue, mode, size = 200, onChange }: ColorWheelProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [dragging, setDragging] = useState(false)

  const cx = size / 2
  const cy = size / 2
  const outerR = size / 2 - 8
  const innerR = outerR - 24
  const dotR = outerR - 12 // radius where dots sit (middle of ring)

  const offsets = getHarmonyOffsets(mode)
  const harmonyHues = offsets.map(o => (baseHue + o + 360) % 360)

  const getMouseHue = useCallback((e: React.MouseEvent | MouseEvent) => {
    const svg = svgRef.current
    if (!svg) return baseHue
    const rect = svg.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    return xyToHue(x, y, cx, cy)
  }, [baseHue, cx, cy])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(true)
    onChange(getMouseHue(e))
  }, [getMouseHue, onChange])

  useEffect(() => {
    if (!dragging) return

    const handleMove = (e: MouseEvent) => {
      onChange(getMouseHue(e))
    }
    const handleUp = () => setDragging(false)

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [dragging, getMouseHue, onChange])

  // Generate conic gradient stops for the wheel
  const wheelStops = Array.from({ length: 13 }, (_, i) => {
    const h = (i / 12) * 360
    return `oklch(70% 0.2 ${h}) ${(i / 12) * 100}%`
  }).join(', ')

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      onMouseDown={handleMouseDown}
      style={{ cursor: dragging ? 'grabbing' : 'pointer', userSelect: 'none' }}
    >
      {/* Hue ring using many arc segments */}
      {Array.from({ length: 72 }, (_, i) => {
        const startAngle = (i / 72) * 360
        const endAngle = ((i + 1) / 72) * 360
        const startRad = ((startAngle - 90) * Math.PI) / 180
        const endRad = ((endAngle - 90) * Math.PI) / 180

        const x1o = cx + outerR * Math.cos(startRad)
        const y1o = cy + outerR * Math.sin(startRad)
        const x2o = cx + outerR * Math.cos(endRad)
        const y2o = cy + outerR * Math.sin(endRad)
        const x1i = cx + innerR * Math.cos(endRad)
        const y1i = cy + innerR * Math.sin(endRad)
        const x2i = cx + innerR * Math.cos(startRad)
        const y2i = cy + innerR * Math.sin(startRad)

        const hue = startAngle
        return (
          <path
            key={i}
            d={`M ${x1o} ${y1o} A ${outerR} ${outerR} 0 0 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${innerR} ${innerR} 0 0 0 ${x2i} ${y2i} Z`}
            fill={`oklch(70% 0.22 ${hue})`}
            stroke="none"
          />
        )
      })}

      {/* Inner dark circle */}
      <circle cx={cx} cy={cy} r={innerR - 2} fill="#0a0a1a" />

      {/* Connection lines between harmony points */}
      {harmonyHues.length > 1 && (
        <polygon
          points={harmonyHues.map(h => {
            const p = hueToXY(h, dotR * 0.6, cx, cy)
            return `${p.x},${p.y}`
          }).join(' ')}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1"
        />
      )}

      {/* Center preview — shows blended color */}
      <circle
        cx={cx} cy={cy} r={innerR * 0.4}
        fill={`oklch(65% 0.25 ${baseHue})`}
        opacity="0.8"
      />
      <text
        x={cx} y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize="11"
        fontWeight="600"
      >
        {Math.round(baseHue)}°
      </text>

      {/* Harmony dots */}
      {harmonyHues.map((hue, i) => {
        const pos = hueToXY(hue, dotR, cx, cy)
        const isBase = i === 0
        return (
          <g key={i}>
            {/* Glow */}
            <circle
              cx={pos.x} cy={pos.y} r={isBase ? 10 : 7}
              fill={`oklch(65% 0.25 ${hue} / 0.4)`}
              filter="blur(2px)"
            />
            {/* Dot */}
            <circle
              cx={pos.x} cy={pos.y} r={isBase ? 8 : 6}
              fill={`oklch(65% 0.25 ${hue})`}
              stroke="white"
              strokeWidth={isBase ? 2.5 : 1.5}
            />
          </g>
        )
      })}
    </svg>
  )
}
