/**
 * FFXIV TTRPG Layout — Rule removal.
 *
 * The Layout no longer has its own Rule system (page type, tooltip, editor
 * menu, compendium); the FFXIV system provides rules. This file only keeps
 * old content readable:
 *
 * - Rendering fallback: `stripRuleMacros()` (used by `utils/enrich.js`) turns
 *   `&Rule[Key]{Label}` into plain "Label" ("Key" without a label) before the
 *   text is enriched. It works on the HTML string, because Foundry's enrichers
 *   only see single text nodes and miss macros split by formatting such as
 *   `&Rule[<strong>DOT</strong>]{…}`. A second enricher covers text that is
 *   enriched outside the Layout.
 * - A GM tool (Module Settings → "Remove Rule links") permanently replaces
 *   those macros with the visible text in world documents and unlocked
 *   compendiums (world and module), and can delete leftover Rule pages.
 */

import { MODULE_ID } from "./constants.js";
import { localize } from "./i18n.js";

const LEGACY_RULE_PAGE_TYPE = `${MODULE_ID}.rule`;

/** Macro as written in the editor: `&Rule[Key]{Label}` or `&Rule[Key]`. */
const MACRO = String.raw`Rule\[([^\]]+)\](?:\{([^{}]*)\})?`;
/** Stored HTML escapes the leading `&` as `&amp;`. */
const STORED_PATTERN = new RegExp(String.raw`&(?:amp;)?${MACRO}`, "g");
/** The enricher sees decoded text. */
const TEXT_PATTERN = new RegExp(String.raw`&${MACRO}`, "g");

const visibleText = (key, label) => String(label ?? "").trim() || String(key ?? "").trim();

/** Replace every Rule macro in an HTML/text string by its visible text. */
export function stripRuleMacros(value) {
  if (typeof value !== "string" || !value.includes("Rule[")) return value;
  return value.replace(STORED_PATTERN, (_match, key, label) => visibleText(key, label));
}

/** Primary world collections and the embedded collections inside them. */
const TARGETS = [
  { documentName: "JournalEntry", collection: () => game.journal, embedded: ["pages"] },
  { documentName: "Item", collection: () => game.items, embedded: [] },
  { documentName: "Actor", collection: () => game.actors, embedded: ["items"] },
  { documentName: "RollTable", collection: () => game.tables, embedded: ["results"] },
];

/* -------------------------------------------- */
/*  Text replacement                            */
/* -------------------------------------------- */

/** Replace every Rule macro in `value` (deep) and count the replacements. */
function stripDeep(value, counter) {
  if (typeof value === "string") {
    return value.replace(STORED_PATTERN, (_match, key, label) => {
      counter.count += 1;
      return visibleText(key, label);
    });
  }
  if (Array.isArray(value)) return value.map(entry => stripDeep(entry, counter));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, stripDeep(entry, counter)]));
  }
  return value;
}

/**
 * Top-level fields of one document that contain Rule macros, with their new
 * values. Embedded collections are handled as their own documents.
 */
function changesFor(document, skip = []) {
  const counter = { count: 0 };
  const source = document.toObject();
  const changes = {};
  for (const [key, value] of Object.entries(source)) {
    if (skip.includes(key)) continue;
    const before = counter.count;
    const next = stripDeep(value, counter);
    if (counter.count > before) changes[key] = next;
  }
  return { changes, count: counter.count };
}

/* -------------------------------------------- */
/*  Scan and apply                              */
/* -------------------------------------------- */

/** All documents to inspect: world collections and unlocked world compendiums. */
async function collectDocuments() {
  const entries = [];
  const skippedPacks = [];

  const addDocument = (document, target, where) => {
    entries.push({ document, where, skip: target.embedded });
    for (const name of target.embedded) {
      for (const child of document[name]?.contents ?? []) {
        entries.push({ document: child, where: `${where} › ${document.name}`, skip: [] });
      }
    }
  };

  for (const target of TARGETS) {
    for (const document of target.collection()?.contents ?? []) addDocument(document, target, "World");
  }

  for (const pack of game.packs ?? []) {
    const target = TARGETS.find(entry => entry.documentName === pack.documentName);
    // System compendiums belong to the system and are never touched.
    if (!target || pack.metadata.packageType === "system") continue;
    if (pack.locked) {
      skippedPacks.push(pack.metadata.label);
      continue;
    }
    for (const document of await pack.getDocuments()) addDocument(document, target, pack.metadata.label);
  }

  return { entries, skippedPacks };
}

/** Rule pages left over from the removed page type (invalid in the journal). */
function collectLegacyRulePages() {
  const found = [];
  for (const journal of game.journal?.contents ?? []) {
    const invalid = [...(journal.pages?.invalidDocuments ?? [])];
    for (const page of invalid) {
      if ((page._source?.type ?? page.type) === LEGACY_RULE_PAGE_TYPE) found.push({ journal, page });
    }
  }
  return found;
}

async function scan() {
  const { entries, skippedPacks } = await collectDocuments();
  const affected = [];
  let total = 0;
  for (const entry of entries) {
    const { changes, count } = changesFor(entry.document, entry.skip);
    if (!count) continue;
    total += count;
    affected.push({ ...entry, changes, count });
  }
  return { affected, total, skippedPacks, legacyPages: collectLegacyRulePages() };
}

async function apply({ affected, legacyPages }, { deletePages }) {
  let updated = 0;
  let deleted = 0;
  const failures = [];

  for (const entry of affected) {
    try {
      await entry.document.update(entry.changes);
      updated += 1;
    } catch (error) {
      console.error("FFXIV TTRPG Layout | Rule cleanup failed", entry.document, error);
      failures.push(entry.document.name);
    }
  }

  if (deletePages) {
    for (const { journal, page } of legacyPages) {
      try {
        await journal.deleteEmbeddedDocuments("JournalEntryPage", [page.id]);
        deleted += 1;
      } catch (error) {
        console.error("FFXIV TTRPG Layout | Rule page could not be deleted", page, error);
        failures.push(`${journal.name} › ${page.name}`);
      }
    }
  }

  return { updated, deleted, failures };
}

/* -------------------------------------------- */
/*  Dialog                                      */
/* -------------------------------------------- */

const escape = value => foundry.utils.escapeHTML(String(value ?? ""));

function buildDialogContent({ affected, total, skippedPacks, legacyPages }) {
  const listed = affected.slice(0, 15)
    .map(entry => `<li>${escape(entry.where)} › ${escape(entry.document.name)} (${entry.count})</li>`)
    .join("");
  const more = affected.length > 15
    ? `<li>${escape(localize("FFXIVTTRPGLayout.RuleMigration.More", { count: affected.length - 15 }))}</li>`
    : "";

  const summary = total
    ? `<p>${escape(localize("FFXIVTTRPGLayout.RuleMigration.Found", { links: total, documents: affected.length }))}</p>
       <ul>${listed}${more}</ul>`
    : `<p>${escape(localize("FFXIVTTRPGLayout.RuleMigration.NoLinks"))}</p>`;

  const skipped = skippedPacks.length
    ? `<p><em>${escape(localize("FFXIVTTRPGLayout.RuleMigration.Locked", { packs: skippedPacks.join(", ") }))}</em></p>`
    : "";

  const pages = legacyPages.length
    ? `<label class="checkbox">
         <input type="checkbox" name="deletePages">
         ${escape(localize("FFXIVTTRPGLayout.RuleMigration.DeletePages", { count: legacyPages.length }))}
       </label>`
    : "";

  return `${summary}${skipped}${pages}
    <p><em>${escape(localize("FFXIVTTRPGLayout.RuleMigration.Backup"))}</em></p>`;
}

async function runRuleMigration() {
  if (!game.user?.isGM) return;
  const { DialogV2 } = foundry.applications.api;

  const result = await scan();
  if (!result.total && !result.legacyPages.length) {
    ui.notifications.info(localize("FFXIVTTRPGLayout.RuleMigration.NothingToDo"));
    return;
  }

  const form = await DialogV2.input({
    window: { title: localize("FFXIVTTRPGLayout.RuleMigration.Title") },
    content: buildDialogContent(result),
    ok: { label: localize("FFXIVTTRPGLayout.RuleMigration.Run"), icon: "fa-solid fa-broom" },
    rejectClose: false,
  });
  if (!form) return;

  const done = await apply(result, { deletePages: form.deletePages === true });
  // Check the result instead of trusting it: count what is left.
  const remaining = (await scan()).total;
  console.info("FFXIV TTRPG Layout | Rule cleanup", { ...done, remaining });
  const problem = done.failures.length > 0 || remaining > 0;
  ui.notifications[problem ? "warn" : "info"](
    localize("FFXIVTTRPGLayout.RuleMigration.Done", {
      updated: done.updated, deleted: done.deleted, failed: done.failures.length, remaining,
    }),
  );
}

/** Settings menu entry: opens the cleanup dialog instead of a window. */
class RuleMigrationMenu extends foundry.applications.api.ApplicationV2 {
  async render() {
    await runRuleMigration();
    return this;
  }
}

/* -------------------------------------------- */
/*  Registration                                */
/* -------------------------------------------- */

export function registerRuleMigration() {
  game.settings.registerMenu(MODULE_ID, "ruleMigration", {
    name: "FFXIVTTRPGLayout.RuleMigration.Name",
    label: "FFXIVTTRPGLayout.RuleMigration.Label",
    hint: "FFXIVTTRPGLayout.RuleMigration.Hint",
    icon: "fa-solid fa-broom",
    type: RuleMigrationMenu,
    restricted: true,
  });

  CONFIG.TextEditor.enrichers.push({
    id: `${MODULE_ID}-rule-fallback`,
    pattern: TEXT_PATTERN,
    enricher: async match => {
      const span = document.createElement("span");
      span.textContent = visibleText(match[1], match[2]);
      return span;
    },
  });
}
