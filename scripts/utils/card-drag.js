/**
 * FFXIV TTRPG Layout — drag cards like UUID links.
 *
 * Item, Ability and Trait embeds (`@FFXIV…[uuid]`) can be dragged onto an
 * actor sheet, the sidebar or a hotbar slot, the same way as a `@UUID` link.
 * Only the icon is the drag handle (like the icon of an item in a sheet); the
 * rest of the card stays selectable text. Trait cards have no icon, there the
 * name is the handle. Other elements can be dragged by naming their document
 * directly: `draggable="true" data-ffxiv-drag-uuid="…"` (used by the job icon
 * of the Class Summary, which carries the Job of the selected level). One
 * listener on the document covers Journals, other sheets and chat cards.
 */

const CARD_SELECTOR = ".ffxiv-item-embed, .ffxiv-ability-embed, .ffxiv-trait-embed";
// Item cards wrap the icon in a link; that link comes first in document order.
const HANDLE_SELECTOR = ".ffxiv-item-embed__icon-link, .ffxiv-class-summary__ability-icon, .ffxiv-class-summary__trait-head h3";
const HANDLE_CLASS = "ffxiv-card-drag-handle";

/** Mark the icon (or the trait name) of a freshly rendered card as drag handle. */
export function makeCardDraggable(root) {
  if (!root?.dataset?.uuid) return;
  const handle = root.matches?.(HANDLE_SELECTOR) ? root : root.querySelector?.(HANDLE_SELECTOR);
  if (!handle) return;
  handle.draggable = true;
  handle.classList.add(HANDLE_CLASS);
}

function onDragStart(event) {
  const direct = event.target?.closest?.("[data-ffxiv-drag-uuid]");
  const handle = direct ? null : event.target?.closest?.(`.${HANDLE_CLASS}`);
  const uuid = direct?.dataset.ffxivDragUuid || handle?.closest?.(CARD_SELECTOR)?.dataset.uuid;
  if (!uuid || !event.dataTransfer) return;

  // Same drag data as a Foundry content link of an Item.
  event.dataTransfer.setData("text/plain", JSON.stringify({ type: "Item", uuid }));
  event.dataTransfer.effectAllowed = "copy";
  event.stopPropagation();
}

export function activateCardDrag() {
  document.addEventListener("dragstart", onDragStart, true);
}
