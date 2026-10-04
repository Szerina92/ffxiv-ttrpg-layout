import { localize, localizeTags } from "../i18n.js";
/**
 * FFXIV TTRPG Layout — Item Embed
 *
 * Item Cards now use the same shared FFXIV Card component as Class Summary
 * abilities. The Item type only supplies the data; the card layout is shared.
 */
const TextEditor = foundry.applications.ux.TextEditor.implementation;

async function createItemEmbed(uuid, options = {}) {
  if (typeof uuid !== "string" || !uuid.trim()) return null;

  const item = await fromUuid(uuid.trim());
  if (!item || item.documentName !== "Item") return null;

  const system = item.system ?? {};
  const tags = Array.isArray(system.tags) ? system.tags : [];
  const tagLabels = localizeTags(tags);
  const metaFields = [];

  const shopTier = displayValue(system.shop_tier);
  const price = Number(system.price?.buy ?? 0);
  const target = displayValue(system.target);
  const range = displayValue(system.range);

  if (shopTier) metaFields.push({ label: localize("FFXIVTTRPGLayout.Item.ShopTier", "Shop Tier"), value: shopTier });
  if (price > 0) metaFields.push({ label: localize("FFXIVTTRPGLayout.Item.Price", "Price"), value: String(price) });
  if (target) metaFields.push({ label: localize("FFXIVTTRPGLayout.Item.Target", "Target"), value: target });
  if (range) metaFields.push({ label: localize("FFXIVTTRPGLayout.Item.Range", "Range"), value: range });

  const description = displayValue(system.description);
  let descriptionHtml = "";
  if (description) {
    descriptionHtml = await TextEditor.enrichHTML(description, {
      async: true,
      custom: true,
      documents: true,
      embeds: true,
      links: true,
      rolls: true,
      secrets: true,
      relativeTo: item,
    });
  }

  const card = {
    cardType: "item",
    isItem: true,
    uuid: item.uuid,
    name: item.name ?? "",
    img: item.img ?? "",
    typeLabel: tagLabels.join(", "),
    metaFields,
    baseEffect: displayValue(system.base_effect),
    description: descriptionHtml,
  };

  const html = await foundry.applications.handlebars.renderTemplate(
    "modules/ffxiv-ttrpg-layout/templates/embeds/item-card.hbs",
    { card },
  );

  const template = document.createElement("template");
  template.innerHTML = String(html ?? "").trim();
  const root = template.content.firstElementChild;
  if (!root) return null;

  root.classList.add("ffxiv-item-embed");
  root.dataset.uuid = item.uuid;
  if (options.label) root.dataset.label = options.label;
  return root;
}

function displayValue(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function registerItemEmbed() {
  CONFIG.TextEditor.enrichers.push({
    id: "ffxiv-item-embed",
    pattern: /@FFXIVItem\[([^\]\s]+)\](?:\{([^}]+)\})?/g,
    enricher: async match => {
      const uuid = match?.[1];
      const label = match?.[2];
      const element = await createItemEmbed(uuid, { label });
      if (!element) return null;
      return element;
    }
  });
}

export { createItemEmbed };
