/* Field editor */

import { createNativeTextDocument } from "./native-text-proxy.js";

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
