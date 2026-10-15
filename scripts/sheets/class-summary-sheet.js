/**
 * FFXIV TTRPG Layout — Class Summary JournalEntryPage type.
 *
 * This is a custom JournalEntryPage subtype, not a JournalEntry sheet.
 * A Class Summary is therefore created from the Journal's "Neue Seite"
 * dialog and lives alongside normal Text/Image/PDF/Video pages.
 */

import { CLASS_SUMMARY_PAGE_TYPE } from "../constants.js";
import { localize } from "../i18n.js";
import { createFieldEditor } from "../utils/field-editor.js";
import { buildPageControlsContext } from "../utils/page-sheet-context.js";
import { buildClassSummaryPageContext } from "./class-summary-data.js";

const { DocumentSheetConfig } = foundry.applications.apps;
const { JournalEntryPageHandlebarsSheet } = foundry.applications.sheets.journal;

class ClassSummaryPageDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      // Job Item UUIDs only; the Item documents remain the authoritative
      // source for all Job data.
      jobUuids: new fields.ArrayField(
        new fields.StringField({ required: true, nullable: false, blank: false, trim: true }),
        { required: false, nullable: false, initial: () => [] },
      ),

      // UUID of the Job variant currently selected for Journal rendering.
      // Use `currentJobUuid` to read the effective selection.
      activeJobUuid: new fields.DocumentUUIDField({
        required: false,
        nullable: true,
        blank: true,
        initial: null,
      }),

      introduction: new fields.HTMLField({ required: false, nullable: false, blank: true, initial: "" }),
    };
  }

  /** Pages created before multi-level Job storage only contain `jobUuid`. */
  static migrateData(source) {
    if (source.jobUuid && !source.jobUuids?.length) source.jobUuids = [source.jobUuid];
    return super.migrateData(source);
  }

  /** The selected Job, falling back to the first stored Job. */
  get currentJobUuid() {
    return this.jobUuids.includes(this.activeJobUuid) ? this.activeJobUuid : (this.jobUuids[0] ?? null);
  }
}

const IntroductionEditor = createFieldEditor({
  field: "introduction",
  getTitle: () => localize("FFXIVTTRPGLayout.ClassSummary.Introduction"),
  defaultOptions: {
    form: { submitOnChange: false, closeOnSubmit: true },
    window: { resizable: true },
    position: { width: 760, height: 560 },
  },
});

class FFXIVClassSummarySheet extends JournalEntryPageHandlebarsSheet {
  static DEFAULT_OPTIONS = {
    classes: ["ffxiv-ttrpg-layout", "ffxiv-class-summary-page"],
    actions: {
      openEditor: FFXIVClassSummarySheet.#openEditor,
      openIntroductionEditor: FFXIVClassSummarySheet.#openIntroductionEditor,
      removeJob: FFXIVClassSummarySheet.#removeJob,
    },
    position: { width: 520, height: 430 },
    window: { resizable: true },
    form: { submitOnChange: true },
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

    // The complete Class Summary is only rendered in view mode; the editor
    // receives just the Job list.
    const pageContext = await buildClassSummaryPageContext(this.page, { includeSummary: this.isView });

    return {
      ...context,
      page: this.page,
      ...pageContext,
      ...buildPageControlsContext(this, localize("FFXIVTTRPGLayout.ClassSummary.NoCategory")),
      pageTitle: String(this.page?.name ?? "").trim(),
      jobsLabel: localize("FFXIVTTRPGLayout.ClassSummary.Jobs"),
      introductionEmptyLabel: localize("FFXIVTTRPGLayout.ClassSummary.IntroductionEmpty"),
      clickToOpenEditorLabel: localize("FFXIVTTRPGLayout.ClassSummary.ClickToOpenEditor"),
      isJournalRender: Boolean(this.parent?.options?.classes?.includes("ffxiv-journal-sheet")),
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

    new IntroductionEditor(this.page).render({ force: true });
  }

  static async #removeJob(event, target) {
    event?.preventDefault?.();
    if (!this.page?.isOwner || this.isView) return;

    const uuid = String(target?.dataset?.jobUuid ?? "").trim();
    if (!uuid) return;

    const { jobUuids, activeJobUuid } = this.page.system;
    await this.page.update({
      system: {
        jobUuids: jobUuids.filter(value => value !== uuid),
        ...(activeJobUuid === uuid && { activeJobUuid: null }),
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
      ui.notifications.warn(localize("FFXIVTTRPGLayout.ClassSummary.OnlyJobAccepted"));
      return;
    }

    const { jobUuids } = this.page.system;
    if (jobUuids.includes(item.uuid)) return;
    await this.page.update({ system: { jobUuids: [...jobUuids, item.uuid] } });
  };

  static register() {
    Object.assign(CONFIG.JournalEntryPage.dataModels, {
      [CLASS_SUMMARY_PAGE_TYPE]: ClassSummaryPageDataModel,
    });

    DocumentSheetConfig.registerSheet(JournalEntryPage, "ffxiv-ttrpg-layout", FFXIVClassSummarySheet, {
      types: [CLASS_SUMMARY_PAGE_TYPE],
      makeDefault: true,
      label: "TYPES.JournalEntryPage.ffxiv-ttrpg-layout.class-summary",
    });
  }
}

export function registerClassSummarySheet() {
  FFXIVClassSummarySheet.register();

  // A newly created Class Summary must always start empty. Foundry can carry
  // forward page creation data in some Journal workflows, so explicitly reset
  // our custom fields here rather than allowing a previous Job reference to
  // leak into a new page.
  Hooks.on("preCreateJournalEntryPage", (page, data) => {
    if (data?.type !== CLASS_SUMMARY_PAGE_TYPE) return;
    page.updateSource({ system: { jobUuids: [], activeJobUuid: null, introduction: "" } });
  });
}
