import { buildAbilityCardData } from "../sheets/class-summary-data.js";
import { applyCardEmbedOptions } from "../utils/card-embed.js";
import { embedPattern, readEmbedMatch } from "../utils/enricher-options.js";
import { renderElement } from "../utils/render.js";

export async function createAbilityEmbed(uuid, { label, options = [] } = {}) {
  if (typeof uuid !== "string" || !uuid.trim()) return null;

  let item = null;
  try {
    item = await fromUuid(uuid.trim());
  } catch (error) {
    console.warn("FFXIV TTRPG Layout | Unable to resolve Ability embed UUID:", uuid, error);
    return null;
  }

  const card = await buildAbilityCardData(item);
  if (!card) return null;

  const root = await renderElement("modules/ffxiv-ttrpg-layout/templates/sheets/partials/ffxivCard.hbs", { card });
  if (!root) return null;

  root.classList.add("ffxiv-ability-embed");
  applyCardEmbedOptions(root, options);
  root.dataset.uuid = item.uuid;
  if (label) root.dataset.label = label;
  return root;
}

export function registerAbilityEmbed() {
  CONFIG.TextEditor.enrichers.push({
    id: "ffxiv-ability-embed",
    pattern: embedPattern("FFXIVAbility"),
    enricher: match => {
      const { uuid, label, options } = readEmbedMatch(match);
      return createAbilityEmbed(uuid, { label, options });
    },
  });
}
