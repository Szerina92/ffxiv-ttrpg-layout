/**
 * FFXIV TTRPG Layout — Experimental Journal Page Change Sound.
 *
 * Plays a local UI confirmation sound when the user selects a different
 * Journal page from the custom TOC. Enabled by default and client-local.
 */

import { MODULE_ID } from "./constants.js";
import { getPageChangeSoundVolumePercent, isPageChangeSoundEnabled } from "./settings.js";

const SOUND_PATH = `modules/${MODULE_ID}/sounds/FFXIV_Confirm.mp3`;
const DEFAULT_VOLUME_PERCENT = 50;

function getVolume() {
  const percent = getPageChangeSoundVolumePercent();
  const value = Number.isFinite(percent) ? percent : DEFAULT_VOLUME_PERCENT;
  return Math.min(1, Math.max(0, value / 100));
}

export async function preloadPageChangeSound() {
  if (!isPageChangeSoundEnabled()) return null;

  try {
    return await game.audio.preload(SOUND_PATH);
  } catch (error) {
    console.warn("FFXIV TTRPG Layout | Failed to preload page change sound.", error);
    return null;
  }
}

/** Play the sound locally (not broadcast) through Foundry's interface audio channel. */
export function playPageChangeSound() {
  if (!isPageChangeSoundEnabled()) return;

  try {
    const playback = foundry.audio.AudioHelper.play(
      { src: SOUND_PATH, volume: getVolume(), autoplay: true, loop: false },
      false,
    );
    playback?.catch?.(error => console.warn("FFXIV TTRPG Layout | Page-change sound playback failed.", error));
  } catch (error) {
    console.warn("FFXIV TTRPG Layout | Could not play page-change sound.", error);
  }
}
