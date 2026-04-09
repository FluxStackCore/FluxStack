/**
 * Theme Clock — Generates complete color palettes that shift with time
 *
 * Based on color theory (like Adobe Color Wheel):
 * - Base hue rotates continuously through 360° over 24 hours
 * - Palette is generated using color harmony rules (analogous, complementary, triadic)
 * - Colors use OKLCH for perceptual uniformity (consistent brightness across hues)
 *
 * Periods & their base hues:
 * - 00:00 → 270° (violet)     — deep night
 * - 04:00 → 330° (magenta)    — pre-dawn
 * - 06:00 → 30°  (orange)     — sunrise
 * - 09:00 → 60°  (gold)       — morning
 * - 12:00 → 150° (teal)       — midday
 * - 15:00 → 210° (blue)       — afternoon
 * - 18:00 → 330° (pink)       — sunset
 * - 21:00 → 270° (purple)     — evening
 */

// ===== Color Math =====

/** Normalize hue to 0-360 range */
function normalizeHue(h: number): number {
  return ((h % 360) + 360) % 360
}

/** Generate an OKLCH color string */
function oklch(l: number, c: number, h: number, alpha?: number): string {
  const hNorm = normalizeHue(h)
  return alpha !== undefined
    ? `oklch(${l}% ${c} ${hNorm} / ${alpha})`
    : `oklch(${l}% ${c} ${hNorm})`
}

// ===== Palette Generation =====

export interface ColorPalette {
  /** Base hue (0-360) — rotates with time */
  baseHue: number

  /** Primary accent — most vibrant */
  primary: string
  /** Secondary — analogous offset (+40°) */
  secondary: string
  /** Tertiary — analogous offset (-30°) */
  tertiary: string
  /** Complement — opposite side of wheel (+180°) */
  complement: string
  /** Accent — triadic offset (+120°) */
  accent: string

  /** Muted versions for backgrounds */
  primaryMuted: string
  secondaryMuted: string

  /** Glow/shadow colors with transparency */
  primaryGlow: string
  secondaryGlow: string

  /** Background accent (very subtle) */
  bgAccent: string
  bgAccent2: string

  /** Text on dark backgrounds */
  textPrimary: string
  textSecondary: string
  textMuted: string

  /** Border colors */
  border: string
  borderActive: string

  /** Current time period */
  period: 'night' | 'dawn' | 'morning' | 'midday' | 'afternoon' | 'sunset' | 'evening' | 'dusk'

  /** CSS gradient for logo/titles */
  gradientPrimary: string
  /** CSS gradient for backgrounds */
  gradientBg: string
}

/**
 * Generate a complete color palette for the given time
 */
export function generatePalette(date = new Date()): ColorPalette {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const totalMinutes = hours * 60 + minutes

  // Base hue — full rotation over 24h, offset so midnight = 270° (purple)
  const baseHue = normalizeHue((totalMinutes / 1440) * 360 + 270)

  // Determine period
  let period: ColorPalette['period']
  if (hours >= 0 && hours < 4) period = 'night'
  else if (hours >= 4 && hours < 6) period = 'dawn'
  else if (hours >= 6 && hours < 10) period = 'morning'
  else if (hours >= 10 && hours < 14) period = 'midday'
  else if (hours >= 14 && hours < 17) period = 'afternoon'
  else if (hours >= 17 && hours < 19) period = 'sunset'
  else if (hours >= 19 && hours < 22) period = 'evening'
  else period = 'dusk'

  // Harmony offsets
  const h2 = normalizeHue(baseHue + 40)   // analogous
  const h3 = normalizeHue(baseHue - 30)   // analogous opposite
  const hComp = normalizeHue(baseHue + 180) // complementary
  const hAccent = normalizeHue(baseHue + 120) // triadic

  return {
    baseHue,
    period,

    // Vibrant colors (high chroma)
    primary:     oklch(65, 0.25, baseHue),
    secondary:   oklch(70, 0.20, h2),
    tertiary:    oklch(60, 0.22, h3),
    complement:  oklch(68, 0.18, hComp),
    accent:      oklch(72, 0.20, hAccent),

    // Muted versions (lower chroma, for backgrounds/hover)
    primaryMuted:   oklch(65, 0.25, baseHue, 0.15),
    secondaryMuted: oklch(70, 0.20, h2, 0.10),

    // Glows (for shadows, drop-shadows)
    primaryGlow:   oklch(65, 0.25, baseHue, 0.3),
    secondaryGlow: oklch(70, 0.20, h2, 0.2),

    // Background accents (very subtle)
    bgAccent:  oklch(65, 0.25, baseHue, 0.08),
    bgAccent2: oklch(70, 0.20, h2, 0.05),

    // Text colors
    textPrimary:   oklch(80, 0.15, baseHue),
    textSecondary: oklch(75, 0.12, h2),
    textMuted:     oklch(55, 0.05, baseHue),

    // Borders
    border:       oklch(65, 0.25, baseHue, 0.12),
    borderActive: oklch(65, 0.25, baseHue, 0.3),

    // Gradients
    gradientPrimary: `linear-gradient(to right, ${oklch(65, 0.25, baseHue)}, ${oklch(70, 0.20, h2)})`,
    gradientBg:      `linear-gradient(135deg, ${oklch(65, 0.25, baseHue, 0.05)}, ${oklch(70, 0.20, hComp, 0.03)})`,
  }
}

/**
 * Apply palette to CSS custom properties on :root
 */
export function applyPalette(palette: ColorPalette): void {
  const root = document.documentElement
  const set = (k: string, v: string) => root.style.setProperty(`--theme-${k}`, v)

  set('hue', String(palette.baseHue))
  set('primary', palette.primary)
  set('secondary', palette.secondary)
  set('tertiary', palette.tertiary)
  set('complement', palette.complement)
  set('accent', palette.accent)
  set('primary-muted', palette.primaryMuted)
  set('secondary-muted', palette.secondaryMuted)
  set('primary-glow', palette.primaryGlow)
  set('secondary-glow', palette.secondaryGlow)
  set('bg-accent', palette.bgAccent)
  set('bg-accent2', palette.bgAccent2)
  set('text-primary', palette.textPrimary)
  set('text-secondary', palette.textSecondary)
  set('text-muted', palette.textMuted)
  set('border', palette.border)
  set('border-active', palette.borderActive)
  set('gradient-primary', palette.gradientPrimary)
  set('gradient-bg', palette.gradientBg)

  root.setAttribute('data-theme-period', palette.period)
}

/**
 * Start the palette clock — updates every 30 seconds for smooth transitions
 */
export function startPaletteClock(): () => void {
  const update = () => applyPalette(generatePalette())
  update()
  const interval = setInterval(update, 30_000)
  return () => clearInterval(interval)
}
