/* Link tooltip */

import { localize, localizeTags } from "../i18n.js";
import { enrich } from "./enrich.js";

const LINK_SELECTOR = "a.content-link.ffxiv-uuid-link[data-uuid]";
const DELAY = 500;
const BODY_CLASS = "ffxiv-hotbar-tooltip-visible";

const SUBTYPE_KEYS = {
  primary_ability: "FFXIV.Tags.Primary",
  secondary_ability: "FFXIV.Tags.Secondary",
  instant_ability: "FFXIV.Tags.Instant",
};
const SUBTYPE_TAGS = ["FFXIV.Tags.Primary", "FFXIV.Tags.Secondary", "FFXIV.Tags.Instant", "FFXIV.ItemType.limit_break"];

const state = { link: null, tooltip: null, timer: null, cancelLock: null, cancelDismissal: null };

let lockHelpers = null;
function loadLockHelpers() {
  lockHelpers ??= import(foundry.utils.getRoute("systems/ffxiv/module/helpers/tooltips.mjs")).catch(() => null);
  return lockHelpers;
}

/* -------------------------------------------- */
/*  Markup                                      */
/* -------------------------------------------- */

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function typeLine(item) {
  const tags = Array.isArray(item.system?.tags) ? item.system.tags : [];
  const subtypeKey = item.type === "trait"
    ? "FFXIV.ItemType.trait"
    : SUBTYPE_KEYS[item.type] ?? SUBTYPE_TAGS.find(tag => tags.includes(tag)) ?? "FFXIV.ItemType.ability";
  return localizeTags([subtypeKey, ...tags]).join(" · ");
}

async function buildTooltip(item) {
  const tooltip = element("aside", "ffxiv-hotbar-ability-tooltip ffxiv-link-tooltip");
  tooltip.setAttribute("role", "tooltip");

  const header = element("div", "ffxiv-hotbar-ability-header");
  const img = element("img");
  img.src = item.img;
  img.alt = "";
  const heading = element("div");
  heading.append(element("div", "ffxiv-hotbar-ability-name", item.name), element("div", "ffxiv-hotbar-ability-type", typeLine(item)));
  header.append(img, heading);
  tooltip.append(header);

  const reason = item.getAbilityUnavailableReason?.() ?? "";
  if (reason) tooltip.append(element("p", "ffxiv-hotbar-ability-readiness", reason));

  const system = item.system ?? {};
  const details = [
    [localize("FFXIV.Abilities.Range"), system.range],
    [localize("FFXIV.Abilities.Target"), system.target],
    [localize("FFXIV.Abilities.Cost"), system.cost],
    ["CR", system.challenge],
  ].filter(([, value]) => value !== "" && value !== null && value !== undefined);
  if (details.length) {
    const grid = element("dl", "ffxiv-hotbar-ability-details");
    for (const [label, value] of details) grid.append(element("dt", "", label), element("dd", "", String(value)));
    tooltip.append(grid);
  }

  const sections = [
    [localize("FFXIV.Abilities.BaseEffect"), system.base_effect],
    [localize("FFXIV.Abilities.DirectHit"), system.direct_hit],
    [null, system.description],
  ].filter(([, content]) => content);
  if (sections.length) {
    const body = element("div", "ffxiv-hotbar-ability-overview");
    for (const [index, [label, content]] of sections.entries()) {
      if (index) body.append(element("hr"));
      const section = element("div", "ffxiv-hotbar-ability-section");
      if (label) section.append(element("strong", "ffxiv-hotbar-ability-section-label", label));
      const text = element("div", "ffxiv-hotbar-ability-section-content");
      text.innerHTML = await enrich(content, item, { depth: 2 });
      section.append(text);
      body.append(section);
    }
    tooltip.append(body);
  }
  return tooltip;
}

/* -------------------------------------------- */
/*  Show and hide                               */
/* -------------------------------------------- */

function position(tooltip, link) {
  const anchor = link.getBoundingClientRect();
  const box = tooltip.getBoundingClientRect();
  const margin = 10;
  const left = Math.min(Math.max(margin, anchor.left + anchor.width / 2 - box.width / 2), window.innerWidth - box.width - margin);
  const top = anchor.top - box.height - margin >= margin ? anchor.top - box.height - margin : anchor.bottom + margin;
  tooltip.style.left = `${Math.round(left)}px`;
  tooltip.style.top = `${Math.round(top)}px`;
}

function hide() {
  clearTimeout(state.timer);
  state.cancelLock?.();
  state.cancelDismissal?.();
  state.tooltip?.remove();
  document.body.classList.remove(BODY_CLASS);
  Object.assign(state, { link: null, tooltip: null, timer: null, cancelLock: null, cancelDismissal: null });
}

async function show(link) {
  let item = null;
  try {
    item = await fromUuid(link.dataset.uuid);
  } catch (_error) {
    item = null;
  }
  if (state.link !== link || !link.isConnected || !link.matches(":hover") || item?.documentName !== "Item") return;

  const tooltip = await buildTooltip(item);
  if (state.link !== link || !link.matches(":hover")) return;

  state.tooltip = tooltip;
  document.body.append(tooltip);
  position(tooltip, link);
  game.tooltip?.deactivate?.();
  document.body.classList.add(BODY_CLASS);
  tooltip.classList.add("visible");
  tooltip.addEventListener("contextmenu", event => {
    event.preventDefault();
    hide();
  });

  const helpers = await loadLockHelpers();
  if (!helpers || state.tooltip !== tooltip) return;
  state.cancelLock = helpers.addTooltipLockProgress(tooltip, () => {
    state.cancelLock = null;
    if (state.tooltip !== tooltip) return;
    tooltip.classList.add("locked");
    document.body.classList.remove(BODY_CLASS);
    state.cancelDismissal = helpers.manageTooltipDismissal(tooltip, link, hide);
  });
}

function onPointerOver(event) {
  const link = event.target?.closest?.(LINK_SELECTOR);
  if (!link) return;
  event.stopPropagation();
  if (link.contains(event.relatedTarget) || state.link === link) return;
  if (state.tooltip?.classList.contains("locked")) return;
  hide();
  state.link = link;
  state.timer = setTimeout(() => show(link).catch(error => {
    console.warn("FFXIV TTRPG Layout | Unable to show link tooltip", error);
  }), DELAY);
}

function onPointerOut(event) {
  const link = event.target?.closest?.(LINK_SELECTOR);
  if (!link || link !== state.link || link.contains(event.relatedTarget)) return;
  if (state.tooltip?.classList.contains("locked")) return;
  hide();
}

export function activateLinkTooltips() {
  window.addEventListener("pointerover", onPointerOver, true);
  window.addEventListener("pointerout", onPointerOut, true);
}
