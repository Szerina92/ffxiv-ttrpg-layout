/* Universal embed */

import { embedPattern, enrichEmbed, pickPosition } from "../utils/enricher-options.js";
import { isAbilityType } from "../utils/ability-data.js";
import { createAbilityEmbed } from "./ability-embed.js";
import { createItemEmbed } from "./item-embed.js";
import { createTraitEmbed } from "./trait-embed.js";
import { createActorEmbed } from "./npc-embed.js";
import { createPetEmbed } from "./pet-embed.js";
import { createTableEmbed } from "./table-embed.js";

async function createEmbed({ uuid, label, options, depth }) {
  if (typeof uuid !== "string" || !uuid.trim()) return null;

  let document = null;
  try {
    document = await fromUuid(uuid.trim());
  } catch (error) {
    console.warn("FFXIV TTRPG Layout | Unable to resolve Embed UUID:", uuid, error);
    return null;
  }
  if (!document) return null;

  const position = pickPosition(options);

  switch (document.documentName) {
    case "Item":
      if (isAbilityType(document.type)) return createAbilityEmbed(uuid, { label, options, depth });
      if (document.type === "trait") return createTraitEmbed(uuid, { label, options, depth });
      return createItemEmbed(uuid, { label, depth });
    case "Actor": {
      if (document.type === "pet") return createPetEmbed(uuid, { label, position, depth });
      const double = options.some(option => option.toLowerCase() === "double");
      return createActorEmbed(uuid, { label, position: double ? "center" : position, double, depth });
    }
    case "RollTable":
      return createTableEmbed(uuid, { label, position, depth });
    default:
      return null;
  }
}

export function registerEmbed() {
  CONFIG.TextEditor.enrichers.push({
    id: "ffxiv-embed",
    pattern: embedPattern("FFXIV"),
    enricher: (match, enrichOptions) => enrichEmbed(match, enrichOptions, createEmbed),
  });
}
