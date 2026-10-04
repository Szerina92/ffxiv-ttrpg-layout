import { localize } from "./i18n.js";

/**
 * FFXIV TTRPG Layout — global Journal Rule references.
 *
 * Syntax:
 *   &Rule[Bind]{Bind}
 *   &Rule[Bind]
 *
 * The first value is the rule key; the optional second value is the visible label.
 * When no label is provided, the rule key is used as the visible label.
 */

const RULE_PAGE_TYPE = "ffxiv-ttrpg-layout.rule";
const RULE_LINK_PATTERN = /&Rule\[([^\]]+)\](?:\{([^{}]*)\})?/g;
const RULE_ENRICHER_ID = "ffxiv-ttrpg-layout-rule";

const RULE_PACK_ID = "ffxiv-ttrpg-layout.rules";
const RULE_PACK_SETTING_KEY = "showRulesCompendium";

export function registerRulesCompendiumSetting() {
  game.settings.register("ffxiv-ttrpg-layout", RULE_PACK_SETTING_KEY, {
    name: "FFXIVTTRPGLayout.Settings.ShowRulesCompendium",
    hint: "FFXIVTTRPGLayout.Settings.ShowRulesCompendiumHint",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => {
      ui?.compendium?.render?.({force: true});
    }
  });
}

export function isRulesCompendiumVisible() {
  return game.settings.get("ffxiv-ttrpg-layout", RULE_PACK_SETTING_KEY) === true;
}

function hideRulesPackInDirectory(app) {
  if (isRulesCompendiumVisible()) return;
  const root = app?.element;
  if (!(root instanceof HTMLElement)) return;

  const selectors = [
    `[data-pack="${RULE_PACK_ID}"]`,
    `[data-pack-id="${RULE_PACK_ID}"]`,
    `[data-collection="${RULE_PACK_ID}"]`
  ];

  const candidates = new Set();
  for (const selector of selectors) {
    for (const element of root.querySelectorAll(selector)) candidates.add(element);
  }

  // Foundry's V14 directory entry is a directory item. If the pack metadata
  // is stored on a child element, hide the containing entry instead.
  for (const element of candidates) {
    const entry = element.closest?.(".directory-item, li") ?? element;
    entry.hidden = true;
    entry.classList.add("ffxiv-ttrpg-layout-hidden-rules-pack");
  }
}

function registerRulesCompendiumDirectoryHook() {
  Hooks.on("renderCompendiumDirectory", app => hideRulesPackInDirectory(app));
}

function canViewJournal(journal) {
  if (!journal || !game.user) return false;
  if (typeof journal.testUserPermission !== "function") return true;
  return journal.testUserPermission(game.user, "OBSERVER");
}

function isRulePage(page) {
  return page?.type === RULE_PAGE_TYPE || page?.type === "rule";
}

let rulePackPagesPromise = null;
let ruleEditorEntries = [];
let ruleEditorEntriesLoaded = false;

async function getRulePackPages() {
  const pack = game.packs?.get?.(RULE_PACK_ID);
  if (!pack) return [];

  if (!rulePackPagesPromise) {
    rulePackPagesPromise = pack.getDocuments().catch(error => {
      console.warn("FFXIV TTRPG Layout | Unable to load Rules compendium", error);
      return [];
    });
  }

  const journals = await rulePackPagesPromise;
  const pages = [];
  for (const journal of journals) {
    for (const page of journal.pages?.contents ?? []) {
      if (!isRulePage(page)) continue;
      const key = String(page.system?.key ?? "").trim();
      if (!key) continue;
      pages.push(page);
    }
  }
  return pages;
}

export async function getRulePages() {
  const journals = game.journal?.contents ?? [];
  const pages = [];

  for (const journal of journals) {
    if (!canViewJournal(journal)) continue;
    for (const page of journal.pages?.contents ?? []) {
      if (!isRulePage(page)) continue;
      const key = String(page.system?.key ?? "").trim().toLowerCase();
      if (!key) continue;
      pages.push(page);
    }
  }

  // Rule pages stored in the module's Rules compendium are not part of
  // game.journal.contents. Load them from the pack as well.
  const packPages = await getRulePackPages();
  for (const page of packPages) {
    const key = String(page.system?.key ?? "").trim().toLowerCase();
    if (!key) continue;
    pages.push(page);
  }

  return pages;
}

export async function findRule(key) {
  const normalized = String(key ?? "").trim().toLowerCase();
  if (!normalized) return null;
  const pages = await getRulePages();
  return pages.find(page => String(page.system?.key ?? "").trim().toLowerCase() === normalized) ?? null;
}

export function getRuleContent(page) {
  return String(page?.system?.content ?? "").trim();
}

function getTooltip() {
  let tooltip = document.querySelector(".ffxiv-rule-tooltip");
  if (tooltip) return tooltip;

  tooltip = document.createElement("div");
  tooltip.className = "ffxiv-rule-tooltip";
  tooltip.hidden = true;
  document.body.appendChild(tooltip);
  return tooltip;
}

function hideRuleTooltip({ force = false } = {}) {
  if (pinnedRuleTooltip && !force) return;
  const tooltip = document.querySelector(".ffxiv-rule-tooltip");
  if (!tooltip) return;
  tooltip.classList.remove("is-visible", "is-pinned");
  tooltip.hidden = true;
  pinnedRuleTooltip = false;
  pinnedRuleLink = null;
}

function unpinRuleTooltip() {
  const tooltip = document.querySelector(".ffxiv-rule-tooltip");
  if (tooltip) tooltip.classList.remove("is-pinned");
  pinnedRuleTooltip = false;
  pinnedRuleLink = null;
  hideRuleTooltip({ force: true });
}

async function showRuleTooltip(link) {
  const key = link.dataset.ffxivRuleKey;
  const page = await findRule(key);
  if (!page) {
    console.warn(`FFXIV TTRPG Layout | Rule not found: ${key}`);
    hideRuleTooltip();
    return;
  }

  const tooltip = getTooltip();
  const title = foundry.utils.escapeHTML(page.name || page.system?.key || key);
  const content = getRuleContent(page);

  let html = content;
  try {
    html = await foundry.applications.ux.TextEditor.implementation.enrichHTML(content, {
      async: true,
      custom: true,
      documents: true,
      embeds: true,
      links: true,
      rolls: true,
      secrets: page.parent?.isOwner ?? false,
      relativeTo: page,
    });
  } catch (error) {
    console.warn("FFXIV TTRPG Layout | Unable to enrich Rule tooltip content", error);
  }

  tooltip.innerHTML = `<div class="ffxiv-rule-tooltip__title">${title}</div><div class="ffxiv-rule-tooltip__body">${html}</div>`;
  tooltip.hidden = false;
  tooltip.classList.add("is-visible");
  if (pinnedRuleTooltip) tooltip.classList.add("is-pinned");

  const rect = link.getBoundingClientRect();
  const gap = 8;
  const width = tooltip.offsetWidth;
  const height = tooltip.offsetHeight;
  const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
  const top = rect.bottom + gap + height <= window.innerHeight
    ? rect.bottom + gap
    : Math.max(12, rect.top - height - gap);

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function createRuleLink(match) {
  const key = String(match?.[1] ?? "").trim();
  const label = String(match?.[2] ?? "").trim() || key;
  const link = document.createElement("span");
  link.className = "ffxiv-rule-link";
  link.dataset.ffxivRuleKey = key;
  link.tabIndex = 0;
  link.textContent = label;

  return link;
}

let ruleInteractionHandlersRegistered = false;
let pinnedRuleTooltip = false;
let pinnedRuleLink = null;

function registerRuleInteractionHandlers() {
  if (ruleInteractionHandlersRegistered) return;
  ruleInteractionHandlersRegistered = true;

  document.addEventListener("pointerover", event => {
    if (pinnedRuleTooltip) return;
    const link = event.target?.closest?.(".ffxiv-rule-link");
    if (!link) return;
    const from = event.relatedTarget;
    if (from && link.contains(from)) return;
    showRuleTooltip(link);
  });

  document.addEventListener("pointerout", event => {
    if (pinnedRuleTooltip) return;
    const link = event.target?.closest?.(".ffxiv-rule-link");
    if (!link) return;
    const to = event.relatedTarget;
    if (to && link.contains(to)) return;
    hideRuleTooltip();
  });

  document.addEventListener("focusin", event => {
    const link = event.target?.closest?.(".ffxiv-rule-link");
    if (link) showRuleTooltip(link);
  });

  document.addEventListener("focusout", event => {
    const link = event.target?.closest?.(".ffxiv-rule-link");
    if (link) hideRuleTooltip();
  });

  // Middle-click pins the tooltip so long Rule text can be scrolled with the mouse.
  document.addEventListener("pointerdown", event => {
    const link = event.target?.closest?.(".ffxiv-rule-link");
    if (!link || event.button !== 1) return;
    event.preventDefault();
    pinnedRuleTooltip = !pinnedRuleTooltip || pinnedRuleLink !== link;
    pinnedRuleLink = pinnedRuleTooltip ? link : null;
    if (pinnedRuleTooltip) {
      showRuleTooltip(link);
    } else {
      hideRuleTooltip({ force: true });
    }
  });

  // While pinned, clicking outside the link or tooltip closes it.
  document.addEventListener("pointerdown", event => {
    if (!pinnedRuleTooltip || event.button !== 0) return;
    const tooltip = document.querySelector(".ffxiv-rule-tooltip");
    const link = event.target?.closest?.(".ffxiv-rule-link");
    if (tooltip?.contains(event.target) || link === pinnedRuleLink) return;
    unpinRuleTooltip();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && pinnedRuleTooltip) unpinRuleTooltip();
  });
}

function getRuleKeyForEditor(page) {
  return String(page?.system?.key ?? "").trim();
}

export async function preloadRuleEditorEntries() {
  if (ruleEditorEntriesLoaded) return ruleEditorEntries;
  ruleEditorEntriesLoaded = true;

  const pages = await getRulePackPages();
  const sortedPages = [...pages].sort((a, b) =>
    String(a?.name ?? "").localeCompare(String(b?.name ?? ""), undefined, {
      sensitivity: "base",
    }),
  );

  ruleEditorEntries = sortedPages
    .map((page, index) => {
      const ruleKey = String(page?.system?.key ?? "").trim();
      const label = String(page?.name ?? ruleKey).trim() || ruleKey;
      if (!ruleKey || !label) return null;
      return {
        action: `ffxiv-rule-${index}-${ruleKey.toLowerCase().replace(/[^a-z0-9_-]+/g, "-")}`,
        title: label,
        ruleKey,
        icon: '<i class="fa-solid fa-book-open" aria-hidden="true"></i>',
        class: "ffxiv-editor-semantic-entry ffxiv-editor-rule-entry",
      };
    })
    .filter(Boolean);

  return ruleEditorEntries;
}

function applyRuleToSelection(menu, ruleKey) {
  const view = menu?.view;
  const state = view?.state;
  if (!view || !state) return false;

  const { from, to } = state.selection;
  if (from === to) return false;

  const $from = state.doc.resolve(from);
  const $to = state.doc.resolve(to);
  if (!$from.parent.inlineContent || !$to.parent.inlineContent || $from.depth !== $to.depth) {
    return false;
  }

  const selectedText = state.doc.textBetween(from, to, "\n", "\n");
  if (!selectedText.trim()) return false;

  // Rule macros are stored as plain text so Foundry's TextEditor enricher can
  // resolve them later. ProseMirror will escape HTML-significant characters
  // when the text is serialized back to the Journal HTML.
  const macro = `&Rule[${ruleKey}]{${selectedText}}`;

  try {
    view.dispatch(state.tr.insertText(macro, from, to));
    view.focus();
    return true;
  } catch (error) {
    console.warn("FFXIV TTRPG Layout | Failed to insert Rule reference.", error);
    return false;
  }
}

export function buildRuleEditorEntry({ menu }) {
  const entries = ruleEditorEntries.length
    ? ruleEditorEntries.map(entry => ({
        action: entry.action,
        title: entry.title,
        icon: entry.icon,
        class: entry.class,
        cmd: () => applyRuleToSelection(menu, entry.ruleKey),
      }))
    : [{
        action: "ffxiv-rules-empty",
        title: localize("FFXIVTTRPGLayout.Editor.NoRulesAvailable", "No Rules available"),
        icon: '<i class="fa-solid fa-book-open" aria-hidden="true"></i>',
        class: "ffxiv-editor-semantic-entry ffxiv-editor-rule-entry ffxiv-editor-rule-entry--empty",
        cmd: () => false,
      }];

  return {
    action: "ffxiv-rules-menu",
    title: localize("FFXIVTTRPGLayout.Editor.Rules", "Rules"),
    icon: '<span class="ffxiv-editor-submenu-arrow" aria-hidden="true">▸</span>',
    class: "ffxiv-editor-submenu-entry ffxiv-editor-submenu-entry--rules",
    children: entries,
  };
}

/**
 * Register the custom Foundry V14 TextEditor enricher and the Rule insertion
 * menu data. Rule Pages themselves are the registry: no manual rule
 * registration is required. The editor menu is populated from the module's
 * Rules compendium and displays each Rule's page Header (name) to the user.
 */
export function registerRuleEnricher() {
  registerRuleInteractionHandlers();
  CONFIG.TextEditor ??= {};
  CONFIG.TextEditor.enrichers ??= [];

  if (CONFIG.TextEditor.enrichers.some(enricher => enricher.id === RULE_ENRICHER_ID)) return;

  CONFIG.TextEditor.enrichers.push({
    id: RULE_ENRICHER_ID,
    pattern: RULE_LINK_PATTERN,
    enricher: async match => createRuleLink(match),
  });
}

Hooks.once("ready", () => { preloadRuleEditorEntries(); });

registerRulesCompendiumDirectoryHook();

export { RULE_PAGE_TYPE, RULE_ENRICHER_ID, RULE_PACK_ID, RULE_PACK_SETTING_KEY };
