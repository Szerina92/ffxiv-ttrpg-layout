/* Table of Contents tree */

export const TOC_TYPES = Object.freeze(["chapter", "subchapter", "entry"]);

const ALLOWED_PARENT_TYPES = Object.freeze({
  chapter: [],
  subchapter: ["chapter"],
  entry: ["chapter", "subchapter"],
});

export const HEADING_HOST_TYPES = Object.freeze(["chapter", "subchapter"]);

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
    headings: raw.headings === true && HEADING_HOST_TYPES.includes(raw.type),
  };
}

export function resolveParents(entries) {
  const typeByUuid = new Map(entries.map(entry => [entry.uuid, entry.type]));

  return entries.map(entry => {
    const parentType = typeByUuid.get(entry.parent);
    const valid = entry.parent !== entry.uuid && ALLOWED_PARENT_TYPES[entry.type].includes(parentType);
    return { ...entry, parent: valid ? entry.parent : null };
  });
}

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
