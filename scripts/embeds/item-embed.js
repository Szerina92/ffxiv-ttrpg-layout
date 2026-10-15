/**
 * FFXIV TTRPG Layout — Item Embed
 *
 * Item Cards use the same shared FFXIV Card component as Class Summary
 * abilities. The Item type only supplies the data; the card layout is shared.
 */

import { localize, localizeTags } from "../i18n.js";
import { enrich } from "../utils/enrich.js";
import { renderElement } from "../utils/render.js";
import { text } from "../utils/values.js";

async function createItemEmbed(uuid, { label } = {}) {
  if (typeof uuid !== "string" || !uuid.trim()) return null;

  const item = await fromUuid(uuid.trim());
  if (!item || item.documentName !== "Item") return null;

  const system = item.system ?? {};
  const price = Number(system.price?.buy ?? 0);

  const metaFields = [
    { label: localize("FFXIVTTRPGLayout.Item.ShopTier"), value: text(system.shop_tier) },
    { label: localize("FFXIVTTRPGLayout.Item.Price"), value: price > 0 ? String(price) : "" },
    { label: localize("FFXIVTTRPGLayout.Item.Target"), value: text(system.target) },
    { label: localize("FFXIVTTRPGLayout.Item.Range"), value: text(system.range) },
  ].filter(field => field.value);

  const description = text(system.description);

  const card = {
    cardType: "item",
    isItem: true,
    uuid: item.uuid,
    name: item.name ?? "",
    img: item.img ?? "",
    typeLabel: localizeTags(system.tags).join(", "),
    metaFields,
    baseEffect: text(system.base_effect),
    description: description ? await enrich(description, item) : "",
  };

  const root = await renderElement("modules/ffxiv-ttrpg-layout/templates/embeds/item-card.hbs", { card });
  if (!root) return null;

  root.classList.add("ffxiv-item-embed");
  root.dataset.uuid = item.uuid;
  if (label) root.dataset.label = label;
  return root;
}

export function registerItemEmbed() {
  CONFIG.TextEditor.enrichers.push({
    id: "ffxiv-item-embed",
    pattern: /@FFXIVItem\[([^\]\s]+)\](?:\{([^}]+)\})?/g,
    enricher: match => createItemEmbed(match[1], { label: match[2] }),
  });
}
