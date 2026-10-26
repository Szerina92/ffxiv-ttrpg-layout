import { localize } from "./i18n.js";
import { buildSubmenu } from "./utils/menu-entries.js";

const TEXT_HEADER_COLORS = Object.freeze({
  blue: {
    key: "DarkBlue",
    className: "ffxiv-header-blue",
  },
  red: {
    key: "Red",
    className: "ffxiv-header-red",
  },
  green: {
    key: "Green",
    className: "ffxiv-header-green",
  },
});

const TEXT_COLORS = Object.freeze({
  important: {
    key: "Important",
    className: "ffxiv-text-important",
  },
  note: {
    key: "Note",
    className: "ffxiv-text-note",
  },
  example: {
    key: "Example",
    className: "ffxiv-text-example",
  },
});

const CALLOUT_BACKGROUNDS = Object.freeze({
  "light-blue": {
    key: "LightBlue",
    className: "ffxiv-bg-light-blue",
  },
  white: {
    key: "White",
    className: "ffxiv-bg-white",
  },
  paperscroll: {
    key: "Paperscroll",
    className: "ffxiv-bg-paperscroll",
  },
  green: {
    key: "Green",
    className: "ffxiv-bg-green",
  },
});

const CALLOUT_ICONS = Object.freeze({
  none: {
    key: "IconNone",
    className: null,
  },
  gm: {
    key: "GM",
    className: "ffxiv-icon-gm",
  },
});

/** Closest ancestor-or-self element matching the selector; text nodes start at their parent. */
function closestElement(node, selector) {
  const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  return element?.closest(selector) ?? null;
}

const CALLOUT_SELECTOR = [
  ...Object.values(CALLOUT_BACKGROUNDS).map(({ className }) => `.${className}`),
  ...Object.values(CALLOUT_ICONS)
    .map(({ className }) => className ? `.${className}` : null)
    .filter(Boolean),
].join(", ");

function findCalloutAtPosition(view, position) {
  if (!view?.dom || !Number.isFinite(position)) return null;
  try {
    const dom = view.domAtPos(position, 0)?.node;
    return closestElement(dom, CALLOUT_SELECTOR);
  } catch {
    return null;
  }
}

function findSelectedCallout(view) {
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

    const insertionHTML = replacement.matches(CALLOUT_SELECTOR)
      ? replacement.outerHTML
      : replacement.innerHTML;

    const nextState = view.state;
    menu._placeInsert(
      nextState,
      view.dispatch.bind(view),
      view,
      insertionHTML,
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
    `<span class="${color.className}"><selection></selection></span>`
  );
}

function applyBackground(menu, backgroundKey, applyInsert) {
  const background = CALLOUT_BACKGROUNDS[backgroundKey];
  if (!background) return false;

  const callout = findSelectedCallout(menu?.view);
  if (callout) {
    return replaceCallout(menu, callout, replacement => {
      removeClassesWithPrefix(replacement, "ffxiv-bg-");
      replacement.classList.add(background.className);
    });
  }

  const state = menu?.view?.state;
  if (!state || state.selection.from === state.selection.to) return false;

  applyInsert(
    `<div class="${background.className}"><selection></selection></div>`,
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
      removeClassesWithPrefix(replacement, "ffxiv-icon-");

      // Keep the icon as callout state rather than inserting an inline node.
      // ProseMirror may normalize arbitrary span/img wrappers inside a block,
      // which made the previous icon positioning unreliable. The CSS pseudo-
      // element below is anchored directly to the callout container instead.
      if (iconKey === "gm") {
        replacement.classList.add(icon.className);
      }
    });
  }

  const state = menu?.view?.state;
  if (!state || state.selection.from === state.selection.to || iconKey === "none") return false;

  applyInsert(
    `<div class="${icon.className}"><selection></selection></div>`,
    { inline: false },
  );
  return true;
}

function buildHeaderColorEntries(applySemanticInsert) {
  return Object.entries(TEXT_HEADER_COLORS).map(([key, config]) => ({
    action: `ffxiv-header-color-${key}`,
    title: localize(`FFXIVTTRPGLayout.Editor.${config.key}`),
    icon: `<span class="ffxiv-editor-color-dot ffxiv-editor-color-dot--${key}" aria-hidden="true"></span>`,
    class: "ffxiv-editor-semantic-entry ffxiv-editor-callout-color-entry",
    cmd: () => applyHeaderColor(key, applySemanticInsert),
  }));
}

function buildTextColorEntries(applySemanticInsert) {
  const colorEntries = Object.entries(TEXT_COLORS).map(([key, config]) => ({
    action: `ffxiv-text-color-${key}`,
    title: localize(`FFXIVTTRPGLayout.Editor.${config.key}`),
    icon: `<span class="ffxiv-editor-color-dot ffxiv-editor-color-dot--text-${key}" aria-hidden="true"></span>`,
    class: `ffxiv-editor-semantic-entry ffxiv-editor-callout-text-entry ffxiv-editor-callout-text-entry--${key}`,
    cmd: () => applySemanticInsert(`<span class="${config.className}"><selection></selection></span>`),
  }));

  // Ability and Attack are semantic text treatments, so keep them together
  // with the other text-colour tools in the Text Editor submenu.
  const semanticEntries = [
    {
      action: "ffxiv-ability",
      title: localize("FFXIV.ItemType.ability"),
      icon: '<span class="ffxiv-editor-accent ffxiv-editor-accent--abi">ABI</span>',
      class: "ffxiv-editor-semantic-entry ffxiv-editor-semantic-entry--abi",
      cmd: () => applySemanticInsert('<span class="ffxiv-abi"><selection></selection></span>'),
    },
    {
      action: "ffxiv-attack",
      title: localize("FFXIVTTRPGLayout.Editor.Attack"),
      icon: '<span class="ffxiv-editor-accent ffxiv-editor-accent--att">ATT</span>',
      class: "ffxiv-editor-semantic-entry ffxiv-editor-semantic-entry--att",
      cmd: () => applySemanticInsert('<span class="ffxiv-att"><selection></selection></span>'),
    },
  ];

  return [...colorEntries, ...semanticEntries];
}

function buildBackgroundEntries(menu, applyInsert) {
  return Object.entries(CALLOUT_BACKGROUNDS).map(([key, config]) => ({
    action: `ffxiv-callout-background-${key}`,
    title: localize(`FFXIVTTRPGLayout.Editor.${config.key}`),
    icon: `<span class="ffxiv-editor-background-preview ffxiv-editor-background-preview--${key}" aria-hidden="true"></span>`,
    class: "ffxiv-editor-semantic-entry ffxiv-editor-callout-background-entry",
    cmd: () => applyBackground(menu, key, applyInsert),
  }));
}

function buildIconEntries(menu, applyInsert) {
  return Object.entries(CALLOUT_ICONS).map(([key, config]) => ({
    action: `ffxiv-callout-icon-${key}`,
    title: localize(`FFXIVTTRPGLayout.Editor.${config.key}`),
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
      title: localize("FFXIVTTRPGLayout.Editor.HeaderColour"),
      children: buildHeaderColorEntries(applySemanticInsert),
      className: "ffxiv-editor-submenu-entry--header-colour",
    }),
    buildSubmenu({
      action: "ffxiv-text-color-menu",
      title: localize("FFXIVTTRPGLayout.Editor.TextColour"),
      children: buildTextColorEntries(applySemanticInsert),
      className: "ffxiv-editor-submenu-entry--text-colour",
    }),
    buildSubmenu({
      action: "ffxiv-callout-background-menu",
      title: localize("FFXIVTTRPGLayout.Editor.Background"),
      children: buildBackgroundEntries(menu, applyInsert),
      className: "ffxiv-editor-submenu-entry--background",
    }),
    buildSubmenu({
      action: "ffxiv-callout-icon-menu",
      title: localize("FFXIVTTRPGLayout.Editor.Icon"),
      children: buildIconEntries(menu, applyInsert),
      className: "ffxiv-editor-submenu-entry--icon",
    }),
  ];
}

export function buildScenarioEditorEntry({ menu }) {
  return {
    action: "ffxiv-scenario",
    title: localize("FFXIVTTRPGLayout.Editor.Scenario"),
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
