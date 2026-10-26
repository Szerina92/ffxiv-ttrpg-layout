import { buildAbilityCardData, buildTraitCardData } from "../sheets/class-summary-data.js";
import { renderElement } from "../utils/render.js";

const TOOLTIP_CLASS = "ffxiv-ability-tooltip";
const LINK_SELECTOR = "a.content-link[data-uuid]";
const TOOLTIP_SELECTOR = `#tooltip.${TOOLTIP_CLASS}, .locked-tooltip.${TOOLTIP_CLASS}`;

let activeLink = null;

/* Tooltip-capable Item types: Ability cards and Trait cards. */
const TOOLTIP_CARDS = {
  ability: {
    build: buildAbilityCardData,
    template: "modules/ffxiv-ttrpg-layout/templates/sheets/partials/ffxivCard.hbs",
    selector: ".ffxiv-class-summary__ability-card",
  },
  trait: {
    build: buildTraitCardData,
    template: "modules/ffxiv-ttrpg-layout/templates/sheets/partials/ffxivTraitCard.hbs",
    selector: ".ffxiv-class-summary__trait-card",
  },
};

function tooltipCardFor(document) {
  return document?.documentName === "Item" ? TOOLTIP_CARDS[document.type] ?? null : null;
}

function getAbilityTooltipElement() {
  return document.querySelector(TOOLTIP_SELECTOR);
}

async function renderAbilityTooltip(item) {
  const config = tooltipCardFor(item);
  if (!config) return null;
  const card = await config.build(item);
  if (!card) return null;

  const node = await renderElement(config.template, { card });
  // Ability templates wrap the card in a node; Trait templates are the card.
  const article = node?.matches?.(config.selector) ? node : node?.querySelector(config.selector);
  return article ? article.outerHTML : null;
}

/* UUIDs already resolved to something that has no tooltip card (other Item
   types, Actors, ...). The type of a document does not change, so this is safe. */
const noTooltip = new Set();

let bound = false;

/** Stop Foundry's own tooltip on this link; remember the text so it can be restored. */
function suppressDefaultTooltip(link) {
  if (link.dataset.tooltip === undefined) return;
  link.dataset.ffxivOriginalTooltip = link.dataset.tooltip;
  delete link.dataset.tooltip;
}

function restoreDefaultTooltip(link) {
  if (link.dataset.ffxivOriginalTooltip === undefined) return;
  link.dataset.tooltip = link.dataset.ffxivOriginalTooltip;
  delete link.dataset.ffxivOriginalTooltip;
}

/**
 * Resolve a UUID to tooltip HTML.
 * @returns {Promise<{html: string|null, capable: boolean}>}
 */
async function resolveTooltip(uuid) {
  let item = null;
  try {
    item = await fromUuid(uuid);
  } catch (error) {
    console.warn("FFXIV TTRPG Layout | Unable to resolve UUID for tooltip:", uuid, error);
    return { html: null, capable: true };
  }

  if (!tooltipCardFor(item)) return { html: null, capable: false };

  try {
    return { html: await renderAbilityTooltip(item), capable: true };
  } catch (error) {
    console.warn("FFXIV TTRPG Layout | Unable to build tooltip:", item, error);
    return { html: null, capable: true };
  }
}

async function showTooltipForLink(link, uuid) {
  suppressDefaultTooltip(link);

  const { html, capable } = await resolveTooltip(uuid);
  const stillHovered = link.isConnected && link.matches(":hover");

  if (!html) {
    // Not ours: give the link its normal Foundry tooltip back.
    if (!capable) noTooltip.add(uuid);
    restoreDefaultTooltip(link);
    if (stillHovered && link.dataset.tooltip) game?.tooltip?.activate(link);
    return;
  }

  if (!stillHovered || !game?.tooltip) return;

  activeLink = link;
  game.tooltip.dismissLockedTooltips?.();
  game.tooltip.activate(link, {
    html,
    direction: "DOWN",
    cssClass: TOOLTIP_CLASS,
    locked: true,
  });

  window.requestAnimationFrame(() => {
    const tooltip = getAbilityTooltipElement();
    if (!tooltip || activeLink !== link) return;
    tooltip.classList.add(TOOLTIP_CLASS);
  });
}

function onPointerOver(event) {
  const link = event.target?.closest?.(LINK_SELECTOR);
  if (!link) return;
  if (event.relatedTarget && link.contains(event.relatedTarget)) return;
  if (link.closest(`.${TOOLTIP_CLASS}`)) return;

  const uuid = String(link.dataset.uuid ?? "").trim();
  if (!uuid || noTooltip.has(uuid)) return;

  void showTooltipForLink(link, uuid);
}

/**
 * Show the Ability/Trait card as a tooltip on content links to those Items,
 * in every window (Journal, system Actor/Item sheets, chat, ...). Links are
 * checked lazily on hover; one delegated listener on the document, so
 * re-rendered windows need no re-binding.
 */
export function activateAbilityTooltips() {
  if (bound) return;
  bound = true;
  document.addEventListener("pointerover", onPointerOver, true);
}
