/* Rich-text enrichment */

import { isAbilityType } from "./ability-data.js";
import { watchElement } from "./watch-element.js";

const TextEditor = foundry.applications.ux.TextEditor.implementation;

export async function enrich(content, relativeTo = null, { secrets = relativeTo?.isOwner ?? false, depth = 0 } = {}) {
  const html = await TextEditor.enrichHTML(String(content ?? ""), {
    custom: true,
    documents: true,
    embeds: true,
    links: true,
    rolls: true,
    secrets,
    relativeTo,
    ffxivEmbedDepth: depth,
  });
  return markItemLinks(html);
}

/* -------------------------------------------- */
/*  Ability and Trait links                     */
/* -------------------------------------------- */

const LINK_CLASS = "ffxiv-uuid-link";
const linkKind = type => (isAbilityType(type) ? "ability" : type === "trait" ? "trait" : null);

async function itemType(uuid) {
  try {
    const entry = fromUuidSync(uuid, { strict: false });
    if (entry?.type) return entry.type;
    return (await fromUuid(uuid))?.type ?? "";
  } catch (_error) {
    return "";
  }
}

async function markItemLinksIn(root) {
  if (!root?.querySelectorAll) return false;
  let changed = false;
  for (const link of root.querySelectorAll(`a.content-link[data-type="Item"][data-uuid]:not(.${LINK_CLASS})`)) {
    const kind = linkKind(await itemType(link.dataset.uuid));
    if (!kind) continue;
    link.classList.add(LINK_CLASS, `${LINK_CLASS}--${kind}`);
    for (const attribute of ["data-tooltip", "data-tooltip-text", "data-tooltip-html"]) link.removeAttribute(attribute);
    changed = true;
  }
  return changed;
}

async function markItemLinks(html) {
  if (!html.includes("content-link")) return html;
  const template = document.createElement("template");
  template.innerHTML = html;
  return (await markItemLinksIn(template.content)) ? template.innerHTML : html;
}

export function activateItemLinkMarking() {
  const markNow = root => markItemLinksIn(root)
    .catch(error => console.warn("FFXIV TTRPG Layout | Unable to mark item links", error));
  const mark = (_app, html) => {
    const root = html instanceof HTMLElement ? html : html?.[0];
    markNow(root);
    watchElement(root, "item-links", markNow);
  };
  Hooks.on("renderApplicationV2", mark);
  Hooks.on("renderChatMessageHTML", mark);
}
