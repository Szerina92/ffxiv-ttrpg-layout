/**
 * FFXIV TTRPG Layout — Class Summary data adapter.
 *
 * Converts FFXIV Job and Pet data into presentation-ready view models used by
 * the Class Summary and the Pet Card. The source documents remain authoritative.
 */

import { buildClassSummaryAttributesViewModel } from "./class-summary-view-model.js";
import { localize, localizeTags } from "../i18n.js";
import { enrich } from "../utils/enrich.js";
import { numberOr, text } from "../utils/values.js";

/** Name variants (English/German) and the abbreviation used to recognise special Jobs. */
const JOB_ALIASES = Object.freeze({
  bard: { names: ["bard", "barde"], abbreviation: "brd" },
  monk: { names: ["monk", "moench", "mönch"], abbreviation: "mnk" },
  ninja: { names: ["ninja"], abbreviation: "nin" },
});

function isJob(jobItem, jobKey) {
  const { names, abbreviation } = JOB_ALIASES[jobKey];
  const namePattern = new RegExp(`\\b(?:${names.join("|")})\\b`, "i");

  return [jobItem?.name, jobItem?.system?.job_name]
    .map(text)
    .filter(Boolean)
    .some(value => namePattern.test(value) || value.toLowerCase().replace(/[^a-z]/g, "") === abbreviation);
}

function hasTag(item, tag) {
  const tags = item?.system?.tags;
  return Array.isArray(tags) && tags.includes(`FFXIV.Tags.${tag}`);
}

const CHECK_ATTRIBUTE_ABBREVIATIONS = new Map([
  ["FFXIV.Attributes.Strength.long", "STR"],
  ["FFXIV.Attributes.Dexterity.long", "DEX"],
  ["FFXIV.Attributes.Vitality.long", "VIT"],
  ["FFXIV.Attributes.Intelligence.long", "INT"],
  ["FFXIV.Attributes.Mind.long", "MND"],
]);

const SPECIAL_CHECK = "FFXIV.Special";

const CHECK_ATTRIBUTE_KEYS = new Map([
  ["STR", "strength"],
  ["DEX", "dexterity"],
  ["VIT", "vitality"],
  ["INT", "intelligence"],
  ["MND", "mind"],
]);

function normalizeCheck(value) {
  const normalized = text(value);
  if (!normalized || normalized.toLowerCase() === "none") return "";
  if (normalized === SPECIAL_CHECK) return localize("FFXIVTTRPGLayout.Ability.Special");
  return CHECK_ATTRIBUTE_ABBREVIATIONS.get(normalized) ?? normalized;
}

function getCheckModifier(jobSystem, check) {
  const attributeKey = CHECK_ATTRIBUTE_KEYS.get(text(check).toUpperCase());
  if (!attributeKey) return null;

  const rawValue = jobSystem?.primary_attributes?.[attributeKey]?.value;
  const modifier = Number(rawValue);
  return Number.isFinite(modifier) ? modifier : null;
}

function formatCheckModifier(modifier) {
  const value = Number(modifier);
  if (!Number.isFinite(value)) return "";
  const operator = value < 0 ? "-" : "+";
  return `(d20 ${operator} ${Math.abs(value)})`;
}

function formatChallengeParts(value) {
  const normalized = text(value);
  if (!normalized) return [];

  const parts = [];
  const pattern = /Magic Defense|Defense/g;
  let cursor = 0;
  let match;

  while ((match = pattern.exec(normalized)) !== null) {
    if (match.index > cursor) {
      parts.push({ text: normalized.slice(cursor, match.index), highlight: false });
    }

    parts.push({ text: match[0], highlight: true });
    cursor = match.index + match[0].length;
  }

  if (cursor < normalized.length) {
    parts.push({ text: normalized.slice(cursor), highlight: false });
  }

  return parts;
}

function abilityTypeFromTags(tags) {
  if (!Array.isArray(tags)) return "";
  if (tags.includes("FFXIV.Tags.Primary")) return localize("FFXIVTTRPGLayout.Item.Primary");
  if (tags.includes("FFXIV.Tags.Secondary")) return localize("FFXIVTTRPGLayout.Item.Secondary");
  if (tags.includes("FFXIV.Tags.Instant")) return localize("FFXIVTTRPGLayout.Item.Instant");
  return "";
}

/**
 * Convert the flat ability list from the Job Item into combo trees.
 *
 * The FFXIV system stores the prerequisite as `system.combo` using the
 * prerequisite ability's name (for example `Dragoon Combo ...` has
 * `combo: "True Thrust"`). The Job Item remains authoritative; this helper
 * only builds presentation groups for the Class Summary renderer.
 */
function buildAbilityComboGroups(abilities) {
  const entries = Array.isArray(abilities) ? abilities : [];
  if (!entries.length) return [];

  const byName = new Map();
  for (const ability of entries) {
    const name = text(ability?.name);
    if (!name || byName.has(name)) continue;
    byName.set(name, ability);
  }

  const childrenByParent = new Map();
  const childNames = new Set();

  for (const ability of entries) {
    const parentName = text(ability?.combo);
    if (!parentName) continue;

    const parent = byName.get(parentName);
    if (!parent || parent === ability) continue;

    if (!childrenByParent.has(parentName)) childrenByParent.set(parentName, []);
    childrenByParent.get(parentName).push(ability);
    childNames.add(ability.name);
  }

  const attachChildren = ability => {
    const children = childrenByParent.get(ability.name) ?? [];
    return {
      ...ability,
      comboNames: children.map(child => child.name),
      comboChildren: children.map(attachChildren),
      hasComboChildren: children.length > 0,
    };
  };

  // Only abilities without a valid combo parent remain at the root level.
  // This prevents a combo child from also appearing as an independent card.
  return entries
    .filter(ability => !childNames.has(ability.name))
    .map(attachChildren);
}

/**
 * Estimate the rendered height of an ability tree. This is intentionally
 * approximate: it is only used to distribute the root ability groups across
 * two visual columns so a tall combo chain does not create a large empty
 * area beside it. The actual card remains fully content-driven in CSS.
 */
function estimateAbilityHeight(ability) {
  if (!ability) return 0;

  const textLengths = [
    ability.trigger,
    [ability.target, ability.range].filter(Boolean).join(" "),
    [ability.check, ability.challenge].filter(Boolean).join(" CR: "),
    ability.baseEffect,
    ability.comboNames?.join(" or "),
    ability.directHit,
    ability.limitations,
    ability.markerArea,
    ability.markerTrigger,
    ability.markerEffect,
    ability.condition,
    ability.description,
  ].filter(Boolean);

  const bodyLines = textLengths.reduce(
    (total, value) => total + Math.max(1, Math.ceil(String(value).length / 58)),
    0,
  );

  const titleLines = Math.max(1, Math.ceil(String(ability.name ?? "").length / 28));
  let height = 44 + (titleLines - 1) * 16 + 8 + bodyLines * 16;

  for (const child of ability.comboChildren ?? []) {
    height += 10 + estimateAbilityHeight(child);
  }

  return height;
}

/**
 * Arrange root ability groups into two balanced columns. Combo trees stay
 * together as one group, while unrelated abilities are packed into the
 * currently shorter column. This keeps the existing two-column presentation
 * without the large holes created when a combo tree becomes taller than its
 * neighbours.
 */
function buildAbilityComboColumns(abilities) {
  const groups = buildAbilityComboGroups(abilities);
  if (groups.length <= 1) return groups.length ? [groups] : [];

  const columns = [[], []];
  const heights = [0, 0];

  for (const group of groups) {
    const target = heights[0] <= heights[1] ? 0 : 1;
    columns[target].push(group);
    heights[target] += estimateAbilityHeight(group) + 10;
  }

  return columns.filter(column => column.length);
}

/**
 * Estimate the rendered height of a Trait / Other Effect card. This mirrors
 * the lightweight balancing used for Ability sections: the source order is
 * preserved, while cards are distributed into the currently shorter column.
 */
function estimateTraitHeight(trait) {
  if (!trait) return 0;

  const body = [trait.description, trait.baseEffect].filter(Boolean).join(" ");
  const bodyLines = body
    ? Math.max(1, Math.ceil(String(body).length / 58))
    : 0;
  const titleLines = Math.max(1, Math.ceil(String(trait.name ?? "").length / 30));

  return 38 + (titleLines - 1) * 16 + 8 + bodyLines * 16;
}

/**
 * Arrange Traits & Other Effects in the same two-column, height-balanced
 * presentation used by the other Class Summary sections.
 */
function buildTraitColumns(traits) {
  const entries = Array.isArray(traits) ? traits : [];
  if (entries.length <= 1) return entries.length ? [entries] : [];

  const columns = [[], []];
  const heights = [0, 0];

  for (const trait of entries) {
    const target = heights[0] <= heights[1] ? 0 : 1;
    columns[target].push(trait);
    heights[target] += estimateTraitHeight(trait) + 10;
  }

  return columns.filter(column => column.length);
}

function isLimitBreak(grant, item) {
  const tags = item?.system?.tags ?? [];
  return grant?.type === "limit_break"
    || tags.includes("FFXIV.ItemType.limit_break")
    || text(grant?.name).startsWith("Limit Break:");
}

async function enrichRichText(value, document) {
  const normalized = text(value);
  if (!normalized) return "";

  try {
    return await enrich(normalized, document);
  } catch (error) {
    console.warn("FFXIV TTRPG Layout | Unable to enrich Class Summary rich text", error);
    return normalized;
  }
}

async function normalizeAbility(grant, item, jobItem) {
  const system = item?.system ?? {};
  const jobSystem = jobItem?.system ?? {};
  const tags = Array.isArray(system.tags) ? system.tags : [];
  // Keep every tag supplied by the source Item. There is intentionally no
  // whitelist here: the FFXIV system can introduce additional tags without
  // requiring a Layout update.
  const typeLabels = localizeTags(tags);

  return {
    uuid: grant?.uuid ?? item?.uuid ?? "",
    cardType: "ability",
    isItem: false,
    name: text(item?.name ?? grant?.name),
    img: text(item?.img),
    type: abilityTypeFromTags(tags),
    tags: [...tags],
    typeLabels,
    typeLabel: typeLabels.join(", "),
    cost: text(system.cost),
    target: text(system.target),
    range: text(system.range),
    check: normalizeCheck(system.check),
    isSpecialCheck: text(system.check) === SPECIAL_CHECK,
    checkDisplay: text(system.check) === SPECIAL_CHECK ? localize("FFXIVTTRPGLayout.Ability.SpecialCheck") : normalizeCheck(system.check),
    checkModifier: text(system.check) === SPECIAL_CHECK
      ? ""
      : formatCheckModifier(getCheckModifier(jobSystem, normalizeCheck(system.check))),
    challenge: text(system.challenge),
    challengeParts: formatChallengeParts(system.challenge),
    trigger: text(system.trigger),
    baseEffect: await enrichRichText(system.base_effect, item),
    combo: text(system.combo),
    comboNames: [],
    directHit: await enrichRichText(system.direct_hit, item),
    limitations: text(system.limitations),
    markerArea: text(system.marker_area),
    markerTrigger: text(system.marker_trigger),
    markerEffect: await enrichRichText(system.marker_effect, item),
    condition: await enrichRichText(system.condition, item),
    description: await enrichRichText(system.description, item),
  };
}

async function normalizeTrait(grant, item) {
  const system = item?.system ?? {};
  const tags = Array.isArray(system.tags) ? system.tags : [];
  const labels = localizeTags(tags);
  return {
    uuid: grant?.uuid ?? item?.uuid ?? "",
    name: text(item?.name ?? grant?.name),
    img: text(item?.img),
    description: await enrichRichText(system.description, item),
    baseEffect: await enrichRichText(system.base_effect, item),
    typeLabel: labels.join(", "),
  };
}

/**
 * Normalize an individual FFXIV ability Item for reuse outside the Class
 * Summary. The Item remains the authoritative source; callers only provide
 * the optional context document used for check modifiers.
 */

/**
 * Build the shared Pet Card view model used both by standalone Pet Embeds and
 * by the Class Summary Pets section. The resolved Actor remains the
 * authoritative source; its embedded Ability Items are converted through the
 * same Unified Card data path used everywhere else.
 */
function estimatePetHeight(pet) {
  if (!pet) return 0;

  const traitText = text(pet.traits).replace(/<[^>]+>/g, " ").trim();
  const traitLines = traitText
    ? Math.max(1, Math.ceil(traitText.length / 62))
    : 0;
  const titleLines = Math.max(1, Math.ceil(String(pet.name ?? "").length / 28));
  const abilityLines = (pet.abilities ?? []).reduce((total, ability) => {
    if (!ability) return total;
    const metaText = [ability.target, ability.range, ability.check, ability.challenge]
      .filter(Boolean)
      .join(" ");
    const bodyText = [ability.baseEffect, ability.directHit, ability.limitations]
      .filter(Boolean)
      .join(" ")
      .replace(/<[^>]+>/g, " ")
      .trim();
    return total
      + Math.max(1, Math.ceil(metaText.length / 62)) * 14
      + Math.max(1, Math.ceil(bodyText.length / 62)) * 14;
  }, 0);

  return 56 + (titleLines - 1) * 16 + traitLines * 16 + abilityLines + (pet.abilities?.length ?? 0) * 12 + 16;
}

function buildPetColumns(pets) {
  const entries = Array.isArray(pets) ? pets : [];
  if (entries.length <= 1) return entries.length ? [entries] : [];

  const columns = [[], []];
  const heights = [0, 0];

  for (const pet of entries) {
    const target = heights[0] <= heights[1] ? 0 : 1;
    columns[target].push(pet);
    heights[target] += estimatePetHeight(pet) + 10;
  }

  return columns.filter(column => column.length);
}

export async function buildPetCardData(actor) {
  if (!actor || actor.documentName !== "Actor" || actor.type !== "pet") return null;

  const system = actor.system ?? {};
  const traitsHTML = await enrichRichText(system.traits, actor);
  const abilities = [];

  for (const child of Array.from(actor.items ?? [])) {
    if (child?.type !== "ability") continue;
    const ability = await buildAbilityCardData(child, actor);
    if (ability) abilities.push(ability);
  }

  const speedValue = text(system.speed?.value);
  const speedUnit = text(system.speed?.unit) || localize("FFXIVTTRPGLayout.NPC.Squares");

  return {
    uuid: actor.uuid ?? "",
    actorType: actor.type,
    name: text(actor.name),
    petLabel: localize("FFXIVTTRPGLayout.Pet.Type"),
    speedText: speedValue
      ? `${localize("FFXIVTTRPGLayout.NPC.Speed")}: ${speedValue} ${speedUnit}`
      : "",
    traits: traitsHTML,
    abilities,
    hasTraits: Boolean(traitsHTML),
    hasAbilities: abilities.length > 0,
  };
}

export async function buildAbilityCardData(item, contextDocument = null) {
  if (!item || item.documentName !== "Item" || item.type !== "ability") return null;
  return normalizeAbility({ uuid: item.uuid, name: item.name }, item, contextDocument);
}

async function resolveJobFromUuid(uuid) {
  if (typeof uuid !== "string" || !uuid.trim()) return null;

  const item = await fromUuid(uuid.trim());
  if (!item || item.documentName !== "Item" || item.type !== "job") return null;
  return item;
}

async function buildClassSummaryData(item) {
  if (!item || item.documentName !== "Item" || item.type !== "job") return null;

  const system = item.system ?? {};
  const grants = Array.isArray(system.ability_grants) ? system.ability_grants : [];

  const resolved = await Promise.all(grants.map(async grant => {
    if (grant?.item) return { grant, item: grant.item };
    if (!grant?.uuid) return { grant, item: null };

    try {
      return { grant, item: await fromUuid(grant.uuid) };
    } catch (error) {
      console.warn("FFXIV TTRPG Layout | Unable to resolve Job ability grant", grant?.uuid, error);
      return { grant, item: null };
    }
  }));

  const limitBreak = [];
  const primaryAbilities = [];
  const secondaryAbilities = [];
  const instantAbilities = [];
  const songAbilities = [];
  const traits = [];
  const bardJob = isJob(item, "bard");
  const monkJob = isJob(item, "monk");
  const techniqueAbilities = [];
  const ninjaJob = isJob(item, "ninja");
  const ninjutsuAbilities = [];

  for (const { grant, item: abilityItem } of resolved) {
    if (!abilityItem) continue;

    if (grant?.type === "trait" || abilityItem.type === "trait") {
      traits.push(await normalizeTrait(grant, abilityItem));
      continue;
    }

    if (isLimitBreak(grant, abilityItem)) {
      limitBreak.push(await normalizeAbility(grant, abilityItem, item));
      continue;
    }

    const ability = await normalizeAbility(grant, abilityItem, item);
    if (bardJob && hasTag(abilityItem, "Song")) {
      songAbilities.push(ability);
      continue;
    }

    if (monkJob && hasTag(abilityItem, "Technique")) {
      techniqueAbilities.push(ability);
      continue;
    }

    if (ninjaJob && hasTag(abilityItem, "Ninjutsu")) {
      ninjutsuAbilities.push(ability);
      continue;
    }

    if (ability.type === "Primary") primaryAbilities.push(ability);
    else if (ability.type === "Secondary") secondaryAbilities.push(ability);
    else if (ability.type === "Instant") instantAbilities.push(ability);
  }

  const hasPets = system.has_pets === true || system.has_pets === "true";
  const petGrants = Array.isArray(system.pet_grants) ? system.pet_grants : [];
  const pets = [];

  if (hasPets) {
    const seenPetUuids = new Set();
    for (const grant of petGrants) {
      const uuid = text(grant?.uuid);
      if (!uuid || seenPetUuids.has(uuid)) continue;
      seenPetUuids.add(uuid);

      try {
        const pet = await fromUuid(uuid);
        const petData = await buildPetCardData(pet);
        if (petData) pets.push(petData);
      } catch (error) {
        console.warn("FFXIV TTRPG Layout | Unable to resolve Job pet grant", uuid, error);
      }
    }
  }

  return {
    uuid: item.uuid,
    name: text(system.job_name) || text(item.name),
    level: numberOr(system.level, null),
    role: text(system.role),
    img: text(item.img),
    attributes: buildClassSummaryAttributesViewModel(item),
    limitBreak,
    primaryAbilities: buildAbilityComboColumns(primaryAbilities),
    secondaryAbilities: buildAbilityComboColumns(secondaryAbilities),
    instantAbilities: buildAbilityComboColumns(instantAbilities),
    songAbilities: buildAbilityComboColumns(songAbilities),
    hasSongAbilities: songAbilities.length > 0,
    techniqueAbilities: buildAbilityComboColumns(techniqueAbilities),
    hasTechniqueAbilities: techniqueAbilities.length > 0,
    ninjutsuAbilities: buildAbilityComboColumns(ninjutsuAbilities),
    hasNinjutsuAbilities: ninjutsuAbilities.length > 0,
    traits: buildTraitColumns(traits),
    pets: buildPetColumns(pets),
    petsSectionLabel: localize("FFXIVTTRPGLayout.ClassSummary.Pets"),
    hasPets: pets.length > 0,
  };
}

/**
 * Build the Class Summary context shared by the Journal view and the page sheet.
 *
 * @param {JournalEntryPage} page The Class Summary page.
 * @param {object} [options]
 * @param {boolean} [options.includeSummary=true] Build the full Class Summary for the active Job.
 *   The edit view only needs the Job list and therefore skips this.
 */
export async function buildClassSummaryPageContext(page, { includeSummary = true } = {}) {
  const { jobUuids, currentJobUuid: activeJobUuid, introduction } = page.system;

  const selectedJobs = (await Promise.all(jobUuids.map(async uuid => {
    const item = await resolveJobFromUuid(uuid);
    if (!item) return null;
    return {
      uuid: item.uuid,
      name: text(item.system?.job_name || item.name),
      level: numberOr(item.system?.level, null),
      img: text(item.img),
    };
  }))).filter(Boolean);

  let classSummary = null;
  if (includeSummary) {
    const sourceItem = await resolveJobFromUuid(activeJobUuid);
    classSummary = sourceItem ? await buildClassSummaryData(sourceItem) : null;
  }

  return {
    pageId: page.id,
    classSummary,
    hasSource: Boolean(classSummary),
    introductionHTML: introduction ? await enrich(introduction, page) : "",
    jobUuids,
    activeJobUuid,
    selectedJobs,
    hasSelectedJobs: selectedJobs.length > 0,
    hasMultipleJobs: selectedJobs.length > 1,
  };
}
