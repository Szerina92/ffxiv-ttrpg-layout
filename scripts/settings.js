/* Settings */

import { MODULE_ID } from "./constants.js";

const SETTINGS = Object.freeze({
  pagePointer: "pagePointer",
  pageChangeSound: "experimentalPageChangeSound",
  pageChangeSoundVolume: "experimentalPageChangeSoundVolume",
  paperTheme: "paperTheme",
  eorzeaTheme: "eorzeaTheme",
  autoLinks: "experimentalAutoLinks",
});

const getSetting = key => game.settings.get(MODULE_ID, key);

export const isPagePointerEnabled = () => getSetting(SETTINGS.pagePointer) === true;
export const isPageChangeSoundEnabled = () => getSetting(SETTINGS.pageChangeSound) === true;
export const isPaperThemeEnabled = () => getSetting(SETTINGS.paperTheme) === true;
export const isEorzeaThemeEnabled = () => !isPaperThemeEnabled() && getSetting(SETTINGS.eorzeaTheme) === true;
export const isModuleThemeEnabled = () => isPaperThemeEnabled() || isEorzeaThemeEnabled();
export const isAutoLinksEnabled = () => getSetting(SETTINGS.autoLinks) === true;
export const getPageChangeSoundVolumePercent = () => Number(getSetting(SETTINGS.pageChangeSoundVolume));

export function registerSettings({ onPagePointerChange } = {}) {
  const register = (key, label, data) => game.settings.register(MODULE_ID, key, {
    name: `FFXIVTTRPGLayout.Settings.${label}`,
    hint: `FFXIVTTRPGLayout.Settings.${label}Hint`,
    scope: "client",
    config: true,
    ...data,
  });

  register(SETTINGS.pagePointer, "PagePointer", {
    type: Boolean,
    default: true,
    onChange: () => onPagePointerChange?.(),
  });

  register(SETTINGS.pageChangeSound, "PageChangeSound", {
    type: Boolean,
    default: true,
  });

  register(SETTINGS.pageChangeSoundVolume, "PageChangeSoundVolume", {
    type: Number,
    range: { min: 0, max: 100, step: 5 },
    default: 50,
  });

  const switchOff = key => {
    if (getSetting(key) === true) game.settings.set(MODULE_ID, key, false);
  };

  register(SETTINGS.paperTheme, "PaperTheme", {
    type: Boolean,
    default: false,
    requiresReload: true,
    onChange: enabled => enabled && switchOff(SETTINGS.eorzeaTheme),
  });

  register(SETTINGS.eorzeaTheme, "EorzeaTheme", {
    type: Boolean,
    default: false,
    requiresReload: true,
    onChange: enabled => enabled && switchOff(SETTINGS.paperTheme),
  });

  register(SETTINGS.autoLinks, "AutoLinks", {
    type: Boolean,
    default: true,
  });
}
