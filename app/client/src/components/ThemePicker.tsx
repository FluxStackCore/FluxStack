/**
 * ThemePicker — floating panel with interactive color wheel
 */
import { useState, useCallback } from 'react'
import { buildPaletteFromHues, applyPalette, type ColorPalette } from '../lib/theme-clock'
import { ColorWheel, generateHuesFromMode, type HarmonyMode } from './ColorWheel'

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
  { mode: 'custom', label: 'Custom', icon: '✦' },
]

function huesToPalette(hues: number[]): ColorPalette {
  return buildPaletteFromHues(hues[0], 'midday', {
    secondary: hues[1],
    tertiary: hues[2],
    complement: hues[3],
    accent: hues[4],
  })
}

export function ThemePicker({ palette, onOverride }: ThemePickerProps) {
  const [open, setOpen] = useState(false)
  const [harmonyMode, setHarmonyMode] = useState<HarmonyMode>('analogous')
  const [hues, setHues] = useState<number[]>(() => generateHuesFromMode(palette.baseHue, 'analogous'))
  const [isManual, setIsManual] = useState(false)

  const handleHueChange = useCallback((index: number, hue: number) => {
    setIsManual(true)
    setHues(prev => {
      const next = [...prev]
      next[index] = hue
      return next
    })
    // Build palette from current hues with the new one
    const updated = [...hues]
    updated[index] = hue
    // Pad to 5 hues
    while (updated.length < 5) updated.push(updated[0])
    const p = huesToPalette(updated)
    applyPalette(p)
    onOverride(p)
  }, [hues, onOverride])

  const handleModeChange = useCallback((mode: HarmonyMode) => {
    setHarmonyMode(mode)
    const baseHue = hues[0] ?? palette.baseHue
    const newHues = generateHuesFromMode(baseHue, mode)
    // Pad to 5 for custom
    while (newHues.length < 5) newHues.push(baseHue)
    setHues(newHues)
    if (isManual) {
      const p = huesToPalette(newHues)
      applyPalette(p)
      onOverride(p)
    }
  }, [hues, palette.baseHue, isManual, onOverride])

  const handleAuto = useCallback(() => {
    setIsManual(false)
    onOverride(null)
  }, [onOverride])

  const copyConfig = useCallback(() => {
    const h = hues.map(h => Math.round(h))
    const config = harmonyMode === 'custom'
      ? `export const themeConfig = {
  mode: 'custom' as const,
  palette: {
    primary:    ${h[0]},
    secondary:  ${h[1]},
    tertiary:   ${h[2]},
    complement: ${h[3]},
    accent:     ${h[4]},
  },
  showPicker: false,
}`
      : `export const themeConfig = {
  mode: 'fixed' as const,
  hue: ${h[0]},
  showPicker: false,
}`
    navigator.clipboard.writeText(config)
  }, [hues, harmonyMode])

  const swatchLabels = ['Primary', 'Secondary', 'Tertiary', 'Complement', 'Accent']
  const displayHues = [...hues]
  while (displayHues.length < 5) displayHues.push(displayHues[0] ?? 0)
  const displayPalette = isManual ? huesToPalette(displayHues) : palette

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
        backgroundColor: `oklch(10% 0.015 ${displayPalette.baseHue})`,
        border: `1px solid ${displayPalette.border}`,
        width: '320px',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: `1px solid ${displayPalette.border}` }}
      >
        <div className="flex items-center gap-2">
          <span>🎨</span>
          <span className="text-white text-sm font-semibold">Color Wheel</span>
          {isManual && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: displayPalette.primaryMuted, color: displayPalette.textPrimary }}
            >
              {harmonyMode === 'custom' ? 'custom' : Math.round(hues[0]) + '°'}
            </span>
          )}
        </div>
        <button onClick={() => setOpen(false)}
          className="text-gray-500 hover:text-white transition-colors text-lg leading-none w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10"
        >×</button>
      </div>

      {/* Color Wheel */}
      <div className="flex justify-center py-3">
        <ColorWheel
          hues={displayHues}
          mode={harmonyMode}
          size={210}
          onChange={handleHueChange}
        />
      </div>

      {/* Harmony Mode Selector */}
      <div className="px-3 pb-2">
        <div className="flex gap-0.5">
          {harmonyModes.map(({ mode, label, icon }) => (
            <button
              key={mode}
              onClick={() => handleModeChange(mode)}
              className={`flex-1 py-1.5 rounded-lg text-xs transition-all ${
                harmonyMode === mode ? 'font-medium' : 'text-gray-500 hover:text-white'
              }`}
              style={harmonyMode === mode ? {
                backgroundColor: displayPalette.primaryMuted,
                color: displayPalette.textPrimary,
              } : undefined}
              title={label}
            >
              {icon}
            </button>
          ))}
        </div>
        <div className="text-center text-[10px] text-gray-500 mt-0.5">
          {harmonyModes.find(m => m.mode === harmonyMode)?.label}
          {harmonyMode === 'custom' && ' — dot = move one · ring = rotate all'}
        </div>
      </div>

      {/* Swatches with hue labels */}
      <div className="px-3 pb-2">
        <div className="flex gap-1">
          {displayHues.slice(0, 5).map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full h-6 rounded-lg" style={{ backgroundColor: `oklch(65% 0.25 ${h})` }} title={swatchLabels[i]} />
              <span className="text-[8px] text-gray-600">{Math.round(h)}°</span>
            </div>
          ))}
        </div>
      </div>

      {/* Gradient preview */}
      <div className="px-3 pb-2">
        <div className="h-4 rounded-lg" style={{ background: displayPalette.gradientPrimary }} />
      </div>

      {/* Actions */}
      {isManual && (
        <div className="px-3 pb-3 flex gap-2">
          <button
            onClick={copyConfig}
            className="flex-1 py-1.5 rounded-xl text-xs transition-all hover:opacity-80 border"
            style={{ borderColor: displayPalette.border, color: displayPalette.textSecondary }}
          >
            📋 Copy
          </button>
          <button
            onClick={handleAuto}
            className="flex-1 py-1.5 rounded-xl text-xs transition-all hover:opacity-80"
            style={{ backgroundColor: displayPalette.primaryMuted, color: displayPalette.textPrimary }}
          >
            ↻ Auto
          </button>
        </div>
      )}
    </div>
  )
}
