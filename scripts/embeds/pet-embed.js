/**
 * FFXIV TTRPG Layout — Pet Embed
 *
 * Standalone Pet Embeds and Class Summary Pet Cards share the same Pet Card
 * template and the same underlying Pet view model. The presentation remains
 * type-specific, while Ability children use the Unified Card component.
 */

import { buildPetCardData } from "../sheets/class-summary-data.js";
import { embedPattern, enrichEmbed, normalizePosition, pickPosition } from "../utils/enricher-options.js";
import { renderElement } from "../utils/render.js";

export async function createPetEmbed(uuid, { label, position, depth = 1 } = {}) {
  if (typeof uuid !== "string" || !uuid.trim()) return null;

  const actor = await fromUuid(uuid.trim());
  const templateData = await buildPetCardData(actor, { depth });
  if (!templateData) return null;

  const root = await renderElement("modules/ffxiv-ttrpg-layout/templates/embeds/pet-embed.hbs", templateData);
  if (!root) return null;

  if (label) root.dataset.label = label;
  root.classList.add(`ffxiv-pet-embed--float-${normalizePosition(position)}`);
  return root;
}

export function registerPetEmbed() {
  CONFIG.TextEditor.enrichers.push({
    id: "ffxiv-pet-embed",
    pattern: embedPattern("FFXIVPet"),
    enricher: (match, enrichOptions) => enrichEmbed(match, enrichOptions, ({ uuid, label, options, depth }) =>
      createPetEmbed(uuid, { label, position: pickPosition(options), depth })),
  });
}
