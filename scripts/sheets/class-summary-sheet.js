/**
 * FFXIV TTRPG Layout — Class Summary JournalEntryPage type.
 *
 * This is a custom JournalEntryPage subtype, not a JournalEntry sheet.
 * A Class Summary is therefore created from the Journal's "Neue Seite"
 * dialog and lives alongside normal Text/Image/PDF/Video pages.
 */

import { buildClassSummaryData, resolveJobFromUuid } from "./class-summary-data.js";
import { localize } from "../i18n.js";
import { createNativeTextDocument } from "../utils/native-text-proxy.js";

const { DocumentSheetConfig } = foundry.applications.apps;
const { JournalEntryPageHandlebarsSheet, JournalEntryPageProseMirrorSheet } = foundry.applications.sheets.journal;

const CLASS_SUMMARY_PAGE_TYPE = "ffxiv-ttrpg-layout.class-summary";

class ClassSummaryPageDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      // New multi-level Job storage. The array contains only Job Item UUIDs;
      // the Item documents remain the authoritative source for all Job data.
      jobUuids: new fields.ArrayField(
        new fields.StringField({
          required: true,
          nullable: false,
          blank: false,
          trim: true,
        }),
        {
          required: false,
          nullable: false,
          initial: () => [],
        },
      ),

      // Legacy single-Job field kept for backwards compatibility with Class
      // Summary pages created before multi-level Job storage was introduced.
      jobUuid: new fields.DocumentUUIDField({
        required: false,
        nullable: true,
        blank: true,
        initial: null,
      }),

      // UUID of the Job variant currently selected for Journal rendering.
      // The level selector in the Journal chooses this stored Job reference.
      // Keeping this as a separate reference means
      // the stored Job list and the rendered selection are cleanly decoupled.
      activeJobUuid: new fields.DocumentUUIDField({
        required: false,
        nullable: true,
        blank: true,
        initial: null,
      }),
      introduction: new fields.HTMLField({
        required: false,
        nullable: false,
        blank: true,
        initial: "",
      }),
    };
  }
}

class FFXIVClassSummarySheet extends JournalEntryPageHandlebarsSheet {
  static DEFAULT_OPTIONS = {
    classes: ["ffxiv-ttrpg-layout", "ffxiv-class-summary-page"],
    actions: {
      openEditor: FFXIVClassSummarySheet.#openEditor,
      openIntroductionEditor: FFXIVClassSummarySheet.#openIntroductionEditor,
      removeJob: FFXIVClassSummarySheet.#removeJob,
    },
    position: {
      width: 520,
      height: 430,
    },
    window: {
      resizable: true,
    },
    form: {
      submitOnChange: true,
    },
  };

  static VIEW_PARTS = {
    content: {
      template: "modules/ffxiv-ttrpg-layout/templates/sheets/class-summary-sheet.hbs",
      root: true,
    },
  };

  static EDIT_PARTS = {
    content: {
      template: "modules/ffxiv-ttrpg-layout/templates/sheets/class-summary-sheet-edit.hbs",
      root: true,
    },
  };


  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const storedJobUuids = Array.isArray(this.page?.system?.jobUuids)
      ? this.page.system.jobUuids.filter(uuid => typeof uuid === "string" && uuid.trim())
      : [];

    // Older pages contain only jobUuid. Treat it as the first entry without
    // rewriting the existing page until the user actually changes its Jobs.
    const legacyJobUuid = typeof this.page?.system?.jobUuid === "string"
      ? this.page.system.jobUuid.trim()
      : "";
    const jobUuids = storedJobUuids.length
      ? storedJobUuids
      : (legacyJobUuid ? [legacyJobUuid] : []);

    const storedActiveJobUuid = typeof this.page?.system?.activeJobUuid === "string"
      ? this.page.system.activeJobUuid.trim()
      : "";
    const activeJobUuid = storedActiveJobUuid && jobUuids.includes(storedActiveJobUuid)
      ? storedActiveJobUuid
      : (jobUuids[0] ?? null);
    const jobUuid = activeJobUuid;
    const introduction = this.page?.system?.introduction ?? "";
    const pageTitle = String(this.page?.name ?? "").trim();
    const pageTitleShow = this.page?.title?.show ?? true;
    const pageTitleLevel = Number(this.page?.title?.level ?? 1) || 1;
    const headingLevels = Object.entries(this._prepareHeadingLevels?.() ?? {}).map(([value, label]) => ({ value: Number(value), label: String(label) }));

    // Keep the category control native to JournalEntryPage. Categories belong
    // to the parent JournalEntry and are referenced by the page category id.
    const parent = this.page?.parent;
    const categories = Array.isArray(parent?.categories?.contents)
      ? [...parent.categories.contents]
        .sort((a, b) => {
          const sorter = foundry.documents.JournalEntry.sortCategories;
          return typeof sorter === "function"
            ? sorter(a, b)
            : String(a?.name ?? "").localeCompare(String(b?.name ?? ""));
        })
        .map(category => ({
          id: String(category?.id ?? ""),
          name: String(category?.name ?? "").trim(),
        }))
        .filter(category => category.id && category.name)
      : [];
    const pageCategory = String(this.page?.category ?? "").trim();
    const noCategoryLabel = localize("FFXIVTTRPGLayout.ClassSummary.NoCategory", "No Category");
    const jobsLabel = localize("FFXIVTTRPGLayout.ClassSummary.Jobs", "Jobs");
    const introductionEmptyLabel = localize(
      "FFXIVTTRPGLayout.ClassSummary.IntroductionEmpty",
      "No introduction added.",
    );
    const clickToOpenEditorLabel = localize(
      "FFXIVTTRPGLayout.ClassSummary.ClickToOpenEditor",
      "Click here to open the editor.",
    );

    const sourceItem = await resolveJobFromUuid(activeJobUuid);

    // The editor intentionally receives only the small amount of data it needs
    // to describe the selected Job. The complete Class Summary is rendered only
    // by the Journal view, never into the editor.
    const selectedJobs = (await Promise.all(
      jobUuids.map(async uuid => {
        const item = await resolveJobFromUuid(uuid);
        if (!item) return null;

        return {
          uuid: item.uuid,
          name: String(item.system?.job_name || item.name || "").trim(),
          level: Number.isFinite(Number(item.system?.level))
            ? Number(item.system.level)
            : null,
          img: String(item.img ?? "").trim(),
        };
      }),
    )).filter(Boolean);

    const selectedJob = selectedJobs[0] ?? null;

    let classSummary = null;
    let introductionHTML = "";

    if (this.isView) {
      classSummary = sourceItem ? await buildClassSummaryData(sourceItem) : null;
    }

    if (introduction) {
      introductionHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        introduction,
        {
          async: true,
          custom: true,
          documents: true,
          embeds: true,
          links: true,
          rolls: true,
          secrets: this.page?.isOwner ?? false,
          relativeTo: this.page,
        },
      );
    }

    return {
      ...context,
      page: this.page,
      classSummary,
      introduction,
      introductionHTML,
      pageTitle,
      pageTitleShow,
      pageTitleLevel,
      headingLevels,
      pageCategory,
      noCategoryLabel,
      categories,
      hasCategories: categories.length > 0,
      introductionEmptyLabel,
      clickToOpenEditorLabel,
      isUncategorized: !pageCategory,
      isJournalRender: this.parent?.constructor?.name === "FFXIVJournalSheet",
      jobUuid,
      jobUuids,
      activeJobUuid,
      selectedJobs,
      selectedJob,
      hasSelectedJobs: selectedJobs.length > 0,
      hasSource: Boolean(classSummary),
      hasSelectedJob: Boolean(selectedJob),
      isEditable: this.page?.isOwner ?? false,
    };
  }

  static async #openEditor(event) {
    event?.preventDefault?.();
    if (!this.page?.isOwner || !this.isView) return;

    // The empty-state link is part of this page-sheet instance. Change the
    // existing application's mode, then re-render it, so Foundry swaps from
    // VIEW_PARTS to EDIT_PARTS without creating another application window.
    try {
      this.options.mode = "edit";
      await this.render({ force: true });
    } catch (error) {
      console.warn("FFXIV TTRPG Layout | Could not switch Class Summary into edit mode:", error);
    }
  }

  static #openIntroductionEditor(event) {
    event?.preventDefault?.();
    if (!this.page?.isOwner) return;

    new FFXIVClassSummaryIntroductionEditor(this.page).render({ force: true });
  }

  static async #removeJob(event, target) {
    event?.preventDefault?.();
    if (!this.page?.isOwner || this.isView) return;

    const uuid = String(target?.dataset?.jobUuid ?? "").trim();
    if (!uuid) return;

    const storedJobUuids = Array.isArray(this.page?.system?.jobUuids)
      ? this.page.system.jobUuids.filter(value => typeof value === "string" && value.trim())
      : [];

    const legacyJobUuid = typeof this.page?.system?.jobUuid === "string"
      ? this.page.system.jobUuid.trim()
      : "";

    const currentJobUuids = storedJobUuids.length
      ? [...storedJobUuids]
      : (legacyJobUuid ? [legacyJobUuid] : []);

    const jobUuids = currentJobUuids.filter(value => value !== uuid);
    const storedActiveJobUuid = typeof this.page?.system?.activeJobUuid === "string"
      ? this.page.system.activeJobUuid.trim()
      : "";
    const activeJobUuid = jobUuids.includes(storedActiveJobUuid)
      ? storedActiveJobUuid
      : (jobUuids[0] ?? null);

    await this.page.update({
      system: {
        jobUuids,
        jobUuid: jobUuids[0] ?? null,
        activeJobUuid,
      },
    });
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const root = this.element;
    if (!root) return;

    root.addEventListener("dragover", this.#handleDragOver);
    root.addEventListener("dragleave", this.#handleDragLeave);
    root.addEventListener("drop", this.#handleDrop);
  }

  _onClose(options) {
    this.element?.removeEventListener("dragover", this.#handleDragOver);
    this.element?.removeEventListener("dragleave", this.#handleDragLeave);
    this.element?.removeEventListener("drop", this.#handleDrop);
    return super._onClose?.(options);
  }

  #handleDragOver = event => {
    if (!this.page?.isOwner || this.isView) return;

    const types = Array.from(event.dataTransfer?.types ?? []);
    if (!types.includes("text/plain")) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    this.element?.classList.add("ffxiv-class-summary-page--dragover");
  };

  #handleDragLeave = event => {
    if (this.isView) return;
    if (!this.element?.contains(event.relatedTarget)) {
      this.element?.classList.remove("ffxiv-class-summary-page--dragover");
    }
  };

  #handleDrop = async event => {
    if (!this.page?.isOwner || this.isView) return;

    event.preventDefault();
    event.stopPropagation();
    this.element?.classList.remove("ffxiv-class-summary-page--dragover");

    const transfer = event.dataTransfer;
    if (!transfer) return;

    // Foundry Item drags normally expose JSON in text/plain. Accept the
    // application/json variant as well so the drop remains robust across
    // Foundry drag sources.
    const raw = transfer.getData("text/plain") || transfer.getData("application/json");
    if (!raw) return;

    let dragData;
    try {
      dragData = JSON.parse(raw);
    } catch {
      return;
    }

    if (dragData?.type !== "Item" || !dragData?.uuid) return;

    const item = await fromUuid(dragData.uuid);
    if (!item || item.documentName !== "Item" || item.type !== "job") {
      ui.notifications.warn(localize("FFXIVTTRPGLayout.ClassSummary.OnlyJobAccepted", "Only Items with the type Job are accepted."));
      return;
    }

    const existingJobUuids = Array.isArray(this.page?.system?.jobUuids)
      ? this.page.system.jobUuids.filter(uuid => typeof uuid === "string" && uuid.trim())
      : [];

    // Migrate an older single-Job reference into the collection before
    // appending the newly dropped Job, without creating duplicates.
    const legacyJobUuid = typeof this.page?.system?.jobUuid === "string"
      ? this.page.system.jobUuid.trim()
      : "";
    if (!existingJobUuids.length && legacyJobUuid) {
      existingJobUuids.push(legacyJobUuid);
    }

    if (!existingJobUuids.includes(item.uuid)) {
      existingJobUuids.push(item.uuid);
    }

    const storedActiveJobUuid = typeof this.page?.system?.activeJobUuid === "string"
      ? this.page.system.activeJobUuid.trim()
      : "";
    const activeJobUuid = existingJobUuids.includes(storedActiveJobUuid)
      ? storedActiveJobUuid
      : (existingJobUuids[0] ?? null);

    await this.page.update({
      system: {
        jobUuids: [...existingJobUuids],
        jobUuid: existingJobUuids[0] ?? null,
        activeJobUuid,
      },
    });
  };

  static register() {
    Object.assign(CONFIG.JournalEntryPage.dataModels, {
      [CLASS_SUMMARY_PAGE_TYPE]: ClassSummaryPageDataModel,
    });

    DocumentSheetConfig.registerSheet(
      JournalEntryPage,
      "ffxiv-ttrpg-layout",
      FFXIVClassSummarySheet,
      {
        types: [CLASS_SUMMARY_PAGE_TYPE],
        makeDefault: true,
        label: "TYPES.JournalEntryPage.ffxiv-ttrpg-layout.class-summary",
      },
    );
  }
}

class FFXIVClassSummaryIntroductionEditor extends JournalEntryPageProseMirrorSheet {
  static DEFAULT_OPTIONS = {
    form: {
      submitOnChange: false,
      closeOnSubmit: true,
    },
    window: {
      title: localize("FFXIVTTRPGLayout.ClassSummary.Introduction", "Introduction"),
      resizable: true,
    },
    position: {
      width: 760,
      height: 560,
    },
  };

  #sourcePage;

  constructor(page, options = {}) {
    const proxy = FFXIVClassSummaryIntroductionEditor.#createNativeTextDocument(page);
    super({
      ...options,
      document: proxy,
    });
    this.#sourcePage = page;
  }

  static #createNativeTextDocument(page) {
    const introduction = String(page?.system?.introduction ?? "");

    return createNativeTextDocument(page, {
      getName: () => localize("FFXIVTTRPGLayout.ClassSummary.Introduction", "Introduction"),
      getContent: () => introduction,
      update: (target, value, operation) => target.update({
        system: {
          introduction: String(value ?? ""),
        },
      }, operation),
      updateSource: (target, value, options) => target.updateSource({
        system: {
          introduction: String(value ?? ""),
        },
      }, options),
    });
  }

  _canRender(options) {
    return Boolean(this.#sourcePage?.isOwner) && super._canRender(options);
  }

  _onAutosave(content) {
    // The native sheet normally autosaves its text field. Our native-text
    // proxy redirects that write to the Class Summary introduction field.
    this.#sourcePage?.update({
      system: {
        introduction: String(content ?? ""),
      },
    });
  }

  async _onClose(options) {
    // Never allow the temporary text representation to become a persisted
    // JournalEntryPage.text value. The proxy redirects all writes to the
    // Class Summary system.introduction field.
    return super._onClose(options);
  }
}

Hooks.on("preCreateJournalEntryPage", (page, data) => {
  if (data?.type !== CLASS_SUMMARY_PAGE_TYPE) return;

  // A newly created Class Summary must always start empty. Foundry can carry
  // forward page creation data in some Journal workflows, so explicitly reset
  // our custom fields here rather than allowing a previous Job reference to
  // leak into a new page.
  page.updateSource({
    system: {
      jobUuids: [],
      jobUuid: null,
      activeJobUuid: null,
      introduction: "",
    },
  });
});

export function registerClassSummarySheet() {
  FFXIVClassSummarySheet.register();
}

export {
  FFXIVClassSummarySheet,
  FFXIVClassSummaryIntroductionEditor,
  ClassSummaryPageDataModel,
  CLASS_SUMMARY_PAGE_TYPE,
};
