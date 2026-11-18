/* Table of Contents setup */

import { MODULE_ID } from "../constants.js";
import { canEditToc, closeTocApplication, openTocApplication, refreshTocApplication, setTocApplicationHandlers } from "./toc-application.js";
import { getTocEntries, isJournalPack, onTocDataChanged, registerTocDataHooks } from "./toc-data.js";
import { openTocEditor } from "./toc-editor.js";

const { Compendium } = foundry.applications.sidebar.apps;

const standardViewPacks = new Set();

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

async function redirectToToc(app) {
  const pack = app.collection;
  if (!isJournalPack(pack) || standardViewPacks.has(pack.collection)) return;
  if (!(await getTocEntries(pack)).length) return;

  const { left, top } = app.position;
  app.element.style.display = "none";
  await openTocApplication(pack, { left, top });
  await app.close();
}

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
