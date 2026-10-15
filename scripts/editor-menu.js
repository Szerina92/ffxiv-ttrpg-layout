/**
 * FFXIV TTRPG Layout — "X|V" dropdown in Foundry V14's native ProseMirror toolbar.
 *
 * V14 exposes getProseMirrorMenuDropDowns specifically for adding custom
 * top-level dropdowns to the existing editor toolbar. The dropdown contains
 * the FFXIV semantic text styles, Rule references, Quest Summaries,
 * Scenario callouts and ATT/ABI links.
 */

import { localize } from "./i18n.js";
import { buildCalloutTextEditorEntries, buildScenarioEditorEntry } from "./callouts.js";
import { buildQuestSummaryHTML, openQuestSummaryEditor } from "./quest-summary.js";
import { buildRuleEditorEntry } from "./rules.js";
import { buildSubmenu } from "./utils/menu-entries.js";

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
  const applications = [...foundry.applications.instances.values()];

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

function addEditorMenu(menu, config) {
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

  /**
   * Apply an FFXIV semantic inline style to the current text selection.
   *
   * Foundry's generic inline insertion is fine for a selection contained in a
   * single text block, but wrapping a selection that spans multiple paragraphs
   * in one <span> collapses the block structure. Split multi-paragraph
   * selections into one inline operation per text block so paragraph breaks are
   * preserved. Processing from the end towards the start keeps earlier document
   * positions stable while each range is updated.
   */
  const applySemanticInsert = html => {
    const view = menu?.view;
    const state = view?.state;
    if (!state || state.selection.from === state.selection.to) return false;

    const { from, to } = state.selection;
    const ranges = [];
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (!node?.isTextblock) return;
      const blockFrom = pos + 1;
      const blockTo = pos + node.nodeSize - 1;
      const rangeFrom = Math.max(from, blockFrom);
      const rangeTo = Math.min(to, blockTo);
      if (rangeFrom < rangeTo) ranges.push({ from: rangeFrom, to: rangeTo });
    });

    if (ranges.length <= 1) return applyInsert(html, { inline: true });

    for (let index = ranges.length - 1; index >= 0; index -= 1) {
      const range = ranges[index];
      const currentState = view.state;
      const selectionType = currentState.selection?.constructor;
      const selection = selectionType?.create?.(currentState.doc, range.from, range.to);
      if (!selection) {
        console.warn("FFXIV TTRPG Layout | Unable to create a paragraph-safe text selection.");
        return false;
      }

      view.dispatch(currentState.tr.setSelection(selection));
      applyInsert(html, { inline: true });
    }

    return true;
  };

  const buildLinkEntry = (type, label, titleKey) => ({
    action: `ffxiv-link-${type}`,
    title: localize(titleKey),
    icon: `<span class="ffxiv-editor-accent ffxiv-editor-accent--${type}">${label}</span>`,
    class: `ffxiv-editor-semantic-entry ffxiv-editor-semantic-entry--${type}`,
    cmd: () => applySemanticInsert(`<span class="ffxiv-link--${type}"><selection></selection></span>`),
  });

  // Foundry V14 uses the `children` property for nested ProseMirror dropdowns.
  config.xv = {
    title: "X|V",
    cssClass: "ffxiv-editor-xv-menu",
    icon: '<span class="ffxiv-editor-xv-label">X|V</span>',
    entries: [
      buildSubmenu({
        action: "ffxiv-text-menu",
        title: localize("FFXIVTTRPGLayout.Editor.Text"),
        className: "ffxiv-editor-submenu-entry--text",
        children: buildCalloutTextEditorEntries({ menu, applyInsert, applySemanticInsert }),
      }),
      buildRuleEditorEntry({ menu }),
      buildSubmenu({
        action: "ffxiv-quest-menu",
        title: localize("FFXIVTTRPGLayout.Editor.Quest"),
        className: "ffxiv-editor-submenu-entry--quest",
        children: [
          {
            action: "ffxiv-quest-summary",
            title: localize("FFXIVTTRPGLayout.Editor.QuestSummary"),
            icon: '<span class="ffxiv-editor-accent ffxiv-editor-accent--quest">!</span>',
            class: "ffxiv-editor-semantic-entry ffxiv-editor-semantic-entry--quest",
            cmd: async () => {
              const sourcePage = await getQuestSummaryEditorPageFromMenu(menu);
              const data = await openQuestSummaryEditor({}, { sourcePage });
              if (!data) return false;
              return applyInsert(buildQuestSummaryHTML(data), { inline: false });
            },
          },
        ],
      }),
      buildScenarioEditorEntry({ menu }),
      buildSubmenu({
        action: "ffxiv-links-menu",
        title: localize("FFXIVTTRPGLayout.Editor.Links"),
        className: "ffxiv-editor-submenu-entry--links",
        children: [
          buildLinkEntry("att", "ATT", "FFXIVTTRPGLayout.Editor.AttackLink"),
          buildLinkEntry("abi", "ABI", "FFXIVTTRPGLayout.Editor.AbilityLink"),
        ],
      }),
    ],
  };
}

export function registerEditorMenu() {
  Hooks.on("getProseMirrorMenuDropDowns", addEditorMenu);
}
