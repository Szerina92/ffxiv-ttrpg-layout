/**
 * FFXIV TTRPG Layout — optional Babele interface.
 *
 * The Layout ships no translations. It only tells Babele how to read and
 * write its own content, so any translation module, or a folder set in
 * Babele's settings, can translate it:
 *
 * - `class-summary` pages keep their text in `system.introduction`
 * - the Table of Contents label is a module flag on the page
 *
 * The mapping is global and uses Babele's default document identity (ID,
 * name, source ID). Rules are no longer part of the Layout; the system
 * provides them.
 */

import { CLASS_SUMMARY_PAGE_TYPE, MODULE_ID } from "./constants.js";

Hooks.once("babele.init", babele => {
  babele.registerMapping({
    JournalEntryPage: {
      tocLabel: `flags.${MODULE_ID}.toc.label`,
      _variants: [
        { _when: { path: "type", equals: CLASS_SUMMARY_PAGE_TYPE }, introduction: "system.introduction" },
      ],
    },
  });
});
