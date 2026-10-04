import { buildAbilityCardData } from "../sheets/class-summary-data.js";

const TOOLTIP_CLASS = "ffxiv-ability-tooltip";
const LINK_SELECTOR = "a.content-link[data-uuid]";
const TOOLTIP_SELECTOR = `#tooltip.${TOOLTIP_CLASS}, .locked-tooltip.${TOOLTIP_CLASS}`;
const tooltipCache = new WeakMap();

let activeLink = null;

function isAbilityItem(document) {
  return document?.documentName === "Item" && document?.type === "ability";
}

function getAbilityTooltipElement() {
  return document.querySelector(TOOLTIP_SELECTOR);
}

async function renderAbilityTooltip(item) {
  const card = await buildAbilityCardData(item);
  if (!card) return null;

  const html = await foundry.applications.handlebars.renderTemplate(
    "modules/ffxiv-ttrpg-layout/templates/sheets/partials/ffxivCard.hbs",
    { card },
  );

  const template = document.createElement("template");
  template.innerHTML = String(html ?? "").trim();
  const node = template.content.firstElementChild;
  const article = node?.querySelector?.(".ffxiv-class-summary__ability-card");
  return article ? article.outerHTML : null;
}

async function prepareAbilityLink(link) {
  if (!link || link.dataset.ffxivAbilityTooltipPrepared === "true") return;
  link.dataset.ffxivAbilityTooltipPrepared = "true";

  const uuid = String(link.dataset.uuid ?? "").trim();
  if (!uuid) return;

  let item = null;
  try {
    item = await fromUuid(uuid);
  } catch (error) {
    console.warn("FFXIV TTRPG Layout | Unable to resolve UUID for Ability tooltip:", uuid, error);
    return;
  }

  if (!isAbilityItem(item)) return;

  link.classList.add("ffxiv-ability-tooltip-link");
  link.dataset.ffxivAbilityTooltipDirection = "DOWN";
  if (link.dataset.tooltip !== undefined) {
    link.dataset.ffxivOriginalTooltip = link.dataset.tooltip;
    delete link.dataset.tooltip;
  }

  try {
    const html = await renderAbilityTooltip(item);
    if (html) tooltipCache.set(link, html);
  } catch (error) {
    console.warn("FFXIV TTRPG Layout | Unable to build Ability tooltip:", item, error);
  }
}

async function showAbilityTooltip(link) {
  const html = tooltipCache.get(link);
  if (!html || !game?.tooltip) return;

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

function bind(root) {
  if (!root || root.dataset.ffxivAbilityTooltipBound === "true") return;
  root.dataset.ffxivAbilityTooltipBound = "true";

  const prepareVisibleLinks = () => {
    const links = [...root.querySelectorAll(LINK_SELECTOR)];
    for (const link of links) void prepareAbilityLink(link);
  };

  root.addEventListener("pointerover", async event => {
    const link = event.target?.closest?.(".ffxiv-ability-tooltip-link");
    if (!link || !root.contains(link)) return;
    if (event.relatedTarget && link.contains(event.relatedTarget)) return;
    await showAbilityTooltip(link);
  }, true);

  const observer = new MutationObserver(prepareVisibleLinks);
  observer.observe(root, { childList: true, subtree: true });
  prepareVisibleLinks();
}

export function activateAbilityTooltips(root) {
  bind(root);
}

export { renderAbilityTooltip };
