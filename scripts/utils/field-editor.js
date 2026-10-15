/** FFXIV TTRPG Layout — ProseMirror editor window for a single page data field. */

import { createNativeTextDocument } from "./native-text-proxy.js";

/**
 * Create a ProseMirror editor sheet that edits one HTML field of a custom
 * JournalEntryPage subtype (for example `system.content`) in a separate window.
 *
 * The editor works on a temporary text-page proxy; all writes are redirected
 * to `system.<field>`, so the proxy never becomes a persisted `text.content`.
 *
 * @param {object} config
 * @param {string} config.field Name of the HTML field inside `page.system`.
 * @param {() => string} config.getTitle Localized window title.
 * @param {object} config.defaultOptions ApplicationV2 DEFAULT_OPTIONS of the editor.
 * @returns {typeof foundry.applications.sheets.journal.JournalEntryPageProseMirrorSheet}
 */
export function createFieldEditor({ field, getTitle, defaultOptions }) {
  const { JournalEntryPageProseMirrorSheet } = foundry.applications.sheets.journal;
  const toSystemUpdate = value => ({ system: { [field]: String(value ?? "") } });

  return class FFXIVFieldEditor extends JournalEntryPageProseMirrorSheet {
    static DEFAULT_OPTIONS = defaultOptions;

    #sourcePage;

    constructor(page, options = {}) {
      const content = String(page?.system?.[field] ?? "");
      const proxy = createNativeTextDocument(page, {
        getName: getTitle,
        getContent: () => content,
        update: (target, value, operation) => target.update(toSystemUpdate(value), operation),
        updateSource: (target, value, updateOptions) => target.updateSource(toSystemUpdate(value), updateOptions),
      });

      super({ ...options, window: { title: getTitle(), ...options.window }, document: proxy });
      this.#sourcePage = page;
    }

    _canRender(options) {
      return Boolean(this.#sourcePage?.isOwner) && super._canRender(options);
    }

    _onAutosave(content) {
      this.#sourcePage?.update(toSystemUpdate(content));
    }
  };
}
