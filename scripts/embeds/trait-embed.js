/**
 * FFXIV TTRPG Layout — Trait Embed
 *
 * `@FFXIVTrait[uuid option]{label}` renders an Item of type "trait" as the
 * Trait card used by the Class Summary and the tooltip. Options: half,
 * left/right/center (same as the Ability embed).
 */

import { buildTraitCardData } from "../sheets/class-summary-data.js";
import { applyCardEmbedOptions } from "../utils/card-embed.js";
import { embedPattern, enrichEmbed } from "../utils/enricher-options.js";
import { renderElement } from "../utils/render.js";
import { makeCardDraggable } from "../utils/card-drag.js";

export async function createTraitEmbed(uuid, { label, options = [], depth = 1 } = {}) {
  if (typeof uuid !== "string" || !uuid.trim()) return null;

  let item = null;
  try {
    item = await fromUuid(uuid.trim());
  } catch (error) {
    console.warn("FFXIV TTRPG Layout | Unable to resolve Trait embed UUID:", uuid, error);
    return null;
  }

  const card = await buildTraitCardData(item, { depth });
  if (!card) return null;

  const root = await renderElement("modules/ffxiv-ttrpg-layout/templates/sheets/partials/ffxivTraitCard.hbs", { card });
  if (!root) return null;

  root.classList.add("ffxiv-trait-embed");
  applyCardEmbedOptions(root, options);
  root.dataset.uuid = item.uuid;
  makeCardDraggable(root);
  if (label) root.dataset.label = label;
  return root;
}

export function registerTraitEmbed() {
  CONFIG.TextEditor.enrichers.push({
    id: "ffxiv-trait-embed",
    pattern: embedPattern("FFXIVTrait"),
    enricher: (match, enrichOptions) => enrichEmbed(match, enrichOptions, ({ uuid, ...rest }) => createTraitEmbed(uuid, rest)),
  });
}
