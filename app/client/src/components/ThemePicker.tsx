/**
 * ThemePicker — floating panel with interactive color wheel
 *
 * Features:
 * - Color wheel with draggable base hue (like Adobe Color)
 * - Harmony mode selector (analogous, complementary, triadic, etc.)
 * - Palette swatches showing current harmony colors
 * - Auto mode (time-based) vs manual override
 */
import { useState, useCallback } from 'react'
import { generatePalette, applyPalette, type ColorPalette } from '../lib/theme-clock'
import { ColorWheel, type HarmonyMode } from './ColorWheel'

interface ThemePickerProps {
  palette: ColorPalette
  onOverride: (palette: ColorPalette | null) => void
}

const harmonyModes: { mode: HarmonyMode; label: string; icon: string }[] = [
  { mode: 'analogous', label: 'Análogo', icon: '◐' },
  { mode: 'complementary', label: 'Complementar', icon: '◑' },
  { mode: 'triadic', label: 'Triádico', icon: '△' },
  { mode: 'split-complementary', label: 'Split', icon: '⋔' },
  { mode: 'square', label: 'Quadrado', icon: '◻' },
  { mode: 'monochromatic', label: 'Mono', icon: '●' },
]

export function ThemePicker({ palette, onOverride }: ThemePickerProps) {
  const [open, setOpen] = useState(false)
  const [manualHue, setManualHue] = useState<number | null>(null)
  const [harmonyMode, setHarmonyMode] = useState<HarmonyMode>('analogous')

  const handleHueChange = useCallback((hue: number) => {
    setManualHue(hue)
    const totalMinutes = ((hue - 270 + 360) % 360) / 360 * 1440
    const fakeDate = new Date()
    fakeDate.setHours(Math.floor(totalMinutes / 60), Math.floor(totalMinutes % 60))
    const p = generatePalette(fakeDate)
    applyPalette(p)
    onOverride(p)
  }, [onOverride])

  const handleAuto = useCallback(() => {
    setManualHue(null)
    onOverride(null)
  }, [onOverride])

  const swatches = [
    { label: 'Primary', color: palette.primary },
    { label: 'Secondary', color: palette.secondary },
    { label: 'Tertiary', color: palette.tertiary },
    { label: 'Complement', color: palette.complement },
    { label: 'Accent', color: palette.accent },
  ]

  // Closed state — floating button
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white text-lg transition-all hover:scale-110 border border-white/10"
        style={{ background: palette.gradientPrimary }}
        title="Theme Picker"
      >
        🎨
      </button>
    )
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 rounded-2xl shadow-2xl overflow-hidden"
      style={{
        backgroundColor: `oklch(10% 0.015 ${palette.baseHue})`,
        border: `1px solid ${palette.border}`,
        width: '320px',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: `1px solid ${palette.border}` }}
      >
        <div className="flex items-center gap-2">
          <span>🎨</span>
          <span className="text-white text-sm font-semibold">Color Wheel</span>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ backgroundColor: palette.primaryMuted, color: palette.textPrimary }}
          >
            {manualHue !== null ? `${Math.round(manualHue)}°` : palette.period}
          </span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-gray-500 hover:text-white transition-colors text-lg leading-none w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10"
        >
          ×
        </button>
      </div>

      {/* Color Wheel */}
      <div className="flex justify-center py-4">
        <ColorWheel
          baseHue={manualHue ?? palette.baseHue}
          mode={harmonyMode}
          size={220}
          onChange={handleHueChange}
        />
      </div>

      {/* Harmony Mode Selector */}
      <div className="px-4 pb-3">
        <div className="flex gap-1">
          {harmonyModes.map(({ mode, label, icon }) => (
            <button
              key={mode}
              onClick={() => setHarmonyMode(mode)}
              className={`flex-1 py-1.5 rounded-lg text-xs transition-all ${
                harmonyMode === mode ? 'font-medium' : 'text-gray-500 hover:text-white'
              }`}
              style={harmonyMode === mode ? {
                backgroundColor: palette.primaryMuted,
                color: palette.textPrimary,
              } : undefined}
              title={label}
            >
              <div>{icon}</div>
            </button>
          ))}
        </div>
        <div className="text-center text-[10px] text-gray-500 mt-1">
          {harmonyModes.find(m => m.mode === harmonyMode)?.label}
        </div>
      </div>

      {/* Swatches */}
      <div className="px-4 pb-3">
        <div className="flex gap-1.5">
          {swatches.map(s => (
            <div key={s.label} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full h-7 rounded-lg transition-all"
                style={{ backgroundColor: s.color }}
                title={s.label}
              />
              <span className="text-[8px] text-gray-600">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Gradient preview */}
      <div className="px-4 pb-3">
        <div className="h-5 rounded-lg" style={{ background: palette.gradientPrimary }} />
      </div>

      {/* Copy Config button */}
      {manualHue !== null && (
        <div className="px-4 pb-2">
          <button
            onClick={() => {
              const hue = Math.round(manualHue)
              const config = `// Paste in app/client/src/config/theme.config.ts
export const themeConfig = {
  mode: 'fixed',
  hue: ${hue},
  showPicker: false,
}`
              navigator.clipboard.writeText(config)
              alert('Config copied! Paste in theme.config.ts')
            }}
            className="w-full py-1.5 rounded-xl text-xs transition-all hover:opacity-80 border"
            style={{ borderColor: palette.border, color: palette.textSecondary }}
          >
            📋 Copy Config
          </button>
        </div>
      )}

      {/* Auto button */}
      {manualHue !== null && (
        <div className="px-4 pb-4">
          <button
            onClick={handleAuto}
            className="w-full py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
            style={{ backgroundColor: palette.primaryMuted, color: palette.textPrimary }}
          >
            ↻ Auto ({palette.period})
          </button>
        </div>
      )}
    </div>
  )
}
