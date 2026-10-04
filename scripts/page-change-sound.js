/**
 * FFXIV TTRPG Layout — Experimental Journal Page Change Sound.
 *
 * Plays a local UI confirmation sound when the user selects a different
 * Journal page from the custom TOC. Enabled by default and client-local.
 */

const MODULE_ID = "ffxiv-ttrpg-layout";
const SETTING_KEY = "experimentalPageChangeSound";
const SOUND_PATH = "modules/ffxiv-ttrpg-layout/sounds/FFXIV_Confirm.mp3";
const VOLUME_SETTING_KEY = "experimentalPageChangeSoundVolume";
const DEFAULT_SOUND_VOLUME_PERCENT = 50;

export function registerPageChangeSoundSetting() {
  game.settings.register(MODULE_ID, SETTING_KEY, {
    name: "FFXIVTTRPGLayout.Settings.ExperimentalPageChangeSound",
    hint: "FFXIVTTRPGLayout.Settings.ExperimentalPageChangeSoundHint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, VOLUME_SETTING_KEY, {
    name: "FFXIVTTRPGLayout.Settings.ExperimentalPageChangeSoundVolume",
    hint: "FFXIVTTRPGLayout.Settings.ExperimentalPageChangeSoundVolumeHint",
    scope: "client",
    config: true,
    type: Number,
    range: {
      min: 0,
      max: 100,
      step: 5,
    },
    default: DEFAULT_SOUND_VOLUME_PERCENT,
  });

  if (isPageChangeSoundEnabled()) preloadPageChangeSound();
}

export function isPageChangeSoundEnabled() {
  return game.settings.get(MODULE_ID, SETTING_KEY) === true;
}

export { SETTING_KEY as pageChangeSoundSettingKey };
export { VOLUME_SETTING_KEY as pageChangeSoundVolumeSettingKey };
export { SOUND_PATH as pageChangeSoundPath };

export function getPageChangeSoundVolume() {
  const percent = Number(game.settings.get(MODULE_ID, VOLUME_SETTING_KEY));
  if (!Number.isFinite(percent)) return DEFAULT_SOUND_VOLUME_PERCENT / 100;
  return Math.min(1, Math.max(0, percent / 100));
}

export async function preloadPageChangeSound() {
  if (!isPageChangeSoundEnabled()) return null;

  const audio = game.audio;
  if (typeof audio?.preload !== "function") return null;

  try {
    return await audio.preload(SOUND_PATH);
  } catch (error) {
    console.warn("FFXIV TTRPG Layout | Failed to preload page change sound.", error);
    return null;
  }
}

export function playPageChangeSound() {
  if (!isPageChangeSoundEnabled()) return null;

  // Use a fresh native Audio element so playback occurs synchronously from the
  // originating user gesture. The same path was verified directly in the
  // Foundry browser client and therefore avoids depending on a later render or
  // on the Foundry audio mixer being initialized.
  try {
    const sound = new Audio(SOUND_PATH);
    sound.volume = getPageChangeSoundVolume();
    sound.preload = "auto";
    const playback = sound.play();
    if (playback?.catch) {
      playback.catch(error => {
        console.warn("FFXIV TTRPG Layout | Page-change sound playback failed.", error);
      });
    }
    return sound;
  } catch (error) {
    console.warn("FFXIV TTRPG Layout | Could not create page-change sound.", error);
    return null;
  }
}
