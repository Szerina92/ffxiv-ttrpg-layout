/**
 * FFXIV TTRPG Layout — ability cards on the actor sheet (Paper and Eorzea Theme)
 *
 * The system's actor sheet shows "Check: Intelligence". With a Layout theme
 * the Check row reads like the module's Ability Card: "Check: INT (d20 + 5)",
 * where the number is the character's own value (`getRollData().int` etc., lower case), and the CR row highlights
 * "Defense" / "Magic Defense". Display only: the item and the sheet's own
 * markup stay as they are, the text of two rows is rewritten after each render.
 */

import { isModuleThemeEnabled } from "../settings.js";
import { defensePattern } from "../utils/defense-terms.js";

const DONE_FLAG = "ffxivCardEnhanced";
const SPECIAL_CHECK = "FFXIV.Special";

const CHECK_ABBREVIATIONS = Object.freeze({
  "FFXIV.Attributes.Strength.long": "STR",
  "FFXIV.Attributes.Dexterity.long": "DEX",
  "FFXIV.Attributes.Vitality.long": "VIT",
  "FFXIV.Attributes.Intelligence.long": "INT",
  "FFXIV.Attributes.Mind.long": "MND",
});

const escape = value => foundry.utils.escapeHTML(String(value ?? ""));

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
    + `<span class="ffxiv-class-summary__ability-check-modifier">${escape(modifier)}</span>`);
}

function enhanceChallenge(detail, item) {
  const challenge = String(item.system.challenge ?? "");
  if (!challenge) return;
  const html = escape(challenge).replace(defensePattern(),
    match => `<span class="ffxiv-class-summary__ability-value--blue-dark ffxiv-class-summary__ability-challenge-highlight">${match}</span>`);
  setValue(detail, html);
}

function enhanceCard(card, actor, rollData, labels) {
  if (card.dataset[DONE_FLAG]) return;
  const item = actor.items.get(card.dataset.itemId);
  if (!item || item.type !== "ability") return;

  for (const detail of card.querySelectorAll(".ability-details > .detail")) {
    const label = labelOf(detail);
    if (label === labels.check) enhanceCheck(detail, item, rollData);
    else if (label === labels.challenge) enhanceChallenge(detail, item);
  }
  card.dataset[DONE_FLAG] = "true";
}

export function registerActorAbilityCards() {
  Hooks.on("renderActorSheetV2", (app, html) => {
    if (!isModuleThemeEnabled()) return;
    const actor = app.document;
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!actor || !root) return;

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
  });
}
