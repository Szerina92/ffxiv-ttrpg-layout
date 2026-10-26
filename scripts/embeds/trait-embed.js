import { buildTraitCardData } from "../sheets/class-summary-data.js";
import { applyCardEmbedOptions } from "../utils/card-embed.js";
import { embedPattern, readEmbedMatch } from "../utils/enricher-options.js";
import { renderElement } from "../utils/render.js";

export async function createTraitEmbed(uuid, { label, options = [] } = {}) {
  if (typeof uuid !== "string" || !uuid.trim()) return null;

  let item = null;
  try {
    item = await fromUuid(uuid.trim());
  } catch (error) {
    console.warn("FFXIV TTRPG Layout | Unable to resolve Trait embed UUID:", uuid, error);
    return null;
  }

  const card = await buildTraitCardData(item);
  if (!card) return null;

  const root = await renderElement("modules/ffxiv-ttrpg-layout/templates/sheets/partials/ffxivTraitCard.hbs", { card });
  if (!root) return null;

  root.classList.add("ffxiv-trait-embed");
  applyCardEmbedOptions(root, options);
  root.dataset.uuid = item.uuid;
  if (label) root.dataset.label = label;
  return root;
}

export function registerTraitEmbed() {
  CONFIG.TextEditor.enrichers.push({
    id: "ffxiv-trait-embed",
    pattern: embedPattern("FFXIVTrait"),
    enricher: match => {
      const { uuid, label, options } = readEmbedMatch(match);
      return createTraitEmbed(uuid, { label, options });
    },
  });
}
