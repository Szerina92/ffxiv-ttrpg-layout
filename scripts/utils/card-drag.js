/* Card drag */

const CARD_SELECTOR = ".ffxiv-item-embed, .ffxiv-ability-embed, .ffxiv-trait-embed";
const HANDLE_SELECTOR = ".ffxiv-item-embed__icon-link, .ffxiv-class-summary__ability-icon, .ffxiv-class-summary__trait-head h3";
const HANDLE_CLASS = "ffxiv-card-drag-handle";

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

  event.dataTransfer.setData("text/plain", JSON.stringify({ type: "Item", uuid }));
  event.dataTransfer.effectAllowed = "copy";
  event.stopPropagation();
}

export function activateCardDrag() {
  document.addEventListener("dragstart", onDragStart, true);
}
