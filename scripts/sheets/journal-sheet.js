/**
 * FFXIV TTRPG Layout
 * Custom Journal Entry sheet for Foundry VTT V14.
 *
 * Foundry's JournalEntry / JournalEntryPage documents remain the data source.
 * This sheet only controls their presentation.
 */

import { CLASS_SUMMARY_PAGE_TYPE, RULE_PAGE_TYPE } from "../constants.js";
import { activateAbilityTooltips } from "../embeds/ability-tooltip.js";
import { playPageChangeSound } from "../page-change-sound.js";
import { FFXIVJournalPagePointer } from "../page-pointer.js";
import {
  decorateQuestSummaryCards,
  openQuestSummaryEditor,
  parseQuestSummaryElement,
  replaceQuestSummaryInPage,
} from "../quest-summary.js";
import { isPageChangeSoundEnabled } from "../settings.js";
import { enrich } from "../utils/enrich.js";
import { bindPageFrame } from "../utils/page-frame.js";
import { buildClassSummaryPageContext } from "./class-summary-data.js";

const { DocumentSheetConfig } = foundry.applications.apps;
const { JournalEntrySheet } = foundry.applications.sheets.journal;

const TEMPLATE_PATH = "modules/ffxiv-ttrpg-layout/templates/sheets";

/**
 * Replace `@Embed[<JournalEntry uuid>]` by an embed of that Journal's first page,
 * because Foundry can only embed pages, not whole Journal Entries.
 */
async function normalizeJournalEntryEmbeds(content) {
  if (typeof content !== "string" || !content.includes("@Embed[")) return content;

  const matches = [...content.matchAll(/@Embed\[([^\]\s]+)([^\]]*)\]/g)];

  let output = content;
  for (const match of matches.reverse()) {
    const [full, uuid, options = ""] = match;
    const journal = await fromUuid(uuid);
    if (!journal || journal.documentName !== "JournalEntry") continue;

    const [firstPage] = journal.pages?.contents?.slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)) ?? [];
    if (!firstPage) continue;

    const replacement = `@Embed[${firstPage.uuid}${options}]`;
    output = `${output.slice(0, match.index)}${replacement}${output.slice(match.index + full.length)}`;
  }

  return output;
}

class FFXIVJournalSheet extends JournalEntrySheet {
  #pagePointer = null;
  #disposePageFrame = null;
  #pageFrameScroller = null;

  static DEFAULT_OPTIONS = {
    classes: [...(JournalEntrySheet.DEFAULT_OPTIONS.classes ?? []), "ffxiv-ttrpg-layout", "ffxiv-journal-sheet"],
    position: { width: 1100, height: 750 },
    window: { resizable: true },
  };

  /** Prepare the data of one page for journal-page-view.hbs. */
  async #buildPageViewData(page) {
    let content = "";
    let jobIcon = "";

    switch (page.type) {
      case CLASS_SUMMARY_PAGE_TYPE: {
        const context = await buildClassSummaryPageContext(page);
        jobIcon = String(context.classSummary?.img ?? "");
        content = await foundry.applications.handlebars.renderTemplate(
          `${TEMPLATE_PATH}/class-summary-sheet.hbs`,
          { ...context, isJournalRender: true, isEditable: this.isEditable },
        );
        break;
      }
      case "text":
        content = await enrich(await normalizeJournalEntryEmbeds(page.text?.content ?? ""), page);
        break;
      case RULE_PAGE_TYPE:
        content = await enrich(page.system?.content, page);
        break;
    }

    return {
      id: page.id,
      name: page.name,
      type: page.type,
      titleShow: page.title?.show ?? true,
      titleLevel: Number(page.title?.level ?? 1) || 1,
      content,
      src: page.src ?? "",
      jobIcon,
      isClassSummary: page.type === CLASS_SUMMARY_PAGE_TYPE,
      isRule: page.type === RULE_PAGE_TYPE,
      isText: page.type === "text",
      isImage: page.type === "image",
      isVideo: page.type === "video",
      isEditable: this.isEditable,
    };
  }

  async _renderPageView(element, sheet) {
    const page = sheet?.document;
    if (!page || !element) return;

    const visiblePages = this.document.pages.contents
      .filter(candidate => this.isPageVisible(candidate))
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    const index = visiblePages.findIndex(candidate => candidate.id === page.id);

    const data = await this.#buildPageViewData(page);
    data.hasPreviousPage = index > 0;
    data.hasNextPage = index >= 0 && index < visiblePages.length - 1;
    data.isMultiple = this.isMultiple;

    const html = await foundry.applications.handlebars.renderTemplate(`${TEMPLATE_PATH}/journal-page-view.hbs`, data);

    element.classList.add("ffxiv-journal__page");
    element.replaceChildren();
    element.insertAdjacentHTML("afterbegin", html);
    decorateQuestSummaryCards(element, { editable: this.isEditable });
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    this.#pagePointer ??= new FFXIVJournalPagePointer(this);
    this.#pagePointer.sync();

    // The native Journal header is hidden by CSS (journal-sheet.css).
    const scroller = this.element?.querySelector(".journal-entry-pages");
    scroller?.classList.add("ffxiv-journal__native-pages");
    this.#bindPageFrame(scroller);

    activateAbilityTooltips(this.element);
    this.#bindDelegatedListeners();
  }

  /** Bind the page frame once per scroll container. */
  #bindPageFrame(scroller) {
    if (!scroller || scroller === this.#pageFrameScroller) return;
    this.#disposePageFrame?.();
    this.#pageFrameScroller = scroller;
    this.#disposePageFrame = bindPageFrame(scroller);
  }

  _activatePagesInView() {
    super._activatePagesInView();
    this.#pagePointer?.scheduleUpdate();
  }

  _onClose(options) {
    this.#pagePointer?.dispose();
    this.#pagePointer = null;
    this.#disposePageFrame?.();
    this.#disposePageFrame = null;
    this.#pageFrameScroller = null;
    return super._onClose(options);
  }

  async _showPage(pageId) {
    if (!this.document.pages.get(pageId)) return;
    await this.goToPage(pageId);
  }

  /**
   * Play the optional page-change confirmation sound at the actual page
   * transition boundary used by Foundry's JournalEntrySheet. This catches the
   * native V14 TOC navigation, regardless of the sidebar DOM implementation.
   */
  goToPage(pageId, options = {}) {
    const targetPageId = String(pageId ?? "").trim();
    const currentPageId = String(this.pageId ?? "").trim();

    if (isPageChangeSoundEnabled() && targetPageId && targetPageId !== currentPageId) {
      playPageChangeSound();
    }

    return super.goToPage(pageId, options);
  }

  /* -------------------------------------------- */
  /*  Delegated listeners                         */
  /* -------------------------------------------- */

  /** All interactive elements inside the rendered pages are handled by three delegated listeners. */
  #bindDelegatedListeners() {
    const root = this.element;
    if (!root || root.dataset.ffxivListenersBound === "true") return;
    root.dataset.ffxivListenersBound = "true";

    root.addEventListener("click", event => {
      this.#onItemIconClick(event);
      this.#onContentLinkClick(event);
    });
    root.addEventListener("change", event => this.#onClassSummaryLevelChange(event));
    root.addEventListener("dblclick", event => this.#onQuestSummaryDoubleClick(event));
  }

  /** Match an element inside this sheet's root. */
  #closest(event, selector) {
    const match = event.target?.closest?.(selector);
    return match && this.element?.contains(match) ? match : null;
  }

  async #onItemIconClick(event) {
    const icon = this.#closest(event, "[data-ffxiv-item-uuid]");
    const uuid = icon?.dataset.ffxivItemUuid;
    if (!uuid) return;

    event.preventDefault();
    event.stopPropagation();
    const item = await fromUuid(uuid);
    if (item?.documentName === "Item") await item.sheet?.render({ force: true });
  }

  async #onContentLinkClick(event) {
    const link = this.#closest(event, "a.content-link[data-uuid]");
    if (!link) return;

    const target = await fromUuid(link.dataset.uuid);
    if (target?.documentName !== "JournalEntryPage") return;

    event.preventDefault();
    event.stopPropagation();
    if (target.parent?.id === this.document.id) await this.goToPage(target.id);
    else await target.parent?.sheet?.render({ force: true, pageId: target.id });
  }

  async #onClassSummaryLevelChange(event) {
    const selector = this.#closest(event, "[data-ffxiv-class-summary-level]");
    if (!selector || !this.isEditable) return;

    const activeJobUuid = String(selector.value ?? "").trim();
    const page = this.document.pages.get(selector.dataset.pageId);
    if (page?.type !== CLASS_SUMMARY_PAGE_TYPE || !page.system.jobUuids.includes(activeJobUuid)) return;

    await page.update({ system: { activeJobUuid } });
    await this.render({ force: true });
  }

  async #onQuestSummaryDoubleClick(event) {
    if (!this.isEditable) return;

    const card = this.#closest(event, ".ffxiv-quest-summary");
    if (!card) return;

    const pageElement = card.closest(".journal-entry-page[data-page-id]");
    const page = this.document.pages.get(pageElement?.dataset.pageId);
    if (page?.type !== "text") return;

    event.preventDefault();
    event.stopPropagation();

    const updated = await openQuestSummaryEditor(parseQuestSummaryElement(card), { sourcePage: page });
    if (!updated) return;

    const questId = String(card.dataset.ffxivQuestId ?? "").trim();
    const cardIndex = [...pageElement.querySelectorAll(".ffxiv-quest-summary")].indexOf(card);
    const replaced = await replaceQuestSummaryInPage(page, questId, updated, { cardIndex });
    if (replaced) await this.render({ force: true });
  }
}

export function registerJournalSheet() {
  DocumentSheetConfig.registerSheet(JournalEntry, "ffxiv-ttrpg-layout", FFXIVJournalSheet, {
    makeDefault: true,
    label: "FFXIVTTRPGLayout.Journal.SheetTitle",
  });

  // Re-render the open Journal when the page it currently shows changes.
  Hooks.on("updateJournalEntryPage", async page => {
    for (const app of Object.values(page?.parent?.apps ?? {})) {
      if (app instanceof FFXIVJournalSheet && app.pageId === page.id) await app.render();
    }
  });
}
