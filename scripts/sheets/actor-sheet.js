/* Actor sheet */

import { isAutoLinksEnabled, isModuleThemeEnabled } from "../settings.js";
import { linkActorSheet } from "../utils/auto-links.js";
import { watchElement } from "../utils/watch-element.js";
import { enhanceCards } from "./actor-ability-cards.js";

const MINIONS_HEADING_CLASS = "ffxiv-minions-heading";

function addMinionHeading(root) {
  for (const panel of root.querySelectorAll(".actor-companions > .abilities-tab-content")) {
    const heading = panel.querySelector(`:scope > .${MINIONS_HEADING_CLASS}`);
    if (panel.querySelector(":scope > .companions-sub-tabs")) {
      heading?.remove();
      continue;
    }
    if (heading) continue;

    const h2 = document.createElement("h2");
    h2.className = MINIONS_HEADING_CLASS;
    h2.textContent = game.i18n.localize("FFXIV.CharacterSheet.Minions");
    panel.prepend(h2);
  }
}

function enhance(root, actor) {
  enhanceCards(root, actor);
  addMinionHeading(root);
  if (actor.type === "character" && isAutoLinksEnabled()) linkActorSheet(root, actor);
}

export function registerActorSheet() {
  Hooks.on("renderActorSheetV2", (app, html) => {
    if (!isModuleThemeEnabled()) return;
    const actor = app.document;
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!actor || !root) return;

    enhance(root, actor);
    watchElement(root, "actor-sheet", element => enhance(element, actor));
  });
}
