/**
 * FFXIV TTRPG Layout — themes for the FFXIV system (Paper and Eorzea)
 *
 * The system styles its sheets through a theme class (`<theme>_theme`) taken
 * from `CONFIG.theme` (dark / light / blue). With one of the Layout themes
 * enabled, this module sets `CONFIG.theme` to "paper" or "eorzea", so every
 * sheet, item sheet and floating tooltip the system renders afterwards gets
 * `paper_theme` or `eorzea_theme`. Chat cards get their theme class from a
 * separate system function, so they are covered by a body class instead.
 *
 * Both themes share the rules in styles/themes/common/; each theme only has
 * its own tokens (styles/themes/paper/, styles/themes/eorzea/). At most one
 * theme is active: the settings switch each other off, and Paper wins if
 * both are stored as on.
 */

import { MODULE_ID } from "./constants.js";
import { isEorzeaThemeEnabled, isPaperThemeEnabled } from "./settings.js";

const SYSTEM_THEME_SETTING = "ffxiv.overrideColorScheme";

const THEMES = [
  { id: "paper", isEnabled: isPaperThemeEnabled, bodyClass: "ffxiv-paper-theme", parchment: true },
  { id: "eorzea", isEnabled: isEorzeaThemeEnabled, bodyClass: "ffxiv-eorzea-theme", parchment: false },
];

/** Run after the system's own `ready` hook (which sets CONFIG.theme). */
function applyPaperTheme() {
  const theme = THEMES.find(entry => entry.isEnabled());
  if (!theme) return;

  CONFIG.theme = theme.id;
  document.body.classList.add(theme.bodyClass);
  if (!theme.parchment) return;

  // Absolute route: a url() inside a custom property resolves against the
  // stylesheet that *uses* it, which would be the system's.
  const parchment = foundry.utils.getRoute(`modules/${MODULE_ID}/images/pergament.webp`);
  document.body.style.setProperty("--ffxiv-paper-parchment", `url("${parchment}")`);
}

/** Show the theme settings next to the system's Blue Theme option. */
function moveSettingNextToSystemTheme(app, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  const anchor = root?.querySelector(`[name="${SYSTEM_THEME_SETTING}"]`)?.closest(".form-group");
  if (!anchor) return;

  const groups = ["paperTheme", "eorzeaTheme"]
    .map(key => root.querySelector(`[name="${MODULE_ID}.${key}"]`)?.closest(".form-group"))
    .filter(Boolean);
  anchor.after(...groups);
}

export function registerPaperTheme() {
  Hooks.once("ready", applyPaperTheme);
  Hooks.on("renderSettingsConfig", moveSettingNextToSystemTheme);
}
