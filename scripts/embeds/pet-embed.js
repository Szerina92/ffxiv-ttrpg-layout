/**
 * FFXIV TTRPG Layout — Pet Embed
 *
 * Standalone Pet Embeds and Class Summary Pet Cards share the same Pet Card
 * template and the same underlying Pet view model. The presentation remains
 * type-specific, while Ability children use the Unified Card component.
 */

import { buildPetCardData } from "../sheets/class-summary-data.js";
import { normalizePosition, parseEnricherOptions, pickPosition } from "../utils/enricher-options.js";
import { renderElement } from "../utils/render.js";

async function createPetEmbed(uuid, { label, position } = {}) {
  if (typeof uuid !== "string" || !uuid.trim()) return null;

  const actor = await fromUuid(uuid.trim());
  const templateData = await buildPetCardData(actor);
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
    pattern: /@FFXIVPet\[([^\]\s]+)\](?:\{([^}]+)\})?/g,
    enricher: match => {
      const { label, options } = parseEnricherOptions(match[2]);
      return createPetEmbed(match[1], { label, position: pickPosition(options) });
    },
  });
}
