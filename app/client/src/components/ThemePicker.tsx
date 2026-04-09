/**
 * ThemePicker — floating panel with interactive color wheel
 */
import { useState, useCallback, useRef } from 'react'
import { buildPaletteFromHues, applyPalette, type ColorPalette } from '../lib/theme-clock'
import { ColorWheel, generateHuesFromMode, type HarmonyMode } from './ColorWheel'
import { createPortal } from 'react-dom'

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

function getHueName(hue: number): string {
  const h = ((hue % 360) + 360) % 360
  if (h < 15 || h >= 345) return 'red'
  if (h < 45) return 'orange'
  if (h < 75) return 'yellow'
  if (h < 105) return 'lime'
  if (h < 135) return 'green'
  if (h < 165) return 'teal'
  if (h < 195) return 'cyan'
  if (h < 225) return 'blue'
  if (h < 255) return 'indigo'
  if (h < 285) return 'purple'
  if (h < 315) return 'pink'
  return 'magenta'
}

function huesToPalette(hues: number[]): ColorPalette {
  return buildPaletteFromHues(hues[0], 'midday', {
    secondary: hues[1],
    tertiary: hues[2],
    complement: hues[3],
    accent: hues[4],
  })
}

function ConfigModal({ config, palette, onClose }: { config: string; palette: ColorPalette; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(config)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg rounded-2xl p-6 shadow-2xl"
        style={{ backgroundColor: `oklch(12% 0.015 ${palette.baseHue})`, border: `1px solid ${palette.border}` }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-white mb-1">🎨 Fixar Tema</h2>
        <p className="text-sm text-gray-400 mb-4">
          Cole este código em <code className="text-theme text-xs px-1.5 py-0.5 rounded bg-white/5">app/client/src/config/theme.config.ts</code>
        </p>

        <pre
          className="text-sm font-mono p-4 rounded-xl overflow-x-auto mb-4 leading-relaxed"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)', border: `1px solid ${palette.border}` }}
        >
          <code className="text-gray-300">{config}</code>
        </pre>

        <div className="flex items-center gap-2 text-xs text-gray-500 mb-4 p-3 rounded-xl" style={{ backgroundColor: palette.bgAccent }}>
          <span>💡</span>
          <span>Após colar, o Vite hot reload aplica o tema automaticamente. Para esconder o picker em produção, mantenha <code className="text-theme">showPicker: false</code>.</span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={copied
              ? { backgroundColor: 'oklch(70% 0.2 150)', color: 'white' }
              : { backgroundColor: palette.primary, color: 'white' }
            }
          >
            {copied ? '✓ Copiado!' : '📋 Copiar Código'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium btn-theme-ghost"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export function ThemePicker({ palette, onOverride }: ThemePickerProps) {
  const [open, setOpen] = useState(false)
  const [harmonyMode, setHarmonyMode] = useState<HarmonyMode>('analogous')
  const [hues, setHues] = useState<number[]>(() => generateHuesFromMode(palette.baseHue, 'analogous'))
  const [isManual, setIsManual] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const configRef = useRef('')

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

  const showConfig = useCallback(() => {
    const h = hues.map(h => Math.round(h))
    // Calculate relative offset from primary, normalized to -180..+180
    const offset = (target: number) => {
      let d = ((target - h[0]) % 360 + 540) % 360 - 180
      return d >= 0 ? `+${d}°` : `${d}°`
    }

    configRef.current = harmonyMode === 'custom'
      ? `export const themeConfig: ThemeConfig = {
  mode: 'custom',
  palette: {
    primary:    ${h[0]},  // ${getHueName(h[0])} (base)
    secondary:  ${h[1]},  // ${getHueName(h[1])} (${offset(h[1])} from primary)
    tertiary:   ${h[2]},  // ${getHueName(h[2])} (${offset(h[2])} from primary)
    complement: ${h[3]},  // ${getHueName(h[3])} (${offset(h[3])} from primary)
    accent:     ${h[4]},  // ${getHueName(h[4])} (${offset(h[4])} from primary)
  },
  showPicker: false,
}`
      : `export const themeConfig: ThemeConfig = {
  mode: 'fixed',
  hue: ${h[0]},  // ${getHueName(h[0])}
  showPicker: false,
}`
    setShowConfigModal(true)
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

      {/* Actions — always visible */}
      <div className="px-3 pb-3 flex gap-2">
        <button
          onClick={showConfig}
          className="flex-1 py-1.5 rounded-xl text-xs transition-all hover:opacity-80"
          style={{ backgroundColor: displayPalette.primaryMuted, color: displayPalette.textPrimary }}
        >
          📋 Fixar Tema
        </button>
        {isManual && (
          <button
            onClick={handleAuto}
            className="px-3 py-1.5 rounded-xl text-xs transition-all hover:opacity-80 border"
            style={{ borderColor: displayPalette.border, color: displayPalette.textSecondary }}
          >
            ↻
          </button>
        )}
      </div>

      {showConfigModal && (
        <ConfigModal
          config={configRef.current}
          palette={displayPalette}
          onClose={() => setShowConfigModal(false)}
        />
      )}
    </div>
  )
}
