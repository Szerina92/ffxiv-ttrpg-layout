/**
 * FFXIV TTRPG Layout — central module hub.
 */

import "./babele.js";
import { registerSettings } from "./settings.js";
import { registerJournalSheet } from "./sheets/journal-sheet.js";
import { registerClassSummarySheet } from "./sheets/class-summary-sheet.js";
import { registerRuleSheet } from "./sheets/rule-sheet.js";
import { registerItemEmbed } from "./embeds/item-embed.js";
import { registerAbilityEmbed } from "./embeds/ability-embed.js";
import { registerTraitEmbed } from "./embeds/trait-embed.js";
import { registerEmbed } from "./embeds/embed.js";
import { registerNPCEmbed } from "./embeds/npc-embed.js";
import { registerPetEmbed } from "./embeds/pet-embed.js";
import { registerTableEmbed } from "./embeds/table-embed.js";
import { registerChatCards } from "./embeds/chat-card.js";
import { activateAbilityTooltips } from "./embeds/ability-tooltip.js";
import { activateIconLinks } from "./utils/icon-click.js";
import { registerRules } from "./rules.js";
import { registerEditorMenu } from "./editor-menu.js";
import { registerCompendiumToc } from "./toc/toc.js";
import { registerPaperTheme } from "./paper-theme.js";
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
  // Register custom JournalEntryPage data models before any other sheet
  // registration can cause Foundry to cache JournalEntryPage.TYPES.
  registerRuleSheet();
  registerRules();
  registerClassSummarySheet();
  registerEditorMenu();
  registerCompendiumToc();
  registerPaperTheme();

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
  activateAbilityTooltips();
  activateIconLinks();
});
