/**
 * FFXIV TTRPG Layout — Paper Theme for the FFXIV system
 *
 * The system styles its sheets through a theme class (`<theme>_theme`) taken
 * from `CONFIG.theme` (dark / light / blue). With the setting enabled, this
 * module sets `CONFIG.theme = "paper"`, so every sheet, item sheet and
 * floating tooltip the system renders afterwards gets `paper_theme`. Chat
 * cards get their theme class from a separate system function, so they are
 * covered by a body class instead (see styles/themes/paper/).
 */

import { MODULE_ID } from "./constants.js";
import { isPaperThemeEnabled } from "./settings.js";

const THEME = "paper";
const BODY_CLASS = "ffxiv-paper-theme";
const SYSTEM_THEME_SETTING = "ffxiv.overrideColorScheme";

/** Run after the system's own `ready` hook (which sets CONFIG.theme). */
export function applyPaperTheme() {
  if (!isPaperThemeEnabled()) return;

  CONFIG.theme = THEME;
  document.body.classList.add(BODY_CLASS);
  // Absolute route: a url() inside a custom property resolves against the
  // stylesheet that *uses* it, which would be the system's.
  const parchment = foundry.utils.getRoute(`modules/${MODULE_ID}/images/pergament.webp`);
  document.body.style.setProperty("--ffxiv-paper-parchment", `url("${parchment}")`);
}

/** Show the setting next to the system's Blue Theme option. */
function moveSettingNextToSystemTheme(app, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  const ours = root?.querySelector(`[name="${MODULE_ID}.paperTheme"]`)?.closest(".form-group");
  const anchor = root?.querySelector(`[name="${SYSTEM_THEME_SETTING}"]`)?.closest(".form-group");
  if (ours && anchor) anchor.after(ours);
}

export function registerPaperTheme() {
  Hooks.once("ready", applyPaperTheme);
  Hooks.on("renderSettingsConfig", moveSettingNextToSystemTheme);
}
