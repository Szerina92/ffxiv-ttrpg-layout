import { parseEnricherOptions } from "../utils/enricher-options.js";
import { buildPetCardData } from "../sheets/class-summary-data.js";

/**
 * FFXIV TTRPG Layout — Pet Embed
 *
 * Standalone Pet Embeds and Class Summary Pet Cards share the same Pet Card
 * template and the same underlying Pet view model. The presentation remains
 * type-specific, while Ability children use the Unified Card component.
 */
class FFXIVPetEmbed {
  static async createPetEmbed(uuid, options = {}) {
    if (typeof uuid !== "string" || !uuid.trim()) return null;

    const actor = await fromUuid(uuid.trim());
    const templateData = await buildPetCardData(actor);
    if (!templateData) return null;

    const html = await foundry.applications.handlebars.renderTemplate(
      "modules/ffxiv-ttrpg-layout/templates/embeds/pet-embed.hbs",
      templateData,
    );

    const template = document.createElement("template");
    template.innerHTML = String(html ?? "").trim();
    const root = template.content.firstElementChild;
    if (!root) return null;

    if (options.label) root.dataset.label = options.label;

    const position = ["left", "right", "center"].includes(options.position)
      ? options.position
      : "center";

    root.classList.add(`ffxiv-pet-embed--float-${position}`);
    return root;
  }
}

export async function createPetEmbed(uuid, options = {}) {
  return FFXIVPetEmbed.createPetEmbed(uuid, options);
}

export function registerPetEmbed() {
  CONFIG.TextEditor.enrichers.push({
    id: "ffxiv-pet-embed",
    pattern: /@FFXIVPet\[([^\]\s]+)\](?:\{([^}]+)\})?/g,
    enricher: async match => {
      const uuid = match?.[1];
      const { label, options } = parseEnricherOptions(match?.[2]);
      const position = ["left", "right", "center"].find(value =>
        options.some(part => part.toLowerCase() === value),
      ) ?? "center";

      const element = await createPetEmbed(uuid, { label, position });
      if (!element) return null;
      if (label) element.dataset.label = label;
      return element;
    },
  });
}
