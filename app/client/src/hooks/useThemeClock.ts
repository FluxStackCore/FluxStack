/**
 * React hook for the palette system — respects theme.config.ts
 *
 * Modes:
 * - 'auto'   → palette shifts with time (updates every 30s)
 * - 'fixed'  → palette stays on configured hue with default offsets
 * - 'custom' → palette uses custom offsets or absolute hue positions
 */
import { useState, useEffect } from 'react'
import { generatePalette, buildPaletteFromHues, applyPalette, type ColorPalette } from '../lib/theme-clock'
import { themeConfig, DEFAULT_OFFSETS } from '../config/theme.config'

function getConfiguredPalette(): ColorPalette {
  const { mode, hue, offsets, palette } = themeConfig

  if (mode === 'custom') {
    // Absolute palette — each hue is defined explicitly
    if (palette) {
      return buildPaletteFromHues(palette.primary, 'midday', {
        secondary: palette.secondary,
        tertiary: palette.tertiary,
        complement: palette.complement,
        accent: palette.accent,
      })
    }

    // Offsets from base hue
    if (hue !== undefined) {
      const o = { ...DEFAULT_OFFSETS, ...offsets }
      return buildPaletteFromHues(hue, 'midday', {
        secondary: hue + o.secondary,
        tertiary: hue + o.tertiary,
        complement: hue + o.complement,
        accent: hue + o.accent,
      })
    }
  }

  if (mode === 'fixed' && hue !== undefined) {
    return buildPaletteFromHues(hue, 'midday')
  }

  // Auto mode
  return generatePalette()
}

export function useThemeClock(): ColorPalette {
  const [palette, setPalette] = useState<ColorPalette>(getConfiguredPalette)

  useEffect(() => {
    const initial = getConfiguredPalette()
    setPalette(initial)
    applyPalette(initial)

    if (themeConfig.mode === 'auto') {
      const interval = setInterval(() => {
        const p = generatePalette()
        setPalette(p)
        applyPalette(p)
      }, 30_000)
      return () => clearInterval(interval)
    }
  }, [])

  return palette
}
