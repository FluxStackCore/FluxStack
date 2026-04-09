/**
 * React hook for the palette system — respects theme.config.ts
 *
 * - 'auto' mode: palette shifts with time of day (updates every 30s)
 * - 'fixed' mode: palette stays on the configured hue
 */
import { useState, useEffect } from 'react'
import { generatePalette, generatePaletteForHue, applyPalette, type ColorPalette } from '../lib/theme-clock'
import { themeConfig } from '../config/theme.config'

function getInitialPalette(): ColorPalette {
  if (themeConfig.mode === 'fixed' && themeConfig.hue !== undefined) {
    return generatePaletteForHue(themeConfig.hue)
  }
  return generatePalette()
}

export function useThemeClock(): ColorPalette {
  const [palette, setPalette] = useState<ColorPalette>(getInitialPalette)

  useEffect(() => {
    const initial = getInitialPalette()
    setPalette(initial)
    applyPalette(initial)

    // Only run interval in auto mode
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
