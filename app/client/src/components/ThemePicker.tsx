/**
 * ThemePicker — floating panel to preview and override palette colors
 *
 * Shows the current auto-generated palette and lets the user
 * scrub a hue slider to override it. Clicking "Auto" returns
 * to the time-based palette.
 */
import { useState, useCallback } from 'react'
import { generatePalette, applyPalette, type ColorPalette } from '../lib/theme-clock'

interface ThemePickerProps {
  palette: ColorPalette
  onOverride: (palette: ColorPalette | null) => void
}

export function ThemePicker({ palette, onOverride }: ThemePickerProps) {
  const [open, setOpen] = useState(false)
  const [manualHue, setManualHue] = useState<number | null>(null)

  const handleHueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const hue = Number(e.target.value)
    setManualHue(hue)

    // Generate palette with custom time that produces this hue
    // hue = (totalMinutes / 1440 * 360 + 270) % 360
    // totalMinutes = ((hue - 270 + 360) % 360) / 360 * 1440
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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 w-10 h-10 rounded-full shadow-lg flex items-center justify-center text-white text-sm transition-all hover:scale-110"
        style={{ background: palette.gradientPrimary }}
        title="Theme Picker"
      >
        🎨
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-72 rounded-2xl shadow-2xl overflow-hidden"
      style={{ backgroundColor: '#0d0d1a', border: `1px solid ${palette.border}` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: `1px solid ${palette.border}` }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">🎨</span>
          <span className="text-white text-sm font-medium">Theme</span>
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ backgroundColor: palette.primaryMuted, color: palette.textPrimary }}
          >
            {manualHue !== null ? 'manual' : palette.period}
          </span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-gray-500 hover:text-white transition-colors text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* Swatches */}
      <div className="px-4 py-3">
        <div className="flex gap-1.5 mb-3">
          {swatches.map(s => (
            <div key={s.label} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full h-8 rounded-lg transition-all"
                style={{ backgroundColor: s.color }}
                title={s.label}
              />
              <span className="text-[9px] text-gray-500">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Hue slider */}
        <div className="mb-3">
          <label className="text-xs text-gray-400 mb-1 block">
            Base Hue: {Math.round(manualHue ?? palette.baseHue)}°
          </label>
          <input
            type="range"
            min="0"
            max="360"
            value={manualHue ?? palette.baseHue}
            onChange={handleHueChange}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right,
                oklch(65% 0.25 0),
                oklch(65% 0.25 60),
                oklch(65% 0.25 120),
                oklch(65% 0.25 180),
                oklch(65% 0.25 240),
                oklch(65% 0.25 300),
                oklch(65% 0.25 360)
              )`,
            }}
          />
        </div>

        {/* Preview gradient */}
        <div className="h-6 rounded-lg mb-3"
          style={{ background: palette.gradientPrimary }}
        />

        {/* Muted + glow preview */}
        <div className="flex gap-1.5 mb-3">
          <div className="flex-1 h-6 rounded-lg" style={{ backgroundColor: palette.primaryMuted }} title="Primary Muted" />
          <div className="flex-1 h-6 rounded-lg" style={{ backgroundColor: palette.bgAccent }} title="BG Accent" />
          <div className="flex-1 h-6 rounded-lg border" style={{ backgroundColor: 'transparent', borderColor: palette.borderActive }} title="Border Active" />
        </div>

        {/* Auto button */}
        {manualHue !== null && (
          <button
            onClick={handleAuto}
            className="w-full py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
            style={{ backgroundColor: palette.primaryMuted, color: palette.textPrimary }}
          >
            ↻ Back to Auto ({palette.period})
          </button>
        )}
      </div>
    </div>
  )
}
