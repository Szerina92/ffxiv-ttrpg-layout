/**
 * FFXIV TTRPG Layout — Table of Contents window of a Journal compendium.
 *
 * Replaces the standard compendium window for packs whose author defined a
 * ToC. Clicking an entry opens the Journal at the corresponding page.
 */

import { MODULE_ID } from "../constants.js";
import { localize } from "../i18n.js";
import { getTocEntries } from "./toc-data.js";
import { buildTocTree } from "./toc-tree.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Whether the current user may define the ToC. Locked packs are reported when saving. */
export const canEditToc = () => game.user.hasRole("ASSISTANT");

const normalizeText = text => String(text ?? "").replace(/\s+/g, " ").trim();
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Scroll an open Journal to an H2 of one of its pages. The sheet renders its
 * pages asynchronously, so the heading is awaited. This does not use the sheet's
 * own anchor navigation, which needs the table of contents of an already
 * rendered page.
 */
async function scrollToHeading(sheet, pageId, text, occurrence) {
  const target = normalizeText(text);
  const findHeading = () => {
    const pageElement = sheet.element?.querySelector(`.journal-entry-page[data-page-id="${pageId}"]`);
    const matches = [...(pageElement?.querySelectorAll(".ffxiv-journal__text h2") ?? [])]
      .filter(heading => normalizeText(heading.textContent) === target);
    return matches[occurrence] ?? null;
  };

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const heading = findHeading();
    if (heading) {
      // Let the sheet finish its own jump to the page before scrolling to the heading.
      await wait(120);
      (findHeading() ?? heading).scrollIntoView({ block: "start", behavior: "smooth" });
      return true;
    }
    await wait(50);
  }
  return false;
}

class CompendiumTocApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: [MODULE_ID, "ffxiv-compendium-toc-app"],
    position: { width: 800, height: 700 },
    window: { icon: "fa-solid fa-book-open", resizable: true },
    actions: {
      openPage: CompendiumTocApplication.#openPage,
      editToc: CompendiumTocApplication.#editToc,
      showStandardView: CompendiumTocApplication.#showStandardView,
    },
  };

  static PARTS = {
    content: {
      template: `modules/${MODULE_ID}/templates/toc/toc.hbs`,
      scrollable: [".ffxiv-compendium-toc__body"],
    },
  };

  /** Callbacks provided by the registration layer, to avoid import cycles. */
  static handlers = { editToc: null, showStandardView: null };

  /** @param {CompendiumCollection} pack */
  constructor(pack, options = {}) {
    super({
      id: CompendiumTocApplication.idFor(pack),
      window: { title: pack.title },
      ...options,
    });
    this.pack = pack;
  }

  static idFor(pack) {
    return `ffxiv-compendium-toc-${pack.collection.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  }

  /** The open ToC window of a pack, if any. */
  static of(pack) {
    const app = foundry.applications.instances.get(CompendiumTocApplication.idFor(pack));
    return app instanceof CompendiumTocApplication ? app : null;
  }

  _getHeaderControls() {
    const controls = super._getHeaderControls();
    if (canEditToc()) {
      controls.push(
        { icon: "fa-solid fa-pen-to-square", label: "FFXIVTTRPGLayout.Toc.EditToc", action: "editToc" },
        { icon: "fa-solid fa-list", label: "FFXIVTTRPGLayout.Toc.StandardView", action: "showStandardView" },
      );
    }
    return controls;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const entries = await getTocEntries(this.pack);
    const collator = new Intl.Collator(game.i18n.lang);
    const { chapters, otherGroup } = buildTocTree(entries, { collator });
    if (otherGroup) otherGroup.label = localize("FFXIVTTRPGLayout.Toc.Other");

    return {
      ...context,
      packTitle: this.pack.title,
      heading: localize("FFXIVTTRPGLayout.Toc.Title"),
      emptyLabel: localize("FFXIVTTRPGLayout.Toc.Empty"),
      isEmpty: entries.length === 0,
      chapters,
      otherGroup,
    };
  }

  static async #openPage(event, target) {
    event.preventDefault();
    event.stopPropagation();
    const { uuid, heading, occurrence } = target.dataset;
    if (!uuid) return;

    try {
      const page = await fromUuid(uuid);
      if (page?.documentName !== "JournalEntryPage") throw new Error(`Not a JournalEntryPage: ${uuid}`);
      const sheet = page.parent.sheet;
      await sheet.render({ force: true, pageId: page.id });
      if (heading) await scrollToHeading(sheet, page.id, heading, Number(occurrence) || 0);
    } catch (error) {
      console.error("FFXIV TTRPG Layout | Could not open the ToC page", uuid, error);
      ui.notifications.error(localize("FFXIVTTRPGLayout.Toc.OpenError"));
    }
  }

  static #editToc() {
    CompendiumTocApplication.handlers.editToc?.(this.pack);
  }

  static #showStandardView() {
    CompendiumTocApplication.handlers.showStandardView?.(this.pack);
  }
}

/**
 * Open (or bring to front) the ToC window of a pack.
 *
 * @param {CompendiumCollection} pack
 * @param {{left?: number, top?: number}} [position] Initial window position.
 */
export function openTocApplication(pack, position = {}) {
  const existing = CompendiumTocApplication.of(pack);
  if (existing) return existing.render({ force: true });
  return new CompendiumTocApplication(pack, { position }).render({ force: true });
}

/** Re-render the open ToC window of a pack, if there is one. */
export function refreshTocApplication(packId) {
  for (const app of foundry.applications.instances.values()) {
    if (app instanceof CompendiumTocApplication && app.pack.collection === packId) app.render();
  }
}

/** Close the open ToC window of a pack, if there is one. */
export const closeTocApplication = pack => CompendiumTocApplication.of(pack)?.close();

export function setTocApplicationHandlers(handlers) {
  Object.assign(CompendiumTocApplication.handlers, handlers);
}
