/**
 * FFXIV TTRPG Layout — Table of Contents data access.
 *
 * The ToC of a Journal compendium is defined by the author through the page
 * flag `flags.ffxiv-ttrpg-layout.toc`. Pages without the flag are not listed.
 */

import { MODULE_ID } from "../constants.js";
import { normalizeTocFlag } from "./toc-tree.js";

export const TOC_FLAG_KEY = "toc";

const cache = new Map();
const refreshListeners = new Set();

export const isJournalPack = pack => pack?.documentName === "JournalEntry";

/** The normalized ToC flag of a page, or `null` when the page is not in the ToC. */
export const readTocFlag = page => normalizeTocFlag(page.getFlag(MODULE_ID, TOC_FLAG_KEY));

/** All Journal pages of a compendium, in Journal and page order. */
export async function getPackPages(pack) {
  const journals = (await pack.getDocuments()).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  return journals.flatMap(journal => journal.pages.contents.slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)));
}

/**
 * The ToC entries of a compendium, as flat data. Cached per pack until one of
 * its Journals changes.
 *
 * @param {CompendiumCollection} pack
 * @returns {Promise<Array<{uuid: string, pageName: string, label: string, type: string, parent: string|null, order: number|null, headings: Array<{text: string, occurrence: number}>}>>}
 */
export function getTocEntries(pack) {
  if (!cache.has(pack.collection)) {
    cache.set(pack.collection, loadTocEntries(pack).catch(error => {
      console.warn(`FFXIV TTRPG Layout | Unable to load the ToC of ${pack.collection}`, error);
      cache.delete(pack.collection);
      return [];
    }));
  }
  return cache.get(pack.collection);
}

/**
 * The H2 headings of a text page. `occurrence` counts earlier headings with the
 * same text, so duplicates can be told apart in the rendered page.
 *
 * @param {JournalEntryPage} page
 * @returns {Array<{text: string, occurrence: number}>}
 */
function readH2Headings(page) {
  const html = page.type === "text" ? page.text?.content : "";
  if (!html) return [];

  try {
    const body = new DOMParser().parseFromString(html, "text/html").body;
    const seen = new Map();
    return Object.values(JournalEntryPage.buildTOC(body, { includeElement: false }))
      .filter(heading => heading.level === 2)
      .sort((a, b) => a.order - b.order)
      .map(({ text }) => {
        const occurrence = seen.get(text) ?? 0;
        seen.set(text, occurrence + 1);
        return { text, occurrence };
      });
  } catch (error) {
    console.warn(`FFXIV TTRPG Layout | Unable to read the headings of ${page.uuid}`, error);
    return [];
  }
}

async function loadTocEntries(pack) {
  const entries = [];
  for (const page of await getPackPages(pack)) {
    const flag = readTocFlag(page);
    if (!flag) continue;
    entries.push({
      ...flag,
      headings: flag.headings ? readH2Headings(page) : [],
      uuid: page.uuid,
      pageName: page.name ?? "",
      label: flag.label || page.name || "",
    });
  }
  return entries;
}

/** Register a callback that runs with the pack id whenever a pack's ToC data was invalidated. */
export function onTocDataChanged(listener) {
  refreshListeners.add(listener);
}

function invalidate(packId) {
  if (!packId || !cache.has(packId)) return;
  cache.delete(packId);
  for (const listener of refreshListeners) listener(packId);
}

/** Invalidate the cached ToC data of a compendium. */
export const invalidateTocData = invalidate;

/** Keep the cache in sync with edits to Journals inside compendiums. */
export function registerTocDataHooks() {
  const packOf = document => document.pack ?? document.parent?.pack ?? null;
  for (const hook of [
    "createJournalEntry", "updateJournalEntry", "deleteJournalEntry",
    "createJournalEntryPage", "updateJournalEntryPage", "deleteJournalEntryPage",
  ]) {
    Hooks.on(hook, document => invalidate(packOf(document)));
  }
}
