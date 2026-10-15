/** FFXIV TTRPG Layout — context shared by the custom JournalEntryPage sheets. */

function sortedCategories(journal) {
  const categories = journal?.categories?.contents;
  if (!Array.isArray(categories)) return [];

  const sorter = foundry.documents.JournalEntry.sortCategories;
  return [...categories]
    .sort((a, b) => typeof sorter === "function"
      ? sorter(a, b)
      : String(a?.name ?? "").localeCompare(String(b?.name ?? "")))
    .map(category => ({
      id: String(category?.id ?? ""),
      name: String(category?.name ?? "").trim(),
    }))
    .filter(category => category.id && category.name);
}

/**
 * Page title, heading level and category data used by the native page controls.
 * Categories belong to the parent JournalEntry and are referenced by id.
 *
 * @param {foundry.applications.sheets.journal.JournalEntryPageSheet} sheet
 * @param {string} noCategoryLabel Localized label of the empty category option.
 */
export function buildPageControlsContext(sheet, noCategoryLabel) {
  const page = sheet.page;
  const categories = sortedCategories(page?.parent);
  const pageCategory = String(page?.category ?? "").trim();

  return {
    pageTitleShow: page?.title?.show ?? true,
    pageTitleLevel: Number(page?.title?.level ?? 1) || 1,
    headingLevels: Object.entries(sheet._prepareHeadingLevels?.() ?? {})
      .map(([value, label]) => ({ value: Number(value), label: String(label) })),
    pageCategory,
    noCategoryLabel,
    isUncategorized: !pageCategory,
    categories,
    hasCategories: categories.length > 0,
  };
}
