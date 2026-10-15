/**
 * FFXIV TTRPG Layout — Table of Contents data rules.
 *
 * Pure functions without Foundry dependencies. The author decides which
 * Journal pages appear in the ToC and in which role; nothing is derived
 * automatically from Journal titles or order.
 *
 * Hierarchy:
 *   chapter                      (top level)
 *   └─ subchapter                (parent: a chapter)
 *   └─ entry                     (parent: a chapter or a subchapter)
 */

export const TOC_TYPES = Object.freeze(["chapter", "subchapter", "entry"]);

/** Parent roles each role may be attached to. Chapters are always top level. */
const ALLOWED_PARENT_TYPES = Object.freeze({
  chapter: [],
  subchapter: ["chapter"],
  entry: ["chapter", "subchapter"],
});

/** Roles whose page may list its own H2 headings as entries. */
export const HEADING_HOST_TYPES = Object.freeze(["chapter", "subchapter"]);

/**
 * Normalize the raw ToC flag stored on a page.
 *
 * @param {object|undefined} raw The raw flag value.
 * @returns {{type: string, parent: string|null, label: string, order: number|null, headings: boolean}|null}
 *   `null` when the page is not part of the ToC.
 */
export function normalizeTocFlag(raw) {
  if (!raw || !TOC_TYPES.includes(raw.type)) return null;

  const parent = typeof raw.parent === "string" ? raw.parent.trim() : "";
  const label = typeof raw.label === "string" ? raw.label.trim() : "";
  const order = raw.order === "" || raw.order === null || raw.order === undefined ? NaN : Number(raw.order);

  return {
    type: raw.type,
    parent: parent || null,
    label,
    order: Number.isFinite(order) ? order : null,
    // Only chapters and subchapters can list the H2 headings of their page as entries.
    headings: raw.headings === true && HEADING_HOST_TYPES.includes(raw.type),
  };
}

/**
 * Drop parent references that violate the hierarchy (unknown target, wrong role,
 * the page itself). Such entries are shown at the top level instead of vanishing.
 *
 * @param {Array<{uuid: string, type: string, parent: string|null}>} entries
 * @returns {Array} The entries, with invalid parents set to `null`.
 */
export function resolveParents(entries) {
  const typeByUuid = new Map(entries.map(entry => [entry.uuid, entry.type]));

  return entries.map(entry => {
    const parentType = typeByUuid.get(entry.parent);
    const valid = entry.parent !== entry.uuid && ALLOWED_PARENT_TYPES[entry.type].includes(parentType);
    return { ...entry, parent: valid ? entry.parent : null };
  });
}

/** Parent roles a page of the given role may choose from. */
export function allowedParentTypes(type) {
  return ALLOWED_PARENT_TYPES[type] ?? [];
}

function sorter(collator) {
  return (a, b) => {
    if (a.order !== null && b.order !== null && a.order !== b.order) return a.order - b.order;
    if (a.order !== null && b.order === null) return -1;
    if (a.order === null && b.order !== null) return 1;
    return collator.compare(a.label, b.label) || collator.compare(a.uuid, b.uuid);
  };
}

/**
 * Build the render tree from the flagged pages.
 *
 * Top level: chapters, followed by one group for everything that has no valid
 * chapter to belong to (`otherGroup`), so nothing the author flagged is hidden.
 *
 * @param {Array<{uuid: string, label: string, type: string, parent: string|null, order: number|null}>} entries
 * @param {{collator?: Intl.Collator}} [options]
 * @returns {{chapters: object[], otherGroup: object|null}}
 */
export function buildTocTree(entries, { collator = new Intl.Collator() } = {}) {
  const sortFn = sorter(collator);
  const resolved = resolveParents(entries);

  const childrenOf = parentUuid => resolved
    .filter(entry => entry.parent === parentUuid)
    .sort(sortFn);

  const makeGroup = (entry, children) => ({
    uuid: entry?.uuid ?? null,
    label: entry?.label ?? "",
    headings: entry?.headings ?? [],
    entries: children.filter(child => child.type === "entry"),
    subchapters: children
      .filter(child => child.type === "subchapter")
      .map(sub => ({ ...sub, entries: childrenOf(sub.uuid).filter(child => child.type === "entry") })),
  });

  const chapters = resolved
    .filter(entry => entry.type === "chapter")
    .sort(sortFn)
    .map(chapter => makeGroup(chapter, childrenOf(chapter.uuid)));

  const orphans = resolved.filter(entry => entry.type !== "chapter" && entry.parent === null).sort(sortFn);
  const otherGroup = orphans.length
    ? {
        uuid: null,
        label: "",
        headings: [],
        entries: orphans.filter(entry => entry.type === "entry"),
        subchapters: orphans
          .filter(entry => entry.type === "subchapter")
          .map(sub => ({ ...sub, entries: childrenOf(sub.uuid).filter(child => child.type === "entry") })),
      }
    : null;

  return { chapters, otherGroup };
}
