/**
 * FFXIV TTRPG Layout — Item Embed
 *
 * Item Cards use the same shared FFXIV Card component as Class Summary
 * abilities. The Item type only supplies the data; the card layout is shared.
 */

import { localize, localizeTags } from "../i18n.js";
import { tidyRichText } from "../sheets/class-summary-data.js";
import { makeCardDraggable } from "../utils/card-drag.js";
import { enrich } from "../utils/enrich.js";
import { embedPattern, enrichEmbed } from "../utils/enricher-options.js";
import { renderElement } from "../utils/render.js";
import { text } from "../utils/values.js";

export async function createItemEmbed(uuid, { label, depth = 1 } = {}) {
  if (typeof uuid !== "string" || !uuid.trim()) return null;

  const item = await fromUuid(uuid.trim());
  if (!item || item.documentName !== "Item") return null;

  const system = item.system ?? {};
  const price = Number(system.price?.buy ?? 0);

  const metaFields = [
    { label: localize("FFXIV.Item.ShopTier"), value: text(system.shop_tier) },
    { label: localize("FFXIVTTRPGLayout.Item.Price"), value: price > 0 ? String(price) : "" },
    { label: localize("FFXIV.Abilities.Target"), value: text(system.target) },
    { label: localize("FFXIV.Abilities.Range"), value: text(system.range) },
  ].filter(field => field.value);

  const description = text(system.description);
  const baseEffect = text(system.base_effect);
  // Minions and mounts keep their traits in an own rich-text field.
  const traits = text(system.traits);
  const minionType = text(system.minion_type);
  const typeLabels = [minionType ? localize(minionType) : "", ...localizeTags(system.tags)].filter(Boolean);

  const card = {
    cardType: "item",
    isItem: true,
    uuid: item.uuid,
    name: item.name ?? "",
    img: item.img ?? "",
    typeLabel: typeLabels.join(", "),
    metaFields,
    // Rich text: links such as @UUID[…]{Cure} in augments become real links.
    // tidyRichText unwraps the first paragraph, so the text stays next to its label.
    // Embeds in these texts (e.g. the ability an augment grants) render as
    // nested cards, one level deep (see enrichEmbed).
    baseEffect: baseEffect ? tidyRichText(await enrich(baseEffect, item, { depth })) : "",
    traits: traits ? tidyRichText(await enrich(traits, item, { depth })) : "",
    description: description ? await enrich(description, item, { depth }) : "",
  };

  const root = await renderElement("modules/ffxiv-ttrpg-layout/templates/embeds/item-card.hbs", { card });
  if (!root) return null;

  root.classList.add("ffxiv-item-embed");
  root.dataset.uuid = item.uuid;
  makeCardDraggable(root);
  if (label) root.dataset.label = label;
  return root;
}

export function registerItemEmbed() {
  CONFIG.TextEditor.enrichers.push({
    id: "ffxiv-item-embed",
    pattern: embedPattern("FFXIVItem"),
    enricher: (match, enrichOptions) => enrichEmbed(match, enrichOptions, ({ uuid, label, depth }) => createItemEmbed(uuid, { label, depth })),
  });
}
