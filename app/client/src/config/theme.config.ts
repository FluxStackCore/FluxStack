/**
 * Theme Configuration
 *
 * Control how the app's color palette behaves.
 *
 * === Modes ===
 *
 *   'auto'   → colors shift with the time of day
 *   'fixed'  → fixed base hue with default harmony offsets
 *   'custom' → full control over every color position
 *
 * === Examples ===
 *
 *   // Auto mode (default)
 *   export const themeConfig = { mode: 'auto' }
 *
 *   // Fixed purple
 *   export const themeConfig = { mode: 'fixed', hue: 270 }
 *
 *   // Custom palette — you define every color offset
 *   export const themeConfig = {
 *     mode: 'custom',
 *     palette: {
 *       primary:    270,  // purple
 *       secondary:  310,  // pink (270 + 40)
 *       tertiary:   240,  // indigo (270 - 30)
 *       complement:  90,  // yellow (270 + 180)
 *       accent:      30,  // orange (270 + 120)
 *     }
 *   }
 *
 *   // Custom with offsets from base — easier to tweak
 *   export const themeConfig = {
 *     mode: 'custom',
 *     hue: 270,
 *     offsets: {
 *       secondary:  +50,  // default is +40
 *       tertiary:   -45,  // default is -30
 *       complement: +160, // default is +180
 *       accent:     +100, // default is +120
 *     }
 *   }
 *
 * === Hue Reference ===
 *   0°   = Red        180° = Cyan
 *   30°  = Orange     210° = Blue
 *   60°  = Yellow     270° = Purple
 *   120° = Green      330° = Magenta
 */

export type ThemeMode = 'auto' | 'fixed' | 'custom'

export interface HarmonyOffsets {
  /** Offset from base hue for secondary color (default: +40) */
  secondary?: number
  /** Offset from base hue for tertiary color (default: -30) */
  tertiary?: number
  /** Offset from base hue for complement color (default: +180) */
  complement?: number
  /** Offset from base hue for accent color (default: +120) */
  accent?: number
}

export interface CustomPalette {
  /** Absolute hue for primary (0-360) */
  primary: number
  /** Absolute hue for secondary (0-360) */
  secondary: number
  /** Absolute hue for tertiary (0-360) */
  tertiary: number
  /** Absolute hue for complement (0-360) */
  complement: number
  /** Absolute hue for accent (0-360) */
  accent: number
}

export interface ThemeConfig {
  /** 'auto' = shifts with time, 'fixed' = one hue, 'custom' = full control */
  mode: ThemeMode
  /** Base hue (0-360) — used in 'fixed' and 'custom' with offsets */
  hue?: number
  /** Custom harmony offsets from base hue — used in 'custom' mode */
  offsets?: HarmonyOffsets
  /** Absolute hue positions — used in 'custom' mode (overrides offsets) */
  palette?: CustomPalette
  /** Show the floating theme picker (default: true in dev) */
  showPicker?: boolean
}

// ===== Default harmony offsets =====
export const DEFAULT_OFFSETS: Required<HarmonyOffsets> = {
  secondary: 40,
  tertiary: -30,
  complement: 180,
  accent: 120,
}

export const themeConfig: ThemeConfig = {
  mode: 'fixed',
  hue: 270,  // purple
  showPicker: import.meta.env.DEV,
}
