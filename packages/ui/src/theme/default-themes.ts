import type { DesktopTheme } from "./types"
import oc2ThemeJson from "./themes/oc-2.json" with { type: "json" }
import amoledThemeJson from "./themes/amoled.json" with { type: "json" }
import auraThemeJson from "./themes/aura.json" with { type: "json" }
import ayuThemeJson from "./themes/ayu.json" with { type: "json" }
import carbonfoxThemeJson from "./themes/carbonfox.json" with { type: "json" }
import catppuccinThemeJson from "./themes/catppuccin.json" with { type: "json" }
import catppuccinFrappeThemeJson from "./themes/catppuccin-frappe.json" with { type: "json" }
import catppuccinMacchiatoThemeJson from "./themes/catppuccin-macchiato.json" with { type: "json" }
import cobalt2ThemeJson from "./themes/cobalt2.json" with { type: "json" }
import cursorThemeJson from "./themes/cursor.json" with { type: "json" }
import draculaThemeJson from "./themes/dracula.json" with { type: "json" }
import everforestThemeJson from "./themes/everforest.json" with { type: "json" }
import flexokiThemeJson from "./themes/flexoki.json" with { type: "json" }
import githubThemeJson from "./themes/github.json" with { type: "json" }
import gruvboxThemeJson from "./themes/gruvbox.json" with { type: "json" }
import kanagawaThemeJson from "./themes/kanagawa.json" with { type: "json" }
import lucentOrngThemeJson from "./themes/lucent-orng.json" with { type: "json" }
import materialThemeJson from "./themes/material.json" with { type: "json" }
import matrixThemeJson from "./themes/matrix.json" with { type: "json" }
import mercuryThemeJson from "./themes/mercury.json" with { type: "json" }
import monokaiThemeJson from "./themes/monokai.json" with { type: "json" }
import nightowlThemeJson from "./themes/nightowl.json" with { type: "json" }
import nordThemeJson from "./themes/nord.json" with { type: "json" }
import oneDarkThemeJson from "./themes/one-dark.json" with { type: "json" }
import oneDarkProThemeJson from "./themes/onedarkpro.json" with { type: "json" }
import orchestraThemeJson from "./themes/orchestra.json" with { type: "json" }
import orngThemeJson from "./themes/orng.json" with { type: "json" }
import osakaJadeThemeJson from "./themes/osaka-jade.json" with { type: "json" }
import palenightThemeJson from "./themes/palenight.json" with { type: "json" }
import rosepineThemeJson from "./themes/rosepine.json" with { type: "json" }
import shadesOfPurpleThemeJson from "./themes/shadesofpurple.json" with { type: "json" }
import solarizedThemeJson from "./themes/solarized.json" with { type: "json" }
import synthwave84ThemeJson from "./themes/synthwave84.json" with { type: "json" }
import tokyonightThemeJson from "./themes/tokyonight.json" with { type: "json" }
import vercelThemeJson from "./themes/vercel.json" with { type: "json" }
import vesperThemeJson from "./themes/vesper.json" with { type: "json" }
import zenburnThemeJson from "./themes/zenburn.json" with { type: "json" }

export const oc2Theme = oc2ThemeJson as DesktopTheme
export const amoledTheme = amoledThemeJson as DesktopTheme
export const auraTheme = auraThemeJson as DesktopTheme
export const ayuTheme = ayuThemeJson as DesktopTheme
export const carbonfoxTheme = carbonfoxThemeJson as DesktopTheme
export const catppuccinTheme = catppuccinThemeJson as DesktopTheme
export const catppuccinFrappeTheme = catppuccinFrappeThemeJson as DesktopTheme
export const catppuccinMacchiatoTheme = catppuccinMacchiatoThemeJson as DesktopTheme
export const cobalt2Theme = cobalt2ThemeJson as DesktopTheme
export const cursorTheme = cursorThemeJson as DesktopTheme
export const draculaTheme = draculaThemeJson as DesktopTheme
export const everforestTheme = everforestThemeJson as DesktopTheme
export const flexokiTheme = flexokiThemeJson as DesktopTheme
export const githubTheme = githubThemeJson as DesktopTheme
export const gruvboxTheme = gruvboxThemeJson as DesktopTheme
export const kanagawaTheme = kanagawaThemeJson as DesktopTheme
export const lucentOrngTheme = lucentOrngThemeJson as DesktopTheme
export const materialTheme = materialThemeJson as DesktopTheme
export const matrixTheme = matrixThemeJson as DesktopTheme
export const mercuryTheme = mercuryThemeJson as DesktopTheme
export const monokaiTheme = monokaiThemeJson as DesktopTheme
export const nightowlTheme = nightowlThemeJson as DesktopTheme
export const nordTheme = nordThemeJson as DesktopTheme
export const oneDarkTheme = oneDarkThemeJson as DesktopTheme
export const oneDarkProTheme = oneDarkProThemeJson as DesktopTheme
export const orchestraTheme = orchestraThemeJson as DesktopTheme
export const orngTheme = orngThemeJson as DesktopTheme
export const osakaJadeTheme = osakaJadeThemeJson as DesktopTheme
export const palenightTheme = palenightThemeJson as DesktopTheme
export const rosepineTheme = rosepineThemeJson as DesktopTheme
export const shadesOfPurpleTheme = shadesOfPurpleThemeJson as DesktopTheme
export const solarizedTheme = solarizedThemeJson as DesktopTheme
export const synthwave84Theme = synthwave84ThemeJson as DesktopTheme
export const tokyonightTheme = tokyonightThemeJson as DesktopTheme
export const vercelTheme = vercelThemeJson as DesktopTheme
export const vesperTheme = vesperThemeJson as DesktopTheme
export const zenburnTheme = zenburnThemeJson as DesktopTheme

export const DEFAULT_THEMES: Record<string, DesktopTheme> = {
  "oc-2": oc2Theme,
  amoled: amoledTheme,
  aura: auraTheme,
  ayu: ayuTheme,
  carbonfox: carbonfoxTheme,
  catppuccin: catppuccinTheme,
  "catppuccin-frappe": catppuccinFrappeTheme,
  "catppuccin-macchiato": catppuccinMacchiatoTheme,
  cobalt2: cobalt2Theme,
  cursor: cursorTheme,
  dracula: draculaTheme,
  everforest: everforestTheme,
  flexoki: flexokiTheme,
  github: githubTheme,
  gruvbox: gruvboxTheme,
  kanagawa: kanagawaTheme,
  "lucent-orng": lucentOrngTheme,
  material: materialTheme,
  matrix: matrixTheme,
  mercury: mercuryTheme,
  monokai: monokaiTheme,
  nightowl: nightowlTheme,
  nord: nordTheme,
  "one-dark": oneDarkTheme,
  onedarkpro: oneDarkProTheme,
  orchestra: orchestraTheme,
  orng: orngTheme,
  "osaka-jade": osakaJadeTheme,
  palenight: palenightTheme,
  rosepine: rosepineTheme,
  shadesofpurple: shadesOfPurpleTheme,
  solarized: solarizedTheme,
  synthwave84: synthwave84Theme,
  tokyonight: tokyonightTheme,
  vercel: vercelTheme,
  vesper: vesperTheme,
  zenburn: zenburnTheme,
}
