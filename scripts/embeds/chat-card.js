import { isChatCardsEnabled } from "../settings.js";
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
    if (!isChatCardsEnabled()) return;
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
