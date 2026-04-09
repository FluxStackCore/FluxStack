/**
 * React hook for the palette clock — provides current color palette
 * that shifts with the time of day. Updates every 30 seconds.
 */
import { useState, useEffect } from 'react'
import { generatePalette, applyPalette, type ColorPalette } from '../lib/theme-clock'

export function useThemeClock(): ColorPalette {
  const [palette, setPalette] = useState<ColorPalette>(() => generatePalette())

  useEffect(() => {
    const update = () => {
      const p = generatePalette()
      setPalette(p)
      applyPalette(p)
    }

    update()
    const interval = setInterval(update, 30_000)
    return () => clearInterval(interval)
  }, [])

  return palette
}
