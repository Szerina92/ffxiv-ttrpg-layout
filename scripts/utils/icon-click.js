/**
 * FFXIV TTRPG Layout — open the document behind a card icon.
 *
 * Cards mark their icon with `data-ffxiv-item-uuid`, NPC and Pet embeds their
 * name link with `data-ffxiv-actor-uuid`. A click opens that document's sheet
 * instead of Foundry's image popout or the browser following the link. One
 * listener on the document covers Journals, embeds and chat cards.
 */

const SELECTOR = "[data-ffxiv-item-uuid], [data-ffxiv-actor-uuid]";

async function onClick(event) {
  const icon = event.target?.closest?.(SELECTOR);
  const uuid = (icon?.dataset.ffxivItemUuid ?? icon?.dataset.ffxivActorUuid)?.trim();
  if (!uuid) return;

  // Capture phase: runs before Foundry's own image handlers.
  event.preventDefault();
  event.stopPropagation();

  try {
    const document = await fromUuid(uuid);
    if (document?.sheet) await document.sheet.render({ force: true });
  } catch (error) {
    console.warn("FFXIV TTRPG Layout | Unable to open document from icon", uuid, error);
  }
}

export function activateIconLinks() {
  document.addEventListener("click", onClick, true);
}
