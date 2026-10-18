/**
 * The interface's colours, taken from Code-Life (its theme, Codédex screens and
 * dialogue box), so windows, menus and the battle screen share one identity.
 * The world's tiles and characters keep their own palettes (scripts/art/gbc).
 */
import { hex } from '../bitmap.mjs'

export const CL = {
  // Night navy and the Codédex's indigo layers, darkest first
  night: hex('#03052e'),
  shadow: hex('#0b0920'),
  deep: hex('#120f2e'),
  panel: hex('#1c1846'),
  card: hex('#2b2860'),
  cardLow: hex('#1d1a45'),
  raised: hex('#3a3584'),
  // Lines and accents
  purple: hex('#9095ff'),
  purpleLight: hex('#c3c6ff'),
  lavender: hex('#a78bfa'),
  magenta: hex('#f942ff'),
  cyan: hex('#00deff'),
  green: hex('#00ff47'),
  gold: hex('#ffc94a'),
  goldLight: hex('#ffe9a8'),
  goldDark: hex('#f59e0b'),
  // Text
  text: hex('#fafafe'),
  dim: hex('#9a97cf'),
  ink: hex('#1c1846'),
}
