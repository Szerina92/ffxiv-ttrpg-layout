import { CLASS_SUMMARY_PAGE_TYPE, MODULE_ID, RULE_PAGE_TYPE } from "./constants.js";

const RULE_KEY_EXTRACTOR = "ffxivRuleKey";

Hooks.once("babele.init", babele => {
  babele.registerIdentityExtractor(RULE_KEY_EXTRACTOR, page => {
    const key = page?.system?.key;
    return typeof key === "string" && key.trim() ? key.trim() : null;
  });

  babele.registerMapping({
    JournalEntryPage: {
      _identity: {
        export: [RULE_KEY_EXTRACTOR, "name", "_id", "id"],
        match: [RULE_KEY_EXTRACTOR, "_id", "name", "sourceId"],
      },
      tocLabel: `flags.${MODULE_ID}.toc.label`,
      _variants: [
        { _when: { path: "type", equals: RULE_PAGE_TYPE }, content: "system.content" },
        { _when: { path: "type", equals: CLASS_SUMMARY_PAGE_TYPE }, introduction: "system.introduction" },
      ],
    },
  });
});
