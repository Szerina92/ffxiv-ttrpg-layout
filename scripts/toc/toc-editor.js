/**
 * FFXIV TTRPG Layout — Table of Contents editor.
 *
 * Lets the author decide which pages of a Journal compendium appear in the
 * ToC and in which role (chapter, subchapter, entry). The result is stored as
 * a flag on each Journal page, so it ships with the compendium.
 */

import { MODULE_ID } from "../constants.js";
import { localize } from "../i18n.js";
import { TOC_FLAG_KEY, getPackPages, invalidateTocData, readTocFlag } from "./toc-data.js";
import { HEADING_HOST_TYPES, TOC_TYPES, allowedParentTypes, resolveParents } from "./toc-tree.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class TocEditorApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: [MODULE_ID, "ffxiv-toc-editor"],
    position: { width: 900, height: 680 },
    window: { icon: "fa-solid fa-list-tree", resizable: true },
    form: {
      handler: TocEditorApplication.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: false,
    },
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/toc/toc-editor.hbs`,
      scrollable: [".ffxiv-toc-editor__body"],
    },
  };

  /** @param {CompendiumCollection} pack */
  constructor(pack, options = {}) {
    super({
      id: `ffxiv-toc-editor-${pack.collection.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
      window: { title: game.i18n.format("FFXIVTTRPGLayout.Toc.EditorTitle", { pack: pack.title }) },
      ...options,
    });
    this.pack = pack;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const pages = await getPackPages(this.pack);

    const rows = pages.map((page, index) => {
      const flag = readTocFlag(page);
      return {
        index,
        uuid: page.uuid,
        journalName: page.parent.name,
        pageName: page.name,
        type: flag?.type ?? "",
        parent: flag?.parent ?? "",
        label: flag?.label ?? "",
        order: flag?.order ?? "",
        headings: flag?.headings ?? false,
        isText: page.type === "text",
      };
    });

    return {
      ...context,
      rows,
      isLocked: this.pack.locked,
      lockedLabel: localize("FFXIVTTRPGLayout.Toc.Locked"),
      hint: localize("FFXIVTTRPGLayout.Toc.EditorHint"),
      types: [
        { value: "", label: localize("FFXIVTTRPGLayout.Toc.RoleNone") },
        ...TOC_TYPES.map(type => ({ value: type, label: localize(`FFXIVTTRPGLayout.Toc.Role.${type}`) })),
      ],
      noParentLabel: localize("FFXIVTTRPGLayout.Toc.NoParent"),
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    // Parent choices depend on the roles selected in the form, so they are rebuilt live.
    this.element.querySelectorAll("select[data-role-select]").forEach(select => {
      select.addEventListener("change", () => {
        this.#refreshParentOptions();
        this.#refreshHeadingToggles();
      });
    });
    this.#refreshParentOptions(context.rows);
    this.#refreshHeadingToggles();
  }

  /** The H2 option only applies to chapters and subchapters on text pages. */
  #refreshHeadingToggles() {
    for (const row of this.element.querySelectorAll("tr[data-uuid]")) {
      const toggle = row.querySelector("input[data-headings-toggle]");
      const type = row.querySelector("select[data-role-select]").value;
      toggle.disabled = row.dataset.isText !== "true" || !HEADING_HOST_TYPES.includes(type);
    }
  }

  /** Rebuild each parent select from the roles currently chosen in the form. */
  #refreshParentOptions(initialRows = null) {
    const rows = [...this.element.querySelectorAll("tr[data-uuid]")];
    const current = rows.map(row => ({
      row,
      uuid: row.dataset.uuid,
      type: row.querySelector("select[data-role-select]").value,
      label: row.querySelector("input[data-label-input]").value.trim() || row.dataset.pageName,
    }));
    const noParentLabel = localize("FFXIVTTRPGLayout.Toc.NoParent");

    for (const { row, uuid, type } of current) {
      const parentSelect = row.querySelector("select[data-parent-select]");
      const selected = initialRows
        ? initialRows.find(item => item.uuid === uuid)?.parent ?? ""
        : parentSelect.value;
      const allowed = allowedParentTypes(type);

      parentSelect.replaceChildren(new Option(noParentLabel, ""));
      for (const candidate of current) {
        if (candidate.uuid === uuid || !allowed.includes(candidate.type)) continue;
        parentSelect.append(new Option(candidate.label, candidate.uuid, false, candidate.uuid === selected));
      }
      parentSelect.disabled = allowed.length === 0 || type === "";
    }
  }

  static async #onSubmit(event, form, formData) {
    if (this.pack.locked) {
      ui.notifications.warn(localize("FFXIVTTRPGLayout.Toc.Locked"));
      return;
    }

    const submitted = Object.values(foundry.utils.expandObject(formData.object).rows ?? {});
    const entries = resolveParents(
      submitted.filter(row => TOC_TYPES.includes(row.type)).map(row => ({ uuid: row.uuid, type: row.type, parent: row.parent || null })),
    );
    const parentByUuid = new Map(entries.map(entry => [entry.uuid, entry.parent]));

    const updatesByJournal = new Map();
    for (const row of submitted) {
      const page = await fromUuid(row.uuid);
      if (!page) continue;

      const order = row.order === "" ? null : Number(row.order);
      const next = TOC_TYPES.includes(row.type)
        ? {
            type: row.type,
            parent: parentByUuid.get(row.uuid) ?? null,
            label: String(row.label ?? "").trim(),
            order: Number.isFinite(order) ? order : null,
            headings: Boolean(row.headings) && HEADING_HOST_TYPES.includes(row.type) && page.type === "text",
          }
        : null;

      if (JSON.stringify(next) === JSON.stringify(readTocFlag(page))) continue;

      const update = { _id: page.id };
      if (next) update[`flags.${MODULE_ID}.${TOC_FLAG_KEY}`] = next;
      else update[`flags.${MODULE_ID}.-=${TOC_FLAG_KEY}`] = null;

      if (!updatesByJournal.has(page.parent)) updatesByJournal.set(page.parent, []);
      updatesByJournal.get(page.parent).push(update);
    }

    try {
      for (const [journal, updates] of updatesByJournal) {
        await journal.updateEmbeddedDocuments("JournalEntryPage", updates);
      }
    } catch (error) {
      console.error("FFXIV TTRPG Layout | Could not save the ToC", error);
      ui.notifications.error(localize("FFXIVTTRPGLayout.Toc.SaveError"));
      return;
    }

    invalidateTocData(this.pack.collection);
    ui.notifications.info(localize("FFXIVTTRPGLayout.Toc.Saved"));
    await this.close();
  }
}

export function openTocEditor(pack) {
  return new TocEditorApplication(pack).render({ force: true });
}
