/* Babele interface */

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
