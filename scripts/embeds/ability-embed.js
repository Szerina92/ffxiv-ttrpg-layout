/**
 * FFXIV TTRPG Layout — Ability Embed
 *
 * `@FFXIVAbility[uuid]` renders an Item of type "ability" as the same FFXIV
 * Card that the Class Summary and the Ability tooltip use. The card data is
 * built once in `buildAbilityCardData`, so all three stay identical.
 */

import { buildAbilityCardData } from "../sheets/class-summary-data.js";
import { applyCardEmbedOptions } from "../utils/card-embed.js";
import { embedPattern, enrichEmbed } from "../utils/enricher-options.js";
import { renderElement } from "../utils/render.js";
import { makeCardDraggable } from "../utils/card-drag.js";

export async function createAbilityEmbed(uuid, { label, options = [], depth = 1 } = {}) {
  if (typeof uuid !== "string" || !uuid.trim()) return null;

  let item = null;
  try {
    item = await fromUuid(uuid.trim());
  } catch (error) {
    console.warn("FFXIV TTRPG Layout | Unable to resolve Ability embed UUID:", uuid, error);
    return null;
  }

  const card = await buildAbilityCardData(item, null, { depth });
  if (!card) return null;

  const root = await renderElement("modules/ffxiv-ttrpg-layout/templates/sheets/partials/ffxivCard.hbs", { card });
  if (!root) return null;

  root.classList.add("ffxiv-ability-embed");
  applyCardEmbedOptions(root, options);
  root.dataset.uuid = item.uuid;
  makeCardDraggable(root);
  if (label) root.dataset.label = label;
  return root;
}

export function registerAbilityEmbed() {
  CONFIG.TextEditor.enrichers.push({
    id: "ffxiv-ability-embed",
    pattern: embedPattern("FFXIVAbility"),
    enricher: (match, enrichOptions) => enrichEmbed(match, enrichOptions, ({ uuid, ...rest }) => createAbilityEmbed(uuid, rest)),
  });
}
