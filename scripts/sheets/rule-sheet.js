/**
 * FFXIV TTRPG Layout — JournalEntryPage Rule type.
 * Rule page data keeps Header, Key, and Content independent.
 */

import { RULE_PAGE_TYPE } from "../rules.js";

import { localize } from "../i18n.js";
import { createNativeTextDocument } from "../utils/native-text-proxy.js";

const { DocumentSheetConfig } = foundry.applications.apps;
const { JournalEntryPageHandlebarsSheet, JournalEntryPageProseMirrorSheet } = foundry.applications.sheets.journal;

class RulePageDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      key: new fields.StringField({ required: true, nullable: false, blank: true, initial: "" }),
      content: new fields.HTMLField({ required: false, nullable: false, blank: true, initial: "" }),
    };
  }
}

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
    const parent = this.page?.parent;
    const categories = Array.isArray(parent?.categories?.contents)
      ? [...parent.categories.contents]
        .sort((a, b) => {
          const sorter = foundry.documents.JournalEntry.sortCategories;
          return typeof sorter === "function" ? sorter(a, b) : String(a?.name ?? "").localeCompare(String(b?.name ?? ""));
        })
        .map(category => ({
          id: String(category?.id ?? ""),
          name: String(category?.name ?? "").trim(),
        }))
        .filter(category => category.id && category.name)
      : [];
    const pageCategory = String(this.page?.category ?? "").trim();
    const pageTitleShow = this.page?.title?.show ?? true;
    const pageTitleLevel = Number(this.page?.title?.level ?? 1) || 1;
    const headingLevels = Object.entries(this._prepareHeadingLevels?.() ?? {})
      .map(([value, label]) => ({ value: Number(value), label: String(label) }));
    const noCategoryLabel = localize("FFXIVTTRPGLayout.Rule.NoCategory", "No Category");

    return {
      ...context,
      page: this.page,
      pageName: String(this.page?.name ?? "").trim(),
      pageCategory,
      pageTitleShow,
      pageTitleLevel,
      headingLevels,
      noCategoryLabel,
      isUncategorized: !pageCategory,
      categories,
      hasCategories: categories.length > 0,
      ruleKey: String(this.page?.system?.key ?? "").trim(),
      ruleContent: String(this.page?.system?.content ?? "").trim(),
      contentEmptyLabel: localize("FFXIVTTRPGLayout.Rule.RuleContentEmpty", "No rule content added."),
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
    new FFXIVRuleContentEditor(this.page).render({ force: true });
  }

  static register() {
    Object.assign(CONFIG.JournalEntryPage.dataModels, {
      [RULE_PAGE_TYPE]: RulePageDataModel,
    });

    // Register the subtype metadata used by Foundry's page creation UI.
    CONFIG.JournalEntryPage.typeLabels ??= {};
    CONFIG.JournalEntryPage.typeIcons ??= {};
    CONFIG.JournalEntryPage.typeLabels[RULE_PAGE_TYPE] =
      "TYPES.JournalEntryPage.ffxiv-ttrpg-layout.rule";
    CONFIG.JournalEntryPage.typeIcons[RULE_PAGE_TYPE] = "fa-solid fa-book-open";

    DocumentSheetConfig.registerSheet(JournalEntryPage, "ffxiv-ttrpg-layout", FFXIVRuleSheet, {
      types: [RULE_PAGE_TYPE],
      makeDefault: true,
      label: "TYPES.JournalEntryPage.ffxiv-ttrpg-layout.rule",
    });
  }
}

class FFXIVRuleContentEditor extends JournalEntryPageProseMirrorSheet {
  static DEFAULT_OPTIONS = {
    classes: ["ffxiv-ttrpg-layout", "ffxiv-rule-content-editor"],
    position: { width: 820, height: 620 },
    window: { resizable: true },
  };

  #sourcePage;

  constructor(page, options = {}) {
    const proxy = FFXIVRuleContentEditor.#createNativeTextDocument(page);
    super({ ...options, document: proxy });
    this.#sourcePage = page;
  }

  static #createNativeTextDocument(page) {
    const content = String(page?.system?.content ?? "");

    return createNativeTextDocument(page, {
      getName: () => localize("FFXIVTTRPGLayout.Rule.RuleContent", "Rule Content"),
      getContent: () => content,
      update: (target, value, operation) => target.update({
        system: {
          content: String(value ?? ""),
        },
      }, operation),
      updateSource: (target, value, options) => target.updateSource({
        system: {
          content: String(value ?? ""),
        },
      }, options),
    });
  }

  _canRender(options) {
    return Boolean(this.#sourcePage?.isOwner) && super._canRender(options);
  }

  _onAutosave(content) {
    this.#sourcePage?.update({ system: { content: String(content ?? "") } });
  }
}

Hooks.on("preCreateJournalEntryPage", (page, data) => {
  if (data?.type !== RULE_PAGE_TYPE) return;

  // The Rule Key is intentionally independent from the page Header/Name.
  // New Rule pages therefore start with an empty key until the user defines it.
  page.updateSource({
    system: {
      key: String(data?.system?.key ?? "").trim(),
      content: String(data?.system?.content ?? ""),
    },
  });
});

export function registerRuleSheet() {
  FFXIVRuleSheet.register();
}

export { FFXIVRuleSheet, FFXIVRuleContentEditor, RulePageDataModel, RULE_PAGE_TYPE };
