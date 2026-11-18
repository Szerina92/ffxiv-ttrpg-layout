/* Editor menu entries */

const SUBMENU_ARROW = '<span class="ffxiv-editor-submenu-arrow" aria-hidden="true">▸</span>';

export function buildSubmenu({ action, title, className, children }) {
  return {
    action,
    title,
    icon: SUBMENU_ARROW,
    class: `ffxiv-editor-submenu-entry ${className}`,
    children,
  };
}
