/**
 * FFXIV TTRPG Layout — module settings.
 * All settings are client-scoped. Registration order is the order shown in
 * the module settings dialog.
 */

import { MODULE_ID } from "./constants.js";

const SETTINGS = Object.freeze({
  showRulesCompendium: "showRulesCompendium",
  experimentalMarkers: "experimentalMarkers",
  experimentalPagePointer: "experimentalPagePointer",
  pageChangeSound: "experimentalPageChangeSound",
  pageChangeSoundVolume: "experimentalPageChangeSoundVolume",
  paperTheme: "paperTheme",
  chatCards: "chatCards",
});

const getSetting = key => game.settings.get(MODULE_ID, key);

export const isRulesCompendiumVisible = () => getSetting(SETTINGS.showRulesCompendium) === true;
export const isMarkerRendererEnabled = () => getSetting(SETTINGS.experimentalMarkers) === true;
export const isPagePointerEnabled = () => getSetting(SETTINGS.experimentalPagePointer) === true;
export const isPageChangeSoundEnabled = () => getSetting(SETTINGS.pageChangeSound) === true;
export const isPaperThemeEnabled = () => getSetting(SETTINGS.paperTheme) === true;
export const isChatCardsEnabled = () => getSetting(SETTINGS.chatCards) === true;
export const getPageChangeSoundVolumePercent = () => Number(getSetting(SETTINGS.pageChangeSoundVolume));

/**
 * @param {object} [callbacks]
 * @param {() => void} [callbacks.onPagePointerChange] Called when the Page Pointer setting changes.
 */
export function registerSettings({ onPagePointerChange } = {}) {
  const register = (key, label, data) => game.settings.register(MODULE_ID, key, {
    name: `FFXIVTTRPGLayout.Settings.${label}`,
    hint: `FFXIVTTRPGLayout.Settings.${label}Hint`,
    scope: "client",
    config: true,
    ...data,
  });

  register(SETTINGS.showRulesCompendium, "ShowRulesCompendium", {
    type: Boolean,
    default: false,
    onChange: () => ui.compendium?.render?.({ force: true }),
  });

  register(SETTINGS.experimentalMarkers, "ExperimentalMarkerRenderer", {
    type: Boolean,
    default: false,
  });

  register(SETTINGS.experimentalPagePointer, "ExperimentalPagePointer", {
    type: Boolean,
    default: false,
    onChange: () => onPagePointerChange?.(),
  });

  register(SETTINGS.pageChangeSound, "ExperimentalPageChangeSound", {
    type: Boolean,
    default: true,
  });

  register(SETTINGS.pageChangeSoundVolume, "ExperimentalPageChangeSoundVolume", {
    type: Number,
    range: { min: 0, max: 100, step: 5 },
    default: 50,
  });

  register(SETTINGS.paperTheme, "PaperTheme", {
    type: Boolean,
    default: false,
    requiresReload: true,
  });

  register(SETTINGS.chatCards, "ChatCards", {
    type: Boolean,
    default: true,
  });
}
