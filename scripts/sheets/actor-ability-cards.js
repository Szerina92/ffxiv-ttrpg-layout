/* Actor sheet ability cards */

import { CHECK_ABBREVIATIONS, isAbilityType, SPECIAL_CHECK } from "../utils/ability-data.js";
import { defensePattern } from "../utils/defense-terms.js";
import { escapeHTML } from "../utils/values.js";

const DONE_FLAG = "ffxivCardEnhanced";

function formatModifier(abbreviation, value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return `(d20 + ${abbreviation})`;
  return `(d20 ${number < 0 ? "-" : "+"} ${Math.abs(number)})`;
}

function labelOf(detail) {
  return detail.querySelector(":scope > strong")?.textContent?.trim() ?? "";
}

function setValue(detail, html) {
  const label = detail.querySelector(":scope > strong");
  if (!label) return;
  detail.replaceChildren(label);
  detail.insertAdjacentHTML("beforeend", ` ${html}`);
}

function enhanceCheck(detail, item, rollData) {
  const check = String(item.system.check ?? "");
  const abbreviation = CHECK_ABBREVIATIONS[check];
  if (!abbreviation || check === SPECIAL_CHECK) return;
  const modifier = formatModifier(abbreviation, rollData?.[abbreviation.toLowerCase()]);
  setValue(detail, `<span class="ffxiv-class-summary__ability-value--blue-dark">${abbreviation}</span>`
    + `<span class="ffxiv-class-summary__ability-check-modifier">${escapeHTML(modifier)}</span>`);
}

function enhanceChallenge(detail, item) {
  const challenge = String(item.system.challenge ?? "");
  if (!challenge) return;
  const html = escapeHTML(challenge).replace(defensePattern(),
    match => `<span class="ffxiv-class-summary__ability-value--blue-dark ffxiv-class-summary__ability-challenge-highlight">${match}</span>`);
  setValue(detail, html);
}

function enhanceCard(card, actor, rollData, labels) {
  const item = actor.items.get(card.dataset.itemId);
  if (!item || !isAbilityType(item.type)) return;

  for (const detail of card.querySelectorAll(".ability-details > .detail")) {
    if (detail.dataset[DONE_FLAG]) continue;
    const label = labelOf(detail);
    if (label === labels.check) enhanceCheck(detail, item, rollData);
    else if (label === labels.challenge) enhanceChallenge(detail, item);
    detail.dataset[DONE_FLAG] = "true";
  }
}

export function enhanceCards(root, actor) {
  const labels = {
    check: `${game.i18n.localize("FFXIV.Abilities.Check")}:`,
    challenge: `${game.i18n.localize("FFXIV.Abilities.Challenge")}:`,
  };
  const rollData = actor.getRollData?.() ?? {};
  for (const card of root.querySelectorAll(".actor-abilities .ability-card[data-item-id]")) {
    try {
      enhanceCard(card, actor, rollData, labels);
    } catch (error) {
      console.warn("FFXIV TTRPG Layout | Unable to adjust ability card", error);
    }
  }
}
