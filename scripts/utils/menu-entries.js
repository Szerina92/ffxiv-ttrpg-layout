/** FFXIV TTRPG Layout — building blocks for the custom ProseMirror menu. */

const SUBMENU_ARROW = '<span class="ffxiv-editor-submenu-arrow" aria-hidden="true">▸</span>';

/**
 * A nested ProseMirror dropdown entry.
 *
 * @param {object} config
 * @param {string} config.action Unique action id.
 * @param {string} config.title Localized title.
 * @param {string} config.className Modifier class, for example `ffxiv-editor-submenu-entry--text`.
 * @param {object[]} config.children Nested menu entries.
 */
export function buildSubmenu({ action, title, className, children }) {
  return {
    action,
    title,
    icon: SUBMENU_ARROW,
    class: `ffxiv-editor-submenu-entry ${className}`,
    children,
  };
}
