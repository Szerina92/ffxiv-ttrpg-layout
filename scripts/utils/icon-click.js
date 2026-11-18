/* Icon click */

const SELECTOR = "[data-ffxiv-item-uuid], [data-ffxiv-actor-uuid]";

async function onClick(event) {
  const icon = event.target?.closest?.(SELECTOR);
  const uuid = (icon?.dataset.ffxivItemUuid ?? icon?.dataset.ffxivActorUuid)?.trim();
  if (!uuid) return;

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
