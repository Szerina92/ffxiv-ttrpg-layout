/**
 * FFXIV TTRPG Layout — JournalEntryPage Rule type.
 * Rule page data keeps Header, Key, and Content independent.
 */

import { RULE_PAGE_TYPE } from "../constants.js";
import { localize } from "../i18n.js";
import { createFieldEditor } from "../utils/field-editor.js";
import { buildPageControlsContext } from "../utils/page-sheet-context.js";

const { DocumentSheetConfig } = foundry.applications.apps;
const { JournalEntryPageHandlebarsSheet } = foundry.applications.sheets.journal;

class RulePageDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      key: new fields.StringField({ required: true, nullable: false, blank: true, initial: "" }),
      content: new fields.HTMLField({ required: false, nullable: false, blank: true, initial: "" }),
    };
  }
}

const RuleContentEditor = createFieldEditor({
  field: "content",
  getTitle: () => localize("FFXIVTTRPGLayout.Rule.RuleContent"),
  defaultOptions: {
    classes: ["ffxiv-ttrpg-layout", "ffxiv-rule-content-editor"],
    position: { width: 820, height: 620 },
    window: { resizable: true },
  },
});

class FFXIVRuleSheet extends JournalEntryPageHandlebarsSheet {
  static DEFAULT_OPTIONS = {
    classes: ["ffxiv-ttrpg-layout", "ffxiv-rule-page"],
    position: { width: 620, height: 460 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: { openContentEditor: FFXIVRuleSheet.#openContentEditor },
  };

  static VIEW_PARTS = { content: { template: "modules/ffxiv-ttrpg-layout/templates/sheets/rule-sheet.hbs", root: true } };
  static EDIT_PARTS = { content: { template: "modules/ffxiv-ttrpg-layout/templates/sheets/rule-sheet-edit.hbs", root: true } };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    return {
      ...context,
      page: this.page,
      ...buildPageControlsContext(this, localize("FFXIVTTRPGLayout.Rule.NoCategory")),
      pageName: String(this.page?.name ?? "").trim(),
      ruleKey: String(this.page?.system?.key ?? "").trim(),
      ruleContent: String(this.page?.system?.content ?? "").trim(),
      contentEmptyLabel: localize("FFXIVTTRPGLayout.Rule.RuleContentEmpty"),
      isEditable: this.page?.isOwner ?? false,
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    // Explicitly mark the sheet state so the Rule page can never display
    // its view and edit parts on top of each other. Foundry normally manages
    // this state internally, but keeping a local state class makes the custom
    // root-part rendering deterministic for this sheet.
    const root = this.element;
    if (!root) return;

    root.classList.toggle("ffxiv-rule-page--view", this.isView);
    root.classList.toggle("ffxiv-rule-page--edit", !this.isView);
  }

  static #openContentEditor(event) {
    event?.preventDefault?.();
    if (!this.page?.isOwner) return;
    new RuleContentEditor(this.page).render({ force: true });
  }

  static register() {
    Object.assign(CONFIG.JournalEntryPage.dataModels, {
      [RULE_PAGE_TYPE]: RulePageDataModel,
    });

    // Register the subtype metadata used by Foundry's page creation UI.
    CONFIG.JournalEntryPage.typeLabels ??= {};
    CONFIG.JournalEntryPage.typeIcons ??= {};
    CONFIG.JournalEntryPage.typeLabels[RULE_PAGE_TYPE] = "TYPES.JournalEntryPage.ffxiv-ttrpg-layout.rule";
    CONFIG.JournalEntryPage.typeIcons[RULE_PAGE_TYPE] = "fa-solid fa-book-open";

    DocumentSheetConfig.registerSheet(JournalEntryPage, "ffxiv-ttrpg-layout", FFXIVRuleSheet, {
      types: [RULE_PAGE_TYPE],
      makeDefault: true,
      label: "TYPES.JournalEntryPage.ffxiv-ttrpg-layout.rule",
    });
  }
}

export function registerRuleSheet() {
  FFXIVRuleSheet.register();
}
