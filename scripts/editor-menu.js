/* X|V editor menu */

import { localize } from "./i18n.js";
import { buildCalloutTextEditorEntries, buildScenarioEditorEntry } from "./callouts.js";
import { buildQuestSummaryHTML, openQuestSummaryEditor } from "./quest-summary.js";
import { buildSubmenu } from "./utils/menu-entries.js";

async function getQuestSummaryEditorPageFromMenu(menu) {
  const editorDOM = menu?.view?.dom;
  if (!editorDOM) return null;

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

  const applications = [...foundry.applications.instances.values()];

  for (const app of applications) {
    const page = app?.page;
    if (!page || page.documentName !== "JournalEntryPage") continue;
    const root = app?.element;
    if (root?.contains?.(editorDOM)) return page;
  }

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
          {
            action: "ffxiv-nolink",
            title: localize("FFXIVTTRPGLayout.Editor.NoLink"),
            icon: '<span class="ffxiv-editor-accent ffxiv-editor-accent--nolink">NO</span>',
            class: "ffxiv-editor-semantic-entry ffxiv-editor-semantic-entry--nolink",
            cmd: () => applySemanticInsert('<span class="ffxiv-nolink"><selection></selection></span>'),
          },
        ],
      }),
    ],
  };
}

export function registerEditorMenu() {
  Hooks.on("getProseMirrorMenuDropDowns", addEditorMenu);
}
