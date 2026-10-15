/**
 * FFXIV TTRPG Layout — central module hub.
 */

import { registerSettings } from "./settings.js";
import { registerJournalSheet } from "./sheets/journal-sheet.js";
import { registerClassSummarySheet } from "./sheets/class-summary-sheet.js";
import { registerRuleSheet } from "./sheets/rule-sheet.js";
import { registerItemEmbed } from "./embeds/item-embed.js";
import { registerNPCEmbed } from "./embeds/npc-embed.js";
import { registerPetEmbed } from "./embeds/pet-embed.js";
import { registerTableEmbed } from "./embeds/table-embed.js";
import { registerRules } from "./rules.js";
import { registerEditorMenu } from "./editor-menu.js";
import { registerCompendiumToc } from "./toc/toc.js";
import { refreshPagePointers } from "./page-pointer.js";
import { preloadPageChangeSound } from "./page-change-sound.js";

Hooks.once("init", async () => {
  await foundry.applications.handlebars.loadTemplates({
    ffxivCard: "modules/ffxiv-ttrpg-layout/templates/sheets/partials/ffxivCard.hbs",
    ffxivClassSummaryAbilityCard: "modules/ffxiv-ttrpg-layout/templates/sheets/partials/ffxivClassSummaryAbilityCard.hbs",
    ffxivItemCard: "modules/ffxiv-ttrpg-layout/templates/embeds/item-card.hbs",
    ffxivPetCard: "modules/ffxiv-ttrpg-layout/templates/sheets/partials/ffxivPetCard.hbs",
    ffxivTocGroup: "modules/ffxiv-ttrpg-layout/templates/toc/toc-group.hbs",
  });

  registerSettings({ onPagePointerChange: refreshPagePointers });

  registerJournalSheet();
  // Register custom JournalEntryPage data models before any other sheet
  // registration can cause Foundry to cache JournalEntryPage.TYPES.
  registerRuleSheet();
  registerRules();
  registerClassSummarySheet();
  registerEditorMenu();
  registerCompendiumToc();

  registerItemEmbed();
  registerNPCEmbed();
  registerPetEmbed();
  registerTableEmbed();

  preloadPageChangeSound();
});
