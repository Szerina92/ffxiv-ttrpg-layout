/**
 * FFXIV TTRPG Layout — central module hub.
 */

import { registerJournalSheet } from "./sheets/journal-sheet.js";
import { registerClassSummarySheet } from "./sheets/class-summary-sheet.js";
import { registerItemEmbed } from "./embeds/item-embed.js";
import { registerNPCEmbed } from "./embeds/npc-embed.js";
import { registerPetEmbed } from "./embeds/pet-embed.js";
import { registerMarkerRenderer } from "./marker-renderer.js";
import { registerRuleSheet } from "./sheets/rule-sheet.js";
import { registerRuleEnricher, registerRulesCompendiumSetting } from "./rules.js";
import { registerPagePointerSetting } from "./page-pointer.js";
import { registerPageChangeSoundSetting } from "./page-change-sound.js";

Hooks.once("init", async () => {
  await foundry.applications.handlebars.loadTemplates({
    ffxivCard: "modules/ffxiv-ttrpg-layout/templates/sheets/partials/ffxivCard.hbs",
    ffxivClassSummaryAbilityCard: "modules/ffxiv-ttrpg-layout/templates/sheets/partials/ffxivClassSummaryAbilityCard.hbs",
    ffxivItemCard: "modules/ffxiv-ttrpg-layout/templates/embeds/item-card.hbs",
    ffxivPetCard: "modules/ffxiv-ttrpg-layout/templates/sheets/partials/ffxivPetCard.hbs",
  });

  registerJournalSheet();
  // Register custom JournalEntryPage data models before any other sheet
  // registration can cause Foundry to cache JournalEntryPage.TYPES.
  registerRuleSheet();
  registerRuleEnricher();
  registerRulesCompendiumSetting();
  registerClassSummarySheet();
  registerItemEmbed();
  registerNPCEmbed();
  registerPetEmbed();
  registerMarkerRenderer();
  registerPagePointerSetting();
  registerPageChangeSoundSetting();
});
