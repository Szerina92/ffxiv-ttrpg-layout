/* Module entry point */

import "./babele.js";
import { registerSettings } from "./settings.js";
import { registerJournalSheet } from "./sheets/journal-sheet.js";
import { registerClassSummarySheet } from "./sheets/class-summary-sheet.js";
import { registerItemEmbed } from "./embeds/item-embed.js";
import { registerAbilityEmbed } from "./embeds/ability-embed.js";
import { registerTraitEmbed } from "./embeds/trait-embed.js";
import { registerEmbed } from "./embeds/embed.js";
import { registerNPCEmbed } from "./embeds/npc-embed.js";
import { registerPetEmbed } from "./embeds/pet-embed.js";
import { registerTableEmbed } from "./embeds/table-embed.js";
import { registerChatCards } from "./embeds/chat-card.js";
import { activateIconLinks } from "./utils/icon-click.js";
import { activateCardDrag } from "./utils/card-drag.js";
import { activateItemLinkMarking } from "./utils/enrich.js";
import { activateLinkTooltips } from "./utils/link-tooltip.js";
import { registerRuleColors } from "./rule-colors.js";
import { registerEditorMenu } from "./editor-menu.js";
import { registerCompendiumToc } from "./toc/toc.js";
import { registerThemes } from "./themes.js";
import { registerActorSheet } from "./sheets/actor-sheet.js";
import { refreshPagePointers } from "./page-pointer.js";
import { preloadPageChangeSound } from "./page-change-sound.js";

Hooks.once("init", async () => {
  await foundry.applications.handlebars.loadTemplates({
    ffxivCard: "modules/ffxiv-ttrpg-layout/templates/sheets/partials/ffxivCard.hbs",
    ffxivClassSummaryAbilityCard: "modules/ffxiv-ttrpg-layout/templates/sheets/partials/ffxivClassSummaryAbilityCard.hbs",
    ffxivItemCard: "modules/ffxiv-ttrpg-layout/templates/embeds/item-card.hbs",
    ffxivTraitCard: "modules/ffxiv-ttrpg-layout/templates/sheets/partials/ffxivTraitCard.hbs",
    ffxivPetCard: "modules/ffxiv-ttrpg-layout/templates/sheets/partials/ffxivPetCard.hbs",
    ffxivTocGroup: "modules/ffxiv-ttrpg-layout/templates/toc/toc-group.hbs",
  });

  registerSettings({ onPagePointerChange: refreshPagePointers });

  registerJournalSheet();
  registerRuleColors();
  registerClassSummarySheet();
  registerEditorMenu();
  registerCompendiumToc();
  registerThemes();
  registerActorSheet();

  registerItemEmbed();
  registerAbilityEmbed();
  registerTraitEmbed();
  registerNPCEmbed();
  registerPetEmbed();
  registerTableEmbed();
  registerEmbed();
  registerChatCards();

  preloadPageChangeSound();
});

Hooks.once("ready", () => {
  activateIconLinks();
  activateCardDrag();
  activateItemLinkMarking();
  activateLinkTooltips();
});
