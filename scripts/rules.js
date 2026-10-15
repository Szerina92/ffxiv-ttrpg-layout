/**
 * FFXIV TTRPG Layout — global Journal Rule references.
 *
 * Syntax:
 *   &Rule[Bind]{Bind}
 *   &Rule[Bind]
 *
 * The first value is the rule key; the optional second value is the visible label.
 * When no label is provided, the rule key is used as the visible label.
 *
 * Rule Pages themselves are the registry: no manual rule registration is
 * required. The editor menu is populated from the module's Rules compendium
 * and displays each Rule's page Header (name) to the user.
 */

import { RULE_PACK_ID, RULE_PAGE_TYPE } from "./constants.js";
import { localize } from "./i18n.js";
import { isRulesCompendiumVisible } from "./settings.js";
import { enrich } from "./utils/enrich.js";
import { buildSubmenu } from "./utils/menu-entries.js";

const RULE_LINK_PATTERN = /&Rule\[([^\]]+)\](?:\{([^{}]*)\})?/g;
const RULE_ENRICHER_ID = "ffxiv-ttrpg-layout-rule";
const RULE_LINK_SELECTOR = ".ffxiv-rule-link";
const TOOLTIP_SELECTOR = ".ffxiv-rule-tooltip";
const PACK_SELECTOR = ["data-pack", "data-pack-id", "data-collection"]
  .map(attribute => `[${attribute}="${RULE_PACK_ID}"]`)
  .join(", ");

/* -------------------------------------------- */
/*  Rule lookup                                 */
/* -------------------------------------------- */

const ruleKeyOf = page => String(page?.system?.key ?? "").trim();
const isRulePage = page => (page?.type === RULE_PAGE_TYPE || page?.type === "rule") && ruleKeyOf(page) !== "";

function canViewJournal(journal) {
  if (!journal || !game.user) return false;
  return journal.testUserPermission?.(game.user, "OBSERVER") ?? true;
}

function* rulePagesOf(journals) {
  for (const journal of journals) {
    for (const page of journal.pages?.contents ?? []) {
      if (isRulePage(page)) yield page;
    }
  }
}

let rulePackJournals = null;

/** Rule pages stored in the module's Rules compendium (not part of game.journal). */
async function getRulePackPages() {
  const pack = game.packs?.get?.(RULE_PACK_ID);
  if (!pack) return [];

  rulePackJournals ??= pack.getDocuments().catch(error => {
    console.warn("FFXIV TTRPG Layout | Unable to load Rules compendium", error);
    return [];
  });

  return [...rulePagesOf(await rulePackJournals)];
}

async function findRule(key) {
  const normalized = String(key ?? "").trim().toLowerCase();
  if (!normalized) return null;

  const worldPages = rulePagesOf(game.journal?.contents.filter(canViewJournal) ?? []);
  const pages = [...worldPages, ...await getRulePackPages()];
  return pages.find(page => ruleKeyOf(page).toLowerCase() === normalized) ?? null;
}

/* -------------------------------------------- */
/*  Compendium visibility                       */
/* -------------------------------------------- */

function hideRulesPackInDirectory(app) {
  if (isRulesCompendiumVisible()) return;
  const root = app?.element;
  if (!(root instanceof HTMLElement)) return;

  // The pack metadata may sit on a child element; hide the containing entry.
  for (const element of root.querySelectorAll(PACK_SELECTOR)) {
    const entry = element.closest(".directory-item, li") ?? element;
    entry.hidden = true;
    entry.classList.add("ffxiv-ttrpg-layout-hidden-rules-pack");
  }
}

/* -------------------------------------------- */
/*  Tooltip                                     */
/* -------------------------------------------- */

const tooltipState = { pinned: false, link: null };

function getTooltip() {
  let tooltip = document.querySelector(TOOLTIP_SELECTOR);
  if (tooltip) return tooltip;

  tooltip = document.createElement("div");
  tooltip.className = "ffxiv-rule-tooltip";
  tooltip.hidden = true;
  document.body.appendChild(tooltip);
  return tooltip;
}

function hideRuleTooltip({ force = false } = {}) {
  if (tooltipState.pinned && !force) return;
  const tooltip = document.querySelector(TOOLTIP_SELECTOR);
  if (!tooltip) return;
  tooltip.classList.remove("is-visible", "is-pinned");
  tooltip.hidden = true;
  tooltipState.pinned = false;
  tooltipState.link = null;
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
  const title = foundry.utils.escapeHTML(page.name || ruleKeyOf(page) || key);
  const content = String(page.system?.content ?? "").trim();

  let html = content;
  try {
    html = await enrich(content, page);
  } catch (error) {
    console.warn("FFXIV TTRPG Layout | Unable to enrich Rule tooltip content", error);
  }

  tooltip.innerHTML = `<div class="ffxiv-rule-tooltip__title">${title}</div><div class="ffxiv-rule-tooltip__body">${html}</div>`;
  tooltip.hidden = false;
  tooltip.classList.add("is-visible");
  if (tooltipState.pinned) tooltip.classList.add("is-pinned");

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

function registerRuleInteractionHandlers() {
  const linkOf = event => event.target?.closest?.(RULE_LINK_SELECTOR);
  // True when the pointer moves between two nodes inside the same link.
  const staysInside = (link, related) => related && link.contains(related);

  document.addEventListener("pointerover", event => {
    if (tooltipState.pinned) return;
    const link = linkOf(event);
    if (!link || staysInside(link, event.relatedTarget)) return;
    showRuleTooltip(link);
  });

  document.addEventListener("pointerout", event => {
    if (tooltipState.pinned) return;
    const link = linkOf(event);
    if (!link || staysInside(link, event.relatedTarget)) return;
    hideRuleTooltip();
  });

  document.addEventListener("focusin", event => {
    const link = linkOf(event);
    if (link) showRuleTooltip(link);
  });

  document.addEventListener("focusout", event => {
    if (linkOf(event)) hideRuleTooltip();
  });

  // Middle-click pins the tooltip so long Rule text can be scrolled with the mouse.
  document.addEventListener("pointerdown", event => {
    const link = linkOf(event);
    if (!link || event.button !== 1) return;
    event.preventDefault();
    tooltipState.pinned = !tooltipState.pinned || tooltipState.link !== link;
    tooltipState.link = tooltipState.pinned ? link : null;
    if (tooltipState.pinned) showRuleTooltip(link);
    else hideRuleTooltip({ force: true });
  });

  // While pinned, clicking outside the link or tooltip closes it.
  document.addEventListener("pointerdown", event => {
    if (!tooltipState.pinned || event.button !== 0) return;
    const tooltip = document.querySelector(TOOLTIP_SELECTOR);
    if (tooltip?.contains(event.target) || linkOf(event) === tooltipState.link) return;
    hideRuleTooltip({ force: true });
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && tooltipState.pinned) hideRuleTooltip({ force: true });
  });
}

/* -------------------------------------------- */
/*  Editor menu                                 */
/* -------------------------------------------- */

const RULE_ICON = '<i class="fa-solid fa-book-open" aria-hidden="true"></i>';

let ruleEditorEntries = [];
let ruleEditorEntriesLoaded = false;

async function preloadRuleEditorEntries() {
  if (ruleEditorEntriesLoaded) return;
  ruleEditorEntriesLoaded = true;

  const pages = await getRulePackPages();
  pages.sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), undefined, { sensitivity: "base" }));

  ruleEditorEntries = pages.map((page, index) => {
    const ruleKey = ruleKeyOf(page);
    const slug = ruleKey.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
    return {
      action: `ffxiv-rule-${index}-${slug}`,
      title: String(page.name ?? ruleKey).trim() || ruleKey,
      ruleKey,
      icon: RULE_ICON,
      class: "ffxiv-editor-semantic-entry ffxiv-editor-rule-entry",
    };
  });
}

function applyRuleToSelection(menu, ruleKey) {
  const view = menu?.view;
  const state = view?.state;
  if (!view || !state) return false;

  const { from, to } = state.selection;
  if (from === to) return false;

  const $from = state.doc.resolve(from);
  const $to = state.doc.resolve(to);
  if (!$from.parent.inlineContent || !$to.parent.inlineContent || $from.depth !== $to.depth) return false;

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
  const children = ruleEditorEntries.length
    ? ruleEditorEntries.map(({ ruleKey, ...entry }) => ({ ...entry, cmd: () => applyRuleToSelection(menu, ruleKey) }))
    : [{
        action: "ffxiv-rules-empty",
        title: localize("FFXIVTTRPGLayout.Editor.NoRulesAvailable"),
        icon: RULE_ICON,
        class: "ffxiv-editor-semantic-entry ffxiv-editor-rule-entry ffxiv-editor-rule-entry--empty",
        cmd: () => false,
      }];

  return buildSubmenu({
    action: "ffxiv-rules-menu",
    title: localize("FFXIVTTRPGLayout.Editor.Rules"),
    className: "ffxiv-editor-submenu-entry--rules",
    children,
  });
}

/* -------------------------------------------- */
/*  Registration                                */
/* -------------------------------------------- */

/** Register the Rule enricher, tooltip handlers, compendium visibility and editor menu data. */
export function registerRules() {
  registerRuleInteractionHandlers();
  Hooks.on("renderCompendiumDirectory", hideRulesPackInDirectory);
  Hooks.once("ready", preloadRuleEditorEntries);

  CONFIG.TextEditor.enrichers.push({
    id: RULE_ENRICHER_ID,
    pattern: RULE_LINK_PATTERN,
    enricher: async match => createRuleLink(match),
  });
}
