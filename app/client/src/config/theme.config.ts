/**
 * Theme Configuration
 *
 * Control how the app's color palette behaves.
 *
 * Modes:
 * - 'auto'  → colors shift with the time of day (default)
 * - 'fixed' → fixed hue, consistent across all times
 *
 * Usage:
 *   // Auto mode (default) — palette rotates with the clock
 *   export const themeConfig = { mode: 'auto' }
 *
 *   // Fixed purple theme
 *   export const themeConfig = { mode: 'fixed', hue: 270 }
 *
 *   // Fixed teal theme
 *   export const themeConfig = { mode: 'fixed', hue: 180 }
 *
 *   // Fixed warm orange theme
 *   export const themeConfig = { mode: 'fixed', hue: 30 }
 *
 * Common hue values:
 *   0°   = Red
 *   30°  = Orange
 *   60°  = Yellow
 *   120° = Green
 *   180° = Cyan/Teal
 *   210° = Blue
 *   270° = Purple
 *   300° = Pink
 *   330° = Magenta
 */

export type ThemeMode = 'auto' | 'fixed'

export interface ThemeConfig {
  /** 'auto' = shifts with time, 'fixed' = stays on one hue */
  mode: ThemeMode
  /** Base hue (0-360) — only used when mode is 'fixed' */
  hue?: number
  /** Show the floating theme picker button (default: true in dev, false in prod) */
  showPicker?: boolean
}

export const themeConfig: ThemeConfig = {
  // Change this to customize your app's color scheme:
  mode: 'auto',

  // Uncomment to fix the palette to a specific hue:
  // mode: 'fixed',
  // hue: 270, // purple

  // Show the color wheel picker (🎨 button)
  showPicker: import.meta.env.DEV,
}
