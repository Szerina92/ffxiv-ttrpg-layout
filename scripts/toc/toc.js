/**
 * FFXIV TTRPG Layout — Compendium Table of Contents wiring.
 *
 * A Journal compendium whose author flagged pages for the ToC opens in the ToC
 * window instead of the standard compendium window. Authors can switch between
 * both views and open the ToC editor from the window header.
 */

import { MODULE_ID } from "../constants.js";
import { canEditToc, closeTocApplication, openTocApplication, refreshTocApplication, setTocApplicationHandlers } from "./toc-application.js";
import { getTocEntries, isJournalPack, onTocDataChanged, registerTocDataHooks } from "./toc-data.js";
import { openTocEditor } from "./toc-editor.js";

const { Compendium } = foundry.applications.sidebar.apps;

/** Packs the user switched to the standard view for. Not persisted. */
const standardViewPacks = new Set();

/** Open the standard compendium window of a pack without it being redirected to the ToC. */
function showStandardView(pack) {
  standardViewPacks.add(pack.collection);
  closeTocApplication(pack);
  pack.render(true);
}

async function showTocView(pack, app) {
  standardViewPacks.delete(pack.collection);
  await app.close();
  pack.render(true);
}

/** Replace the standard compendium window by the ToC window when the pack has a ToC. */
async function redirectToToc(app) {
  const pack = app.collection;
  if (!isJournalPack(pack) || standardViewPacks.has(pack.collection)) return;
  if (!(await getTocEntries(pack)).length) return;

  // Keep the position of the window that is being replaced, and hide it so it does not flash.
  const { left, top } = app.position;
  app.element.style.display = "none";
  await openTocApplication(pack, { left, top });
  await app.close();
}

/** Offer authors a way back to the ToC view from the standard window. */
function addStandardViewControls(app, controls) {
  if (!(app instanceof Compendium) || !canEditToc() || !isJournalPack(app.collection)) return;
  const pack = app.collection;

  controls.push({
    icon: "fa-solid fa-pen-to-square",
    label: "FFXIVTTRPGLayout.Toc.EditToc",
    action: `${MODULE_ID}-edit-toc`,
    onClick: () => openTocEditor(pack),
  });
  controls.push({
    icon: "fa-solid fa-book-open",
    label: "FFXIVTTRPGLayout.Toc.TocView",
    action: `${MODULE_ID}-toc-view`,
    onClick: () => showTocView(pack, app),
  });
}

export function registerCompendiumToc() {
  setTocApplicationHandlers({ editToc: openTocEditor, showStandardView });
  registerTocDataHooks();
  onTocDataChanged(refreshTocApplication);

  Hooks.on("renderCompendium", app => void redirectToToc(app).catch(error => {
    console.error("FFXIV TTRPG Layout | Compendium ToC: could not open the ToC view", error);
  }));
  Hooks.on("getHeaderControlsCompendium", addStandardViewControls);
}
