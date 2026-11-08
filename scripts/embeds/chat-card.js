/**
 * FFXIV TTRPG Layout — Chat Cards
 *
 * Shows Ability and Trait chat messages of the FFXIV system with the same FFXIV
 * Card as the Class Summary, embeds and tooltips. Purely a display change: the
 * stored message is untouched, the system's `.item-card` stays in the DOM
 * (hidden) so the system's own button handlers keep working. Part of the
 * themes: the cards only appear while the Paper or Eorzea Theme is on.
 */

import { isModuleThemeEnabled } from "../settings.js";
import { createAbilityEmbed } from "./ability-embed.js";
import { createTraitEmbed } from "./trait-embed.js";

const ORIGINAL_CLASS = "ffxiv-chat-card-original";

async function replaceItemCard(original) {
  const uuid = original.dataset.itemUuid;
  if (!uuid) return;

  let item = null;
  try {
    item = await fromUuid(uuid);
  } catch (error) {
    return;
  }
  if (!item) return;

  const create = item.type === "ability" ? createAbilityEmbed : item.type === "trait" ? createTraitEmbed : null;
  if (!create) return;

  const card = await create(item.uuid);
  if (!card || !original.isConnected) return;

  card.classList.add("ffxiv-chat-card");
  original.classList.add(ORIGINAL_CLASS);
  original.before(card);
}

export function registerChatCards() {
  Hooks.on("renderChatMessageHTML", (message, html) => {
    if (!isModuleThemeEnabled()) return;
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root) return;

    for (const original of root.querySelectorAll(".item-card[data-item-uuid]")) {
      if (original.classList.contains(ORIGINAL_CLASS)) continue;
      replaceItemCard(original).catch(error => {
        console.warn("FFXIV TTRPG Layout | Unable to render chat card", error);
      });
    }
  });
}
