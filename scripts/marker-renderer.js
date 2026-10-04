/**
 * FFXIV TTRPG Layout — Experimental Marker Renderer
 * 1.7.3: controlled through the module settings.
 * Supported geometry names: Centered, Adjacent.
 * Line markers remain excluded.
 */

import { localize } from "./i18n.js";

const MODULE_ID = "ffxiv-ttrpg-layout";
const SETTING_KEY = "experimentalMarkers";

export function registerMarkerRenderer() {
  game.settings.register(MODULE_ID, SETTING_KEY, {
    name: "FFXIVTTRPGLayout.Settings.ExperimentalMarkerRenderer",
    hint: "FFXIVTTRPGLayout.Settings.ExperimentalMarkerRendererHint",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });
}

export function isMarkerRendererEnabled() {
  return game.settings.get(MODULE_ID, SETTING_KEY) === true;
}

export { SETTING_KEY as markerRendererSettingKey };
