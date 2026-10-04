import { buildClassSummaryData, resolveJobFromUuid } from "./class-summary-data.js";
import { localize } from "../i18n.js";
import { activateAbilityTooltips } from "../embeds/ability-tooltip.js";
import { RULE_PAGE_TYPE, buildRuleEditorEntry } from "../rules.js";
import { FFXIVJournalPagePointer, isPagePointerEnabled } from "../page-pointer.js";
import { isPageChangeSoundEnabled, playPageChangeSound } from "../page-change-sound.js";
import {
  buildQuestSummaryHTML,
  decorateQuestSummaryCards,
  openQuestSummaryEditor,
  parseQuestSummaryElement,
  replaceQuestSummaryInPage,
} from "../quest-summary.js";
import { buildCalloutTextEditorEntries, buildScenarioEditorEntry } from "../callouts.js";

/**
 * FFXIV TTRPG Layout
 * Custom Journal Entry sheet for Foundry VTT V14.
 *
 * Foundry's JournalEntry / JournalEntryPage documents remain the data source.
 * This sheet only controls their presentation.
 */

const { DocumentSheetConfig } = foundry.applications.apps;
const TextEditor = foundry.applications.ux.TextEditor.implementation;

class FFXIVJournalSheet extends foundry.applications.sheets.journal.JournalEntrySheet {
  #pagePointer = null;
  static DEFAULT_OPTIONS = {
    classes: [...(foundry.applications.sheets.journal.JournalEntrySheet.DEFAULT_OPTIONS.classes ?? []), "ffxiv-ttrpg-layout", "ffxiv-journal-sheet"],
    position: { width: 1100, height: 750 },
    window: { resizable: true },
  };

  /**
   * Foundry renders the native Journal V2 sidebar/TOC.
   * We only replace the contents of the page elements after core creates them.
   */
  static async normalizeJournalEntryEmbeds(content) {
    if (typeof content !== "string" || !content.includes("@Embed[")) return content;

    const pattern = /@Embed\[([^\]\s]+)([^\]]*)\]/g;
    const matches = [...content.matchAll(pattern)];
    if (!matches.length) return content;

    let output = content;
    for (const match of matches.reverse()) {
      const [full, uuid, options = ""] = match;
      const document = await fromUuid(uuid);
      if (!document || document.documentName !== "JournalEntry") continue;

      const pages = document.pages?.contents
        ?.slice()
        ?.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)) ?? [];
      const page = pages[0];
      if (!page) continue;

      const replacement = `@Embed[${page.uuid}${options}]`;
      const index = match.index;
      output = `${output.slice(0, index)}${replacement}${output.slice(index + full.length)}`;
    }

    return output;
  }

  static async resolveUUIDPage(uuid) {
    if (typeof uuid !== "string" || !uuid.trim()) return null;
    const page = await fromUuid(uuid.trim());
    if (!page || page.documentName !== "JournalEntryPage") return null;
    if (!["text", "image"].includes(page.type)) return null;
    return page;
  }

  static async createUUIDEmbed(uuid, { inline = true, caption = false, cite = false, classes = [] } = {}) {
    const page = await this.resolveUUIDPage(uuid);
    if (!page) return null;
    const options = [];
    if (inline) options.push("inline");
    else {
      options.push(`caption=${caption ? "true" : "false"}`);
      options.push(`cite=${cite ? "true" : "false"}`);
    }
    const classList = Array.isArray(classes)
      ? classes.filter(c => typeof c === "string" && c.trim())
      : [];
    if (classList.length) options.push(`classes=\"${classList.join(" ")}\"`);
    return `@Embed[${page.uuid}${options.length ? ` ${options.join(" ")}` : ""}]`;
  }

  async #buildPageViewData(page) {
    let activeContent = "";
    let activePageJobIcon = "";

    if (page?.type === "ffxiv-ttrpg-layout.class-summary") {
      const storedJobUuids = Array.isArray(page.system?.jobUuids)
        ? page.system.jobUuids.filter(uuid => typeof uuid === "string" && uuid.trim())
        : [];
      const legacyJobUuid = typeof page.system?.jobUuid === "string" ? page.system.jobUuid.trim() : "";
      const jobUuids = storedJobUuids.length ? storedJobUuids : (legacyJobUuid ? [legacyJobUuid] : []);
      const storedActiveJobUuid = typeof page.system?.activeJobUuid === "string" ? page.system.activeJobUuid.trim() : "";
      const activeJobUuid = storedActiveJobUuid && jobUuids.includes(storedActiveJobUuid)
        ? storedActiveJobUuid
        : (jobUuids[0] ?? null);

      const sourceItem = await resolveJobFromUuid(activeJobUuid);
      const classSummary = sourceItem ? await buildClassSummaryData(sourceItem) : null;
      activePageJobIcon = String(classSummary?.img ?? "");

      const selectedJobs = (await Promise.all(jobUuids.map(async uuid => {
        const item = await resolveJobFromUuid(uuid);
        if (!item) return null;
        return {
          uuid: item.uuid,
          name: String(item.system?.job_name ?? item.name ?? "").trim(),
          level: Number.isFinite(Number(item.system?.level)) ? Number(item.system.level) : null,
        };
      }))).filter(Boolean);

      const introduction = page.system?.introduction ?? "";
      const introductionHTML = introduction
        ? await TextEditor.enrichHTML(introduction, {
            async: true,
            custom: true,
            documents: true,
            embeds: true,
            links: true,
            rolls: true,
            secrets: this.document.isOwner,
            relativeTo: page,
          })
        : "";

      activeContent = await foundry.applications.handlebars.renderTemplate(
        "modules/ffxiv-ttrpg-layout/templates/sheets/class-summary-sheet.hbs",
        {
          classSummary,
          introductionHTML,
          isJournalRender: true,
          jobUuid: activeJobUuid,
          activeJobUuid,
          jobUuids,
          pageId: page.id,
          selectedJobs,
          hasMultipleJobs: selectedJobs.length > 1,
          hasSource: Boolean(classSummary),
          isEditable: this.isEditable,
        },
      );
    } else if (page?.type === "text") {
      const content = await FFXIVJournalSheet.normalizeJournalEntryEmbeds(page.text?.content ?? "");
      activeContent = await TextEditor.enrichHTML(content, {
        async: true,
        custom: true,
        documents: true,
        embeds: true,
        links: true,
        rolls: true,
        secrets: this.document.isOwner,
        relativeTo: page,
      });
    } else if (page?.type === RULE_PAGE_TYPE) {
      activeContent = await TextEditor.enrichHTML(String(page.system?.content ?? ""), {
        async: true,
        custom: true,
        documents: true,
        embeds: true,
        links: true,
        rolls: true,
        secrets: this.document.isOwner,
        relativeTo: page,
      });
    }

    return {
      id: page.id,
      name: page.name,
      type: page.type,
      titleShow: page.title?.show ?? true,
      titleLevel: Number(page.title?.level ?? 1) || 1,
      content: activeContent,
      src: page.src ?? "",
      jobIcon: activePageJobIcon,
      isClassSummary: page.type === "ffxiv-ttrpg-layout.class-summary",
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
      .slice()
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    const index = visiblePages.findIndex(candidate => candidate.id === page.id);

    const data = await this.#buildPageViewData(page);
    data.hasPreviousPage = index > 0;
    data.hasNextPage = index >= 0 && index < visiblePages.length - 1;
    data.isMultiple = this.isMultiple;

    const html = await foundry.applications.handlebars.renderTemplate(
      "modules/ffxiv-ttrpg-layout/templates/sheets/journal-page-view.hbs",
      data
    );

    element.classList.add("ffxiv-journal__page");
    element.replaceChildren();
    element.insertAdjacentHTML("afterbegin", html);
    decorateQuestSummaryCards(element, { editable: this.isEditable });
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    if (!this.#pagePointer) this.#pagePointer = new FFXIVJournalPagePointer(this);
    if (isPagePointerEnabled()) this.#pagePointer.attach();
    else this.#pagePointer.destroy();

    const root = this.element;
    const pagesRoot = root?.querySelector(".journal-entry-pages");
    if (pagesRoot) pagesRoot.classList.add("ffxiv-journal__native-pages");

    // The journal name is rendered by Foundry's native Journal V2 header.
    // Remove every Journal-level title presentation, but never touch the
    // native TOC/sidebar or headers belonging to an individual page.
    const journalTitle = String(this.document.name ?? "").trim();
    if (root && journalTitle) {
      // Remove any explicitly identified native Journal header.
      // V14 renders this as <header class="journal-header"><input class="title" .../></header>
      // (no longer "journal-entry-header", and the name lives in an <input>, not an h1-h6).
      for (const header of root.querySelectorAll(".journal-entry-header, .journal-header")) {
        if (header.closest(".journal-entry-sidebar")) continue;
        if (header.closest(".window-header")) continue;
        if (header.closest(".journal-entry-page")) continue;
        header.remove();
      }

      // Catch the V14 title even if core changes the header wrapper.
      const candidates = root.querySelectorAll("header, h1, h2, h3, h4, h5, h6");
      for (const candidate of candidates) {
        if (candidate.closest(".window-header, .journal-entry-sidebar, .journal-entry-page")) continue;
        if (candidate.classList.contains("ffxiv-journal__hero")) {
          candidate.remove();
          continue;
        }
        if (candidate.textContent.trim() !== journalTitle) continue;
        const wrapper = candidate.closest(".journal-entry-header");
        (wrapper ?? candidate).remove();
      }

      // Remove a previously injected FFXIV journal-level header as well.
      root.querySelectorAll(".ffxiv-journal__hero").forEach(hero => hero.remove());
    }

    activateAbilityTooltips(root);
    this.#activateContentLinkListeners();
    this.#activateItemEmbedListeners();
    this.#activateClassSummaryLevelSelector();
    this.#activateQuestSummaryListeners();
  }

  _activatePagesInView() {
    super._activatePagesInView();
    this.#pagePointer?.scheduleUpdate();
  }

  _onClose(options) {
    this.#pagePointer?.dispose();
    this.#pagePointer = null;
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

  #activateClassSummaryLevelSelector() {
    const root = this.element;
    if (!root || root.dataset.ffxivClassSummaryLevelSelectorBound === "true") return;
    root.dataset.ffxivClassSummaryLevelSelectorBound = "true";
    root.addEventListener("change", async event => {
      const selector = event.target?.closest?.("[data-ffxiv-class-summary-level]");
      if (!selector || !root.contains(selector)) return;
      const pageId = selector.dataset.pageId;
      const activeJobUuid = String(selector.value ?? "").trim();
      const page = pageId ? this.document.pages.get(pageId) : null;
      if (!page || page.type !== "ffxiv-ttrpg-layout.class-summary" || !activeJobUuid) return;
      const jobUuids = Array.isArray(page.system?.jobUuids)
        ? page.system.jobUuids.filter(uuid => typeof uuid === "string" && uuid.trim())
        : [];
      if (!jobUuids.includes(activeJobUuid) || !this.isEditable) return;
      await page.update({ system: { activeJobUuid } });
      await this.render({ force: true });
    });
  }

  #activateQuestSummaryListeners() {
    const root = this.element;
    if (!root || root.dataset.ffxivQuestSummaryEditBound === "true") return;
    root.dataset.ffxivQuestSummaryEditBound = "true";

    root.addEventListener("dblclick", async event => {
      if (!this.isEditable) return;

      const card = event.target?.closest?.(".ffxiv-quest-summary");
      if (!card || !root.contains(card)) return;

      const questId = String(card.dataset.ffxivQuestId ?? "").trim();

      const pageElement = card.closest(".journal-entry-page[data-page-id]");
      const pageId = pageElement?.dataset?.pageId;
      const page = pageId ? this.document.pages.get(pageId) : null;
      if (!page || page.type !== "text") return;

      event.preventDefault();
      event.stopPropagation();

      const data = parseQuestSummaryElement(card);
      const updated = await openQuestSummaryEditor(data, { sourcePage: page });
      if (!updated) return;

      const pageCards = [...pageElement.querySelectorAll(".ffxiv-quest-summary")];
      const cardIndex = pageCards.indexOf(card);
      const replaced = await replaceQuestSummaryInPage(page, questId, updated, { cardIndex });
      if (replaced) await this.render({ force: true });
    });
  }

  #activateItemEmbedListeners() {
    const root = this.element;
    if (!root || root.dataset.ffxivItemEmbedLinksBound === "true") return;
    root.dataset.ffxivItemEmbedLinksBound = "true";
    root.addEventListener("click", async event => {
      const icon = event.target?.closest?.("[data-ffxiv-item-uuid]");
      if (!icon || !root.contains(icon)) return;
      const uuid = icon.dataset.ffxivItemUuid;
      if (!uuid) return;
      event.preventDefault();
      event.stopPropagation();
      const item = await fromUuid(uuid);
      if (!item || item.documentName !== "Item") return;
      await item.sheet?.render({ force: true });
    });
  }

  #activateContentLinkListeners() {
    const root = this.element;
    if (!root || root.dataset.ffxivContentLinksBound === "true") return;
    root.dataset.ffxivContentLinksBound = "true";
    root.addEventListener("click", async event => {
      const link = event.target?.closest?.("a.content-link[data-uuid]");
      if (!link || !root.contains(link)) return;
      const document = await fromUuid(link.dataset.uuid);
      if (!document) return;
      if (document.documentName === "JournalEntryPage") {
        event.preventDefault();
        event.stopPropagation();
        if (document.parent?.id === this.document.id) await this.goToPage(document.id);
        else await document.parent?.sheet?.render({ force: true, pageId: document.id });
      }
    });
  }
}

Handlebars.registerHelper("eq", (a, b) => a === b);

/**
 * Add an X|V dropdown to Foundry V14's native ProseMirror toolbar.
 * The dropdown contains the FFXIV semantic text styles ATT and ABI.
 *
 * V14 exposes getProseMirrorMenuDropDowns specifically for adding custom
 * top-level dropdowns to the existing editor toolbar.
 */
async function getQuestSummaryEditorPageFromMenu(menu) {
  const editorDOM = menu?.view?.dom;
  if (!editorDOM) return null;

  // The native Foundry V14 Journal ProseMirror field carries the edited
  // JournalEntryPage UUID directly on the <prose-mirror> element. This is
  // the most reliable source because it belongs to the exact editor instance
  // which fired this menu action.
  const proseMirror = editorDOM.closest?.("prose-mirror");
  const documentUUID = String(
    proseMirror?.dataset?.documentUuid
      ?? proseMirror?.getAttribute?.("data-document-uuid")
      ?? "",
  ).trim();

  if (documentUUID) {
    try {
      const page = await fromUuid(documentUUID);
      if (page?.documentName === "JournalEntryPage") return page;
    } catch (error) {
      console.warn("FFXIV TTRPG Layout | Failed to resolve ProseMirror document UUID for Quest Summary.", error);
    }
  }

  // Fallback: find the rendered JournalEntryPageProseMirrorSheet application
  // which contains this exact editor DOM and use its public `page` accessor.
  const applications = new Set([
    ...Object.values(globalThis.ui?.windows ?? {}),
    ...(globalThis.foundry?.applications?.instances
      ? Array.from(globalThis.foundry.applications.instances.values())
      : []),
  ]);

  for (const app of applications) {
    const page = app?.page;
    if (!page || page.documentName !== "JournalEntryPage") continue;
    const root = app?.element;
    if (root?.contains?.(editorDOM)) return page;
  }

  // Fallback for our custom journal DOM if a stable data-page-id is available.
  let node = editorDOM;
  while (node) {
    const pageId = String(
      node?.dataset?.pageId
        ?? node?.getAttribute?.("data-page-id")
        ?? "",
    ).trim();
    if (pageId) {
      for (const app of applications) {
        const document = app?.document;
        const page = document?.pages?.get?.(pageId);
        if (page?.documentName === "JournalEntryPage") return page;
      }
    }
    node = node.parentElement;
  }

  return null;
}

Hooks.on("getProseMirrorMenuDropDowns", (menu, config) => {
  /**
   * Insert an HTML block/inline fragment using Foundry's native ProseMirror
   * insertion pipeline. The <selection> placeholder is replaced by the
   * current selection when present.
   */
  const applyInsert = (html, { inline = false } = {}) => {
    const state = menu?.view?.state;
    const view = menu?.view;
    if (!state || !view) return false;

    menu._placeInsert(
      state,
      view.dispatch.bind(view),
      view,
      html,
      { inline }
    );

    return true;
  };

  /** Apply an FFXIV semantic inline style to the current text selection. */
  const applySemanticInsert = html => {
    const state = menu?.view?.state;
    if (!state || state.selection.from === state.selection.to) return false;
    return applyInsert(html, { inline: true });
  };

  /*
   * Foundry V14 uses the `children` property for nested ProseMirror dropdowns.
   */
  config.xv = {
    title: "X|V",
    cssClass: "ffxiv-editor-xv-menu",
    icon: '<span class="ffxiv-editor-xv-label">X|V</span>',
    entries: [
      {
        action: "ffxiv-text-menu",
        title: localize("FFXIVTTRPGLayout.Editor.Text", "Text Editor"),
        icon: '<span class="ffxiv-editor-submenu-arrow" aria-hidden="true">▸</span>',
        class: "ffxiv-editor-submenu-entry ffxiv-editor-submenu-entry--text",
        children: [
          {
            action: "ffxiv-ability",
            title: localize("FFXIVTTRPGLayout.Editor.Ability", "Ability"),
            icon: '<span class="ffxiv-editor-accent ffxiv-editor-accent--abi">ABI</span>',
            class: "ffxiv-editor-semantic-entry ffxiv-editor-semantic-entry--abi",
            cmd: () => applySemanticInsert('<span class="ffxiv-abi"><selection></selection></span>')
          },
          {
            action: "ffxiv-attack",
            title: localize("FFXIVTTRPGLayout.Editor.Attack", "Attack"),
            icon: '<span class="ffxiv-editor-accent ffxiv-editor-accent--att">ATT</span>',
            class: "ffxiv-editor-semantic-entry ffxiv-editor-semantic-entry--att",
            cmd: () => applySemanticInsert('<span class="ffxiv-att"><selection></selection></span>')
          },
          ...buildCalloutTextEditorEntries({ menu, applyInsert, applySemanticInsert })
        ]
      },
      buildRuleEditorEntry({ menu }),
      {
        action: "ffxiv-quest-menu",
        title: localize("FFXIVTTRPGLayout.Editor.Quest", "Quest"),
        icon: '<span class="ffxiv-editor-submenu-arrow" aria-hidden="true">▸</span>',
        class: "ffxiv-editor-submenu-entry ffxiv-editor-submenu-entry--quest",
        children: [
          {
            action: "ffxiv-quest-summary",
            title: localize("FFXIVTTRPGLayout.Editor.QuestSummary", "Quest Summary"),
            icon: '<span class="ffxiv-editor-accent ffxiv-editor-accent--quest">!</span>',
            class: "ffxiv-editor-semantic-entry ffxiv-editor-semantic-entry--quest",
            cmd: async () => {
              const sourcePage = await getQuestSummaryEditorPageFromMenu(menu);
              const data = await openQuestSummaryEditor({}, { sourcePage });
              if (!data) return false;
              return applyInsert(buildQuestSummaryHTML(data), { inline: false });
            }
          }
        ]
      },
      buildScenarioEditorEntry({ menu }),
      {
        action: "ffxiv-links-menu",
        title: localize("FFXIVTTRPGLayout.Editor.Links", "Links"),
        icon: '<span class="ffxiv-editor-submenu-arrow" aria-hidden="true">▸</span>',
        class: "ffxiv-editor-submenu-entry ffxiv-editor-submenu-entry--links",
        children: [
          {
            action: "ffxiv-link-att",
            title: localize("FFXIVTTRPGLayout.Editor.AttackLink", "Attack Link"),
            icon: '<span class="ffxiv-editor-accent ffxiv-editor-accent--att">ATT</span>',
            class: "ffxiv-editor-semantic-entry ffxiv-editor-semantic-entry--att",
            cmd: () => applySemanticInsert('<span class="ffxiv-link--att"><selection></selection></span>')
          },
          {
            action: "ffxiv-link-abi",
            title: localize("FFXIVTTRPGLayout.Editor.AbilityLink", "Ability Link"),
            icon: '<span class="ffxiv-editor-accent ffxiv-editor-accent--abi">ABI</span>',
            class: "ffxiv-editor-semantic-entry ffxiv-editor-semantic-entry--abi",
            cmd: () => applySemanticInsert('<span class="ffxiv-link--abi"><selection></selection></span>')
          }
        ]
      }
    ]
  };
});

Hooks.on("updateJournalEntryPage", async (page) => {
  const parent = page?.parent;
  if (!parent?.apps) return;

  for (const app of Object.values(parent.apps)) {
    if (!(app instanceof FFXIVJournalSheet)) continue;
    if (app.pageId !== page.id) continue;
    await app.render();
  }
});

export function registerJournalSheet() {
  DocumentSheetConfig.registerSheet(
    JournalEntry,
    "ffxiv-ttrpg-layout",
    FFXIVJournalSheet,
    {
      makeDefault: true,
      label: "FFXIVTTRPGLayout.Journal.SheetTitle"
    }
  );
}

export { FFXIVJournalSheet };