/**
 * `@FFXIV[uuid option ...]{label|option|...}` picks the matching embed from the
 * document behind the UUID:
 *
 *   Item (type ability)  -> Ability card   (options: half, left/right/center)
 *   Item (type trait)    -> Trait card     (options: half, left/right/center)
 *   Item (anything else) -> Item card
 *   Actor (npc)          -> Actor embed   (option `double` supported, experimental)
 *   Actor (pet)          -> Pet embed
 *   RollTable            -> Table embed
 */

import { embedPattern, pickPosition, readEmbedMatch } from "../utils/enricher-options.js";
import { createAbilityEmbed } from "./ability-embed.js";
import { createItemEmbed } from "./item-embed.js";
import { createTraitEmbed } from "./trait-embed.js";
import { createActorEmbed } from "./npc-embed.js";
import { createPetEmbed } from "./pet-embed.js";
import { createTableEmbed } from "./table-embed.js";

async function createEmbed({ uuid, label, options }) {
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
      if (document.type === "ability") return createAbilityEmbed(uuid, { label, options });
      if (document.type === "trait") return createTraitEmbed(uuid, { label, options });
      return createItemEmbed(uuid, { label });
    case "Actor": {
      if (document.type === "pet") return createPetEmbed(uuid, { label, position });
      const double = options.some(option => option.toLowerCase() === "double");
      return createActorEmbed(uuid, { label, position: double ? "center" : position, double });
    }
    case "RollTable":
      return createTableEmbed(uuid, { label, position });
    default:
      return null;
  }
}

export function registerEmbed() {
  CONFIG.TextEditor.enrichers.push({
    id: "ffxiv-embed",
    pattern: embedPattern("FFXIV"),
    enricher: match => createEmbed(readEmbedMatch(match)),
  });
}
