/* Rule colors */

import { MODULE_ID, SYSTEM_RULE_PAGE_TYPE } from "./constants.js";

const FLAG = "ruleColor";
const SETTING = "ruleColors";
const FIELD_NAME = `flags.${MODULE_ID}.${FLAG}`;
const STYLE_ID = `${MODULE_ID}-rule-colors`;
const COLOR = /^#[0-9a-f]{6}$/i;

const localColors = new Map();

const isRulePage = page => page?.documentName === "JournalEntryPage" && page.type === SYSTEM_RULE_PAGE_TYPE;
const isRulePack = pack => pack?.documentName === "JournalEntry"
  && (pack.metadata.flags?.ffxiv?.rules === true || CONFIG.FFXIV?.rules?.packs?.has?.(pack.collection) === true);
const isSyncingGM = () => game.user === game.users.activeGM;

function colorOf(page) {
  const value = String(page.getFlag(MODULE_ID, FLAG) ?? "");
  return COLOR.test(value) ? value.toLowerCase() : "";
}

function storedColors() {
  const stored = game.settings.get(MODULE_ID, SETTING);
  return stored && typeof stored === "object" ? stored : {};
}

function sorted(colors) {
  return Object.fromEntries(Object.entries(colors).sort(([a], [b]) => a.localeCompare(b)));
}

/* -------------------------------------------- */
/*  Stylesheet                                  */
/* -------------------------------------------- */

function applyStyles() {
  const colors = { ...storedColors() };
  for (const [uuid, color] of localColors) {
    if (color) colors[uuid] = color;
    else delete colors[uuid];
  }

  const css = Object.entries(colors)
    .filter(([, color]) => COLOR.test(color))
    .map(([uuid, color]) => `.ffxiv-rule-reference[data-rule-uuid="${CSS.escape(uuid)}"] { color: ${color} !important; }`)
    .join("\n");

  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.append(style);
  }
  style.textContent = css;
}

/* -------------------------------------------- */
/*  Sync                                        */
/* -------------------------------------------- */

async function saveColors(colors) {
  const next = sorted(colors);
  if (JSON.stringify(next) === JSON.stringify(sorted(storedColors()))) return;
  await game.settings.set(MODULE_ID, SETTING, next);
}

async function collectColors() {
  const colors = {};
  const add = page => {
    const color = isRulePage(page) ? colorOf(page) : "";
    if (color) colors[page.uuid] = color;
  };

  for (const journal of game.journal) journal.pages.forEach(add);
  for (const pack of game.packs.filter(isRulePack)) {
    for (const journal of await pack.getDocuments()) journal.pages.forEach(add);
  }
  return colors;
}

function onPageChange(page, removed = false) {
  if (!isRulePage(page)) return;

  const color = removed ? "" : colorOf(page);
  const current = localColors.has(page.uuid) ? localColors.get(page.uuid) : (storedColors()[page.uuid] ?? "");
  if (color === current) return;

  localColors.set(page.uuid, color);
  applyStyles();
  if (!isSyncingGM()) return;

  const colors = { ...storedColors() };
  if (color) colors[page.uuid] = color;
  else delete colors[page.uuid];
  saveColors(colors);
}

/* -------------------------------------------- */
/*  Rule editor                                 */
/* -------------------------------------------- */

function addColorField(app, element) {
  const page = app.document;
  if (!isRulePage(page) || app.isView) return;

  const editor = element.querySelector(".ffxiv-rule-page-edit");
  if (!editor || editor.querySelector(`[name="${FIELD_NAME}"]`)) return;

  const id = `${page.uuid}-rule-color`;
  const group = document.createElement("div");
  group.className = "form-group ffxiv-rule-color";

  const label = document.createElement("label");
  label.htmlFor = id;
  label.textContent = game.i18n.localize("FFXIVTTRPGLayout.Rules.Color");

  const fields = document.createElement("div");
  fields.className = "form-fields";
  const escape = foundry.utils.escapeHTML;
  fields.innerHTML = `<color-picker id="${escape(id)}" name="${FIELD_NAME}" value="${escape(colorOf(page))}"></color-picker>`;

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = game.i18n.localize("FFXIVTTRPGLayout.Rules.ColorHint");

  group.append(label, fields, hint);
  const aliases = editor.querySelector(".form-group");
  if (aliases) aliases.after(group);
  else editor.prepend(group);
}

/* -------------------------------------------- */
/*  Registration                                */
/* -------------------------------------------- */

export function registerRuleColors() {
  game.settings.register(MODULE_ID, SETTING, {
    scope: "world",
    config: false,
    type: Object,
    default: {},
    onChange: applyStyles,
  });

  Hooks.on("renderApplicationV2", addColorField);
  Hooks.on("createJournalEntryPage", page => onPageChange(page));
  Hooks.on("updateJournalEntryPage", page => onPageChange(page));
  Hooks.on("deleteJournalEntryPage", page => onPageChange(page, true));
  Hooks.on("createJournalEntry", journal => journal.pages.forEach(page => onPageChange(page)));
  Hooks.on("deleteJournalEntry", journal => journal.pages.forEach(page => onPageChange(page, true)));

  Hooks.once("ready", async () => {
    applyStyles();
    if (isSyncingGM()) await saveColors(await collectColors());
  });
}
