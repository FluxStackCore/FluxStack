'use client'
/**
 * ColorWheel — Interactive color wheel like Adobe Color
 *
 * Modes:
 * - Preset harmonies: all dots move together based on base hue
 * - Custom: each dot is independently draggable
 */
import { useRef, useState, useCallback, useEffect } from 'react'

export type HarmonyMode = 'analogous' | 'complementary' | 'triadic' | 'split-complementary' | 'square' | 'monochromatic' | 'custom'

interface ColorWheelProps {
  /** Hues for each point: [primary, secondary, tertiary, complement, accent] */
  hues: number[]
  mode: HarmonyMode
  size?: number
  /** Called when any hue changes. index = which point, hue = new value */
  onChange: (index: number, hue: number) => void
}

const POINT_LABELS = ['P', 'S', 'T', 'C', 'A']

/** Get harmony offsets for preset modes */
function getHarmonyOffsets(mode: HarmonyMode): number[] {
  switch (mode) {
    case 'analogous':           return [0, -30, 30, -60, 60]
    case 'complementary':       return [0, 180]
    case 'triadic':             return [0, 120, 240]
    case 'split-complementary': return [0, 150, 210]
    case 'square':              return [0, 90, 180, 270]
    case 'monochromatic':       return [0]
    case 'custom':              return [0, 40, -30, 180, 120] // defaults, but each is independent
  }
}

/** Get number of points for each mode */
export function getPointCount(mode: HarmonyMode): number {
  return getHarmonyOffsets(mode).length
}

/** Generate initial hues from base hue and mode */
export function generateHuesFromMode(baseHue: number, mode: HarmonyMode): number[] {
  return getHarmonyOffsets(mode).map(o => ((baseHue + o) % 360 + 360) % 360)
}

function hueToXY(hue: number, radius: number, cx: number, cy: number) {
  const rad = ((hue - 90) * Math.PI) / 180
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
}

function xyToHue(x: number, y: number, cx: number, cy: number): number {
  return ((Math.atan2(y - cy, x - cx) * 180) / Math.PI + 90 + 360) % 360
}

export function ColorWheel({ hues, mode, size = 220, onChange }: ColorWheelProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [dragging, setDragging] = useState<number | null>(null) // index of dragged point

  const cx = size / 2
  const cy = size / 2
  const outerR = size / 2 - 8
  const innerR = outerR - 24
  const dotR = outerR - 12

  const isCustom = mode === 'custom'

  const getMouseHue = useCallback((e: MouseEvent | React.MouseEvent) => {
    const svg = svgRef.current
    if (!svg) return 0
    const rect = svg.getBoundingClientRect()
    return xyToHue(e.clientX - rect.left, e.clientY - rect.top, cx, cy)
  }, [cx, cy])

  // Mouse down on a specific point
  const handlePointDown = useCallback((e: React.MouseEvent, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(index)
  }, [])

  // Mouse down on wheel background — moves the base (index 0)
  // Click on wheel background = rotate ALL points together (preserving relative positions)
  const handleWheelDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(-1) // -1 = rotate all
    const hue = getMouseHue(e)
    const delta = hue - hues[0]
    for (let i = 0; i < hues.length; i++) {
      onChange(i, ((hues[i] + delta) % 360 + 360) % 360)
    }
  }, [getMouseHue, hues, onChange])

  useEffect(() => {
    if (dragging === null) return

    const handleMove = (e: MouseEvent) => {
      const hue = getMouseHue(e)
      if (dragging === -1) {
        // Rotate all points together (background drag)
        const delta = hue - hues[0]
        for (let i = 0; i < hues.length; i++) {
          onChange(i, ((hues[i] + delta) % 360 + 360) % 360)
        }
      } else if (isCustom) {
        // Custom mode: move only the dragged point
        onChange(dragging, hue)
      } else {
        // Preset mode: move all points relative to base
        const delta = hue - hues[0]
        for (let i = 0; i < hues.length; i++) {
          onChange(i, ((hues[i] + delta) % 360 + 360) % 360)
        }
      }
    }
    const handleUp = () => setDragging(null)

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [dragging, getMouseHue, hues, isCustom, onChange])

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      onMouseDown={handleWheelDown}
      style={{ cursor: dragging !== null ? 'grabbing' : 'pointer', userSelect: 'none' }}
    >
      {/* Hue ring segments */}
      {Array.from({ length: 72 }, (_, i) => {
        const a1 = (i / 72) * 360
        const a2 = ((i + 1) / 72) * 360
        const r1 = ((a1 - 90) * Math.PI) / 180
        const r2 = ((a2 - 90) * Math.PI) / 180
        return (
          <path
            key={i}
            d={`M ${cx + outerR * Math.cos(r1)} ${cy + outerR * Math.sin(r1)} A ${outerR} ${outerR} 0 0 1 ${cx + outerR * Math.cos(r2)} ${cy + outerR * Math.sin(r2)} L ${cx + innerR * Math.cos(r2)} ${cy + innerR * Math.sin(r2)} A ${innerR} ${innerR} 0 0 0 ${cx + innerR * Math.cos(r1)} ${cy + innerR * Math.sin(r1)} Z`}
            fill={`oklch(70% 0.22 ${a1})`}
          />
        )
      })}

      {/* Inner dark circle */}
      <circle cx={cx} cy={cy} r={innerR - 2} fill="#0a0a1a" />

      {/* Connection lines */}
      {hues.length > 1 && (
        <polygon
          points={hues.map(h => {
            const p = hueToXY(h, dotR * 0.55, cx, cy)
            return `${p.x},${p.y}`
          }).join(' ')}
          fill={`oklch(65% 0.15 ${hues[0]} / 0.08)`}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
        />
      )}

      {/* Center color preview */}
      <circle cx={cx} cy={cy} r={innerR * 0.35} fill={`oklch(65% 0.25 ${hues[0]})`} opacity="0.8" />
      <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="central" fill="white" fontSize="11" fontWeight="700">
        {Math.round(hues[0])}°
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" dominantBaseline="central" fill="rgba(255,255,255,0.5)" fontSize="8">
        {isCustom ? 'CUSTOM' : mode.toUpperCase()}
      </text>

      {/* Harmony dots — each draggable in custom mode */}
      {hues.map((hue, i) => {
        const pos = hueToXY(hue, dotR, cx, cy)
        const isBase = i === 0
        const isDraggable = isCustom || isBase
        const r = isBase ? 9 : 7
        return (
          <g
            key={i}
            onMouseDown={isDraggable ? (e) => handlePointDown(e, i) : undefined}
            style={{ cursor: isDraggable ? 'grab' : 'default' }}
          >
            <circle cx={pos.x} cy={pos.y} r={r + 3} fill={`oklch(65% 0.25 ${hue} / 0.3)`} />
            <circle cx={pos.x} cy={pos.y} r={r} fill={`oklch(65% 0.25 ${hue})`} stroke="white" strokeWidth={isBase ? 2.5 : 1.5} />
            <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central" fill="white" fontSize="7" fontWeight="600" pointerEvents="none">
              {POINT_LABELS[i] || ''}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
