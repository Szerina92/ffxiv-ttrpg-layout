import { localize } from "./i18n.js";

const TEXT_HEADER_COLORS = Object.freeze({
  "dark-blue": {
    key: "DarkBlue",
    variable: "--ffxiv-text-header-dark-blue",
  },
  red: {
    key: "Red",
    variable: "--ffxiv-text-header-red",
  },
  green: {
    key: "Green",
    variable: "--ffxiv-text-header-green",
  },
});

const TEXT_COLORS = Object.freeze({
  important: {
    key: "Important",
    className: "ffxiv-important",
    variable: "--ffxiv-text-important",
  },
  note: {
    key: "Note",
    className: "ffxiv-note",
    variable: "--ffxiv-text-note",
  },
  example: {
    key: "Example",
    className: "ffxiv-text-example",
    variable: "--ffxiv-text-example",
  },
});

const CALLOUT_BACKGROUNDS = Object.freeze({
  "light-blue": {
    key: "LightBlue",
    className: "ffxiv-callout--background-light-blue",
  },
  white: {
    key: "White",
    className: "ffxiv-callout--background-white",
  },
  paperscroll: {
    key: "Paperscroll",
    className: "ffxiv-callout--background-paperscroll",
  },
  green: {
    key: "Green",
    className: "ffxiv-callout--background-green",
  },
});

const CALLOUT_ICONS = Object.freeze({
  none: {
    key: "IconNone",
    className: null,
  },
  gm: {
    key: "GM",
    className: "ffxiv-callout--icon-gm",
  },
});

const isElement = node => node?.nodeType === Node.ELEMENT_NODE;

function closestElement(node, selector) {
  let current = isElement(node) ? node : node?.parentElement;
  while (current) {
    if (current.matches?.(selector)) return current;
    current = current.parentElement;
  }
  return null;
}

function findCalloutAtPosition(view, position) {
  if (!view?.dom || !Number.isFinite(position)) return null;
  try {
    const dom = view.domAtPos(position, 0)?.node;
    return closestElement(dom, '[data-ffxiv-callout="true"], .ffxiv-callout[data-ffxiv-callout]');
  } catch {
    return null;
  }
}

export function findSelectedCallout(view) {
  const selection = view?.state?.selection;
  if (!selection) return null;

  const from = Number(selection.from);
  const to = Number(selection.to);
  const start = findCalloutAtPosition(view, from);
  const end = findCalloutAtPosition(view, Math.max(from, to - 1));

  if (start && end && start === end) return start;
  if (start && !end && from === to) return start;
  return null;
}

function removeClassesWithPrefix(element, prefix) {
  for (const className of Array.from(element.classList)) {
    if (className.startsWith(prefix)) element.classList.remove(className);
  }
}

function replaceCallout(menu, callout, mutate) {
  const view = menu?.view;
  if (!view?.state || !callout?.parentNode || typeof menu?._placeInsert !== "function") return false;

  const parent = callout.parentNode;
  const index = Array.prototype.indexOf.call(parent.childNodes, callout);
  if (index < 0) return false;

  let from;
  let to;
  try {
    from = view.posAtDOM(parent, index);
    to = view.posAtDOM(parent, index + 1);
  } catch (error) {
    console.warn("FFXIV TTRPG Layout | Failed to map Callout DOM range to ProseMirror positions.", error);
    return false;
  }

  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) return false;

  const replacement = callout.cloneNode(true);
  mutate(replacement);

  try {
    // Do not use EditorView#pasteHTML here. In Foundry V14 that method runs
    // through the paste pipeline, including ProseMirrorImagePlugin, which
    // expects a real ClipboardEvent and therefore can receive a null
    // clipboard.files value when called programmatically.
    //
    // Delete the existing block with a normal transaction first. ProseMirror
    // then maps the active selection to a valid insertion point. Foundry's
    // native menu insertion path can safely parse and insert the replacement
    // HTML without invoking the paste-event plugins.
    view.dispatch(view.state.tr.delete(from, to));

    const nextState = view.state;
    menu._placeInsert(
      nextState,
      view.dispatch.bind(view),
      view,
      replacement.outerHTML,
      { inline: false },
    );

    view.focus();
    return true;
  } catch (error) {
    console.warn("FFXIV TTRPG Layout | Failed to update Callout.", error);
    return false;
  }
}

function applyHeaderColor(colorKey, applySemanticInsert) {
  const color = TEXT_HEADER_COLORS[colorKey];
  if (!color || typeof applySemanticInsert !== "function") return false;

  // "Header Colour" is an inline text-formatting tool, not a callout-header
  // selector. The marked text receives the same typography used by FFXIV H3
  // headings, with the selected header colour applied to that text only.
  return applySemanticInsert(
    `<span class="ffxiv-text-header ffxiv-text-header--${colorKey}"><selection></selection></span>`
  );
}

function applyBackground(menu, backgroundKey, applyInsert) {
  const background = CALLOUT_BACKGROUNDS[backgroundKey];
  if (!background) return false;

  const callout = findSelectedCallout(menu?.view);
  if (callout) {
    return replaceCallout(menu, callout, replacement => {
      removeClassesWithPrefix(replacement, "ffxiv-callout--background-");
      replacement.classList.add(background.className);
      replacement.dataset.ffxivCalloutBackground = backgroundKey;
    });
  }

  const state = menu?.view?.state;
  if (!state || state.selection.from === state.selection.to) return false;

  applyInsert(
    `<div class="ffxiv-callout ${background.className}" data-ffxiv-callout="true" data-ffxiv-callout-background="${backgroundKey}"><selection></selection></div>`,
    { inline: false },
  );
  return true;
}

function applyIcon(menu, iconKey, applyInsert) {
  const icon = CALLOUT_ICONS[iconKey];
  if (!icon) return false;

  const callout = findSelectedCallout(menu?.view);
  if (callout) {
    return replaceCallout(menu, callout, replacement => {
      removeClassesWithPrefix(replacement, "ffxiv-callout--icon-");
      delete replacement.dataset.ffxivCalloutIcon;

      // Keep the icon as callout state rather than inserting an inline node.
      // ProseMirror may normalize arbitrary span/img wrappers inside a block,
      // which made the previous icon positioning unreliable. The CSS pseudo-
      // element below is anchored directly to the callout container instead.
      if (iconKey === "gm") {
        replacement.classList.add(icon.className);
        replacement.dataset.ffxivCalloutIcon = iconKey;
      }
    });
  }

  const state = menu?.view?.state;
  if (!state || state.selection.from === state.selection.to) return false;

  applyInsert(
    `<div class="ffxiv-callout ${icon.className ?? ""}" data-ffxiv-callout="true" data-ffxiv-callout-icon="${iconKey}"><selection></selection></div>`,
    { inline: false },
  );
  return true;
}

function buildSubmenu({ action, titleKey, fallbackTitle, entries, className }) {
  return {
    action,
    title: localize(`FFXIVTTRPGLayout.Editor.${titleKey}`, fallbackTitle),
    icon: '<span class="ffxiv-editor-submenu-arrow" aria-hidden="true">▸</span>',
    class: `ffxiv-editor-submenu-entry ${className}`,
    children: entries,
  };
}

function buildHeaderColorEntries(applySemanticInsert) {
  return Object.entries(TEXT_HEADER_COLORS).map(([key, config]) => ({
    action: `ffxiv-header-color-${key}`,
    title: localize(`FFXIVTTRPGLayout.Editor.${config.key}`, config.key.replace(/-/g, " ")),
    icon: `<span class="ffxiv-editor-color-dot ffxiv-editor-color-dot--${key}" aria-hidden="true"></span>`,
    class: "ffxiv-editor-semantic-entry ffxiv-editor-callout-color-entry",
    cmd: () => applyHeaderColor(key, applySemanticInsert),
  }));
}

function buildTextColorEntries(menu, applySemanticInsert) {
  return Object.entries(TEXT_COLORS).map(([key, config]) => ({
    action: `ffxiv-text-color-${key}`,
    title: localize(`FFXIVTTRPGLayout.Editor.${config.key}`, config.key),
    icon: `<span class="ffxiv-editor-color-dot ffxiv-editor-color-dot--text-${key}" aria-hidden="true"></span>`,
    class: `ffxiv-editor-semantic-entry ffxiv-editor-callout-text-entry ffxiv-editor-callout-text-entry--${key}`,
    cmd: () => applySemanticInsert(`<span class="${config.className}"><selection></selection></span>`),
  }));
}

function buildBackgroundEntries(menu, applyInsert) {
  return Object.entries(CALLOUT_BACKGROUNDS).map(([key, config]) => ({
    action: `ffxiv-callout-background-${key}`,
    title: localize(`FFXIVTTRPGLayout.Editor.${config.key}`, config.key),
    icon: `<span class="ffxiv-editor-background-preview ffxiv-editor-background-preview--${key}" aria-hidden="true"></span>`,
    class: "ffxiv-editor-semantic-entry ffxiv-editor-callout-background-entry",
    cmd: () => applyBackground(menu, key, applyInsert),
  }));
}

function buildIconEntries(menu, applyInsert) {
  return Object.entries(CALLOUT_ICONS).map(([key, config]) => ({
    action: `ffxiv-callout-icon-${key}`,
    title: localize(`FFXIVTTRPGLayout.Editor.${config.key}`, config.key),
    icon: key === "gm"
      ? `<img class="ffxiv-editor-icon-preview" src="modules/ffxiv-ttrpg-layout/images/Icons/GM.png" alt="GM">`
      : '<span class="ffxiv-editor-icon-none" aria-hidden="true">—</span>', 
    class: "ffxiv-editor-semantic-entry ffxiv-editor-callout-icon-entry",
    cmd: () => applyIcon(menu, key, applyInsert),
  }));
}

export function buildCalloutTextEditorEntries({ menu, applyInsert, applySemanticInsert }) {
  return [
    buildSubmenu({
      action: "ffxiv-header-color-menu",
      titleKey: "HeaderColour",
      fallbackTitle: "Header Colour",
      entries: buildHeaderColorEntries(applySemanticInsert),
      className: "ffxiv-editor-submenu-entry--header-colour",
    }),
    buildSubmenu({
      action: "ffxiv-text-color-menu",
      titleKey: "TextColour",
      fallbackTitle: "Text Colour",
      entries: buildTextColorEntries(menu, applySemanticInsert),
      className: "ffxiv-editor-submenu-entry--text-colour",
    }),
    buildSubmenu({
      action: "ffxiv-callout-background-menu",
      titleKey: "Background",
      fallbackTitle: "Background",
      entries: buildBackgroundEntries(menu, applyInsert),
      className: "ffxiv-editor-submenu-entry--background",
    }),
    buildSubmenu({
      action: "ffxiv-callout-icon-menu",
      titleKey: "Icon",
      fallbackTitle: "Icon",
      entries: buildIconEntries(menu, applyInsert),
      className: "ffxiv-editor-submenu-entry--icon",
    }),
  ];
}

export function buildScenarioEditorEntry({ menu }) {
  return {
    action: "ffxiv-scenario",
    title: localize("FFXIVTTRPGLayout.Editor.Scenario", "Scenario"),
    icon: '<span class="ffxiv-editor-accent ffxiv-editor-accent--scenario"><i class="fa-solid fa-volume-high" aria-hidden="true"></i></span>',
    class: "ffxiv-editor-semantic-entry ffxiv-editor-semantic-entry--scenario",
    cmd: () => {
      const state = menu?.view?.state;
      if (!state || state.selection.from === state.selection.to) return false;
      menu._placeInsert(
        state,
        menu.view.dispatch.bind(menu.view),
        menu.view,
        '<div class="ffxiv-callout ffxiv-callout--scenario"><div class="ffxiv-callout__label"><i class="fa-solid fa-volume-high" aria-hidden="true"></i></div><p><selection></selection></p></div>',
        { inline: false },
      );
      return true;
    },
  };
}
