/**
 * Create the native JournalEntryPage text-document proxy used by custom
 * ProseMirror editors.
 *
 * The helper owns only the mechanical Foundry text-page bridge. Consumers
 * remain responsible for field-specific persistence and editor lifecycle.
 *
 * @param {JournalEntryPage} page The real source JournalEntryPage.
 * @param {object} options Proxy configuration.
 * @param {() => string} options.getName Return the temporary text-page name.
 * @param {() => string} options.getContent Return the current text content.
 * @param {(target: JournalEntryPage, content: string, operation: object) => Promise<unknown>} options.update Persist a normal update.
 * @param {(target: JournalEntryPage, content: string, options: object) => void} options.updateSource Persist a source update.
 * @returns {JournalEntryPage} A JournalEntryPage-compatible native-text proxy.
 */
export function createNativeTextDocument(
  page,
  {
    getName,
    getContent,
    update,
    updateSource,
  },
) {
  const readName = typeof getName === "function" ? getName : () => String(getName ?? "");
  const readContent = typeof getContent === "function" ? getContent : () => String(getContent ?? "");

  return new Proxy(page, {
    get(target, property, receiver) {
      if (property === "type") return "text";
      if (property === "name") return readName();
      if (property === "text") {
        return {
          ...(target.text ?? {}),
          format: CONST.JOURNAL_ENTRY_PAGE_FORMATS?.HTML ?? 1,
          content: String(readContent() ?? ""),
        };
      }

      if (property === "update") {
        return async (data = {}, operation = {}) => {
          const content = data?.text?.content
            ?? data?.["text.content"]
            ?? readContent();
          return update(target, String(content ?? ""), operation);
        };
      }

      if (property === "updateSource") {
        return (changes = {}, options = {}) => {
          const content = changes?.text?.content
            ?? changes?.["text.content"];
          if (content !== undefined) {
            updateSource(target, String(content ?? ""), options);
          }
          return target;
        };
      }

      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
