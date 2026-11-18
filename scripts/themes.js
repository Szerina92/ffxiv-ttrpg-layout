/* Themes */

import { MODULE_ID } from "./constants.js";
import { isEorzeaThemeEnabled, isPaperThemeEnabled } from "./settings.js";

const SYSTEM_THEME_SETTING = "ffxiv.overrideColorScheme";

const THEMES = [
  { id: "paper", isEnabled: isPaperThemeEnabled, bodyClass: "ffxiv-paper-theme", parchment: true },
  { id: "eorzea", isEnabled: isEorzeaThemeEnabled, bodyClass: "ffxiv-eorzea-theme", parchment: false },
];

function applyTheme() {
  const theme = THEMES.find(entry => entry.isEnabled());
  if (!theme) return;

  CONFIG.theme = theme.id;
  document.body.classList.add(theme.bodyClass);
  if (!theme.parchment) return;

  const parchment = foundry.utils.getRoute(`modules/${MODULE_ID}/images/pergament.webp`);
  document.body.style.setProperty("--ffxiv-paper-parchment", `url("${parchment}")`);
}

function moveSettingNextToSystemTheme(app, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  const anchor = root?.querySelector(`[name="${SYSTEM_THEME_SETTING}"]`)?.closest(".form-group");
  if (!anchor) return;

  const groups = ["paperTheme", "eorzeaTheme"]
    .map(key => root.querySelector(`[name="${MODULE_ID}.${key}"]`)?.closest(".form-group"))
    .filter(Boolean);
  anchor.after(...groups);
}

export function registerThemes() {
  Hooks.once("ready", applyTheme);
  Hooks.on("renderSettingsConfig", moveSettingNextToSystemTheme);
}
