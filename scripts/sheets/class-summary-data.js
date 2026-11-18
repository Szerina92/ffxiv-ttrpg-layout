/* Class Summary data */

import { buildClassSummaryAttributesViewModel } from "./class-summary-view-model.js";
import { localize, localizeTags } from "../i18n.js";
import { getComboKeys, getContentKeys, getSourceText } from "../utils/content-keys.js";
import { defensePattern } from "../utils/defense-terms.js";
import { enrich } from "../utils/enrich.js";
import { numberOr, text } from "../utils/values.js";
import { ATTRIBUTES, CHECK_ABBREVIATIONS, isAbilityType, SPECIAL_CHECK } from "../utils/ability-data.js";

const JOB_ALIASES = Object.freeze({
  bard: { names: ["bard", "barde"], abbreviation: "brd" },
  monk: { names: ["monk", "moench", "mönch", "moine"], abbreviation: "mnk" },
  ninja: { names: ["ninja"], abbreviation: "nin" },
});

function isJob(jobItem, jobKey) {
  const { names, abbreviation } = JOB_ALIASES[jobKey];
  const namePattern = new RegExp(`\\b(?:${names.join("|")})\\b`, "i");

  return [jobItem?.name, jobItem?.system?.job_name, getSourceText(jobItem, "name"), getSourceText(jobItem, "job_name")]
    .map(text)
    .filter(Boolean)
    .some(value => namePattern.test(value) || value.toLowerCase().replace(/[^a-z]/g, "") === abbreviation);
}

function hasTag(item, tag) {
  const tags = item?.system?.tags;
  return Array.isArray(tags) && tags.includes(`FFXIV.Tags.${tag}`);
}

const CHECK_ATTRIBUTE_KEYS = new Map(ATTRIBUTES);

function normalizeCheck(value) {
  const normalized = text(value);
  if (!normalized || normalized.toLowerCase() === "none") return "";
  if (normalized === SPECIAL_CHECK) return localize("FFXIV.Special");
  return CHECK_ABBREVIATIONS[normalized] ?? normalized;
}

function getCheckModifier(jobSystem, check) {
  const attributeKey = CHECK_ATTRIBUTE_KEYS.get(text(check).toUpperCase());
  if (!attributeKey) return null;

  const rawValue = jobSystem?.primary_attributes?.[attributeKey]?.value;
  const modifier = Number(rawValue);
  return Number.isFinite(modifier) ? modifier : null;
}

function formatCheckModifier(modifier) {
  if (modifier === null || modifier === undefined || modifier === "") return "";
  const value = Number(modifier);
  if (!Number.isFinite(value)) return "";
  const operator = value < 0 ? "-" : "+";
  return `(d20 ${operator} ${Math.abs(value)})`;
}

function formatChallengeParts(value) {
  const normalized = text(value);
  if (!normalized) return [];

  const parts = [];
  const pattern = defensePattern();
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
  if (tags.includes("FFXIV.Tags.Primary")) return "Primary";
  if (tags.includes("FFXIV.Tags.Secondary")) return "Secondary";
  if (tags.includes("FFXIV.Tags.Instant")) return "Instant";
  return "";
}

function buildAbilityComboGroups(abilities) {
  const entries = Array.isArray(abilities) ? abilities : [];
  if (!entries.length) return [];

  const byKey = new Map();
  for (const ability of entries) {
    for (const key of ability?.contentKeys ?? []) {
      if (!byKey.has(key)) byKey.set(key, ability);
    }
  }

  const childrenByParent = new Map();
  const children = new Set();

  for (const ability of entries) {
    const parent = (ability?.comboKeys ?? []).map(key => byKey.get(key)).find(Boolean);
    if (!parent || parent === ability) continue;

    if (!childrenByParent.has(parent)) childrenByParent.set(parent, []);
    childrenByParent.get(parent).push(ability);
    children.add(ability);
  }

  const attachChildren = ability => {
    const kids = childrenByParent.get(ability) ?? [];
    return {
      ...ability,
      comboChildren: kids.map(attachChildren),
      hasComboChildren: kids.length > 0,
    };
  };

  return entries
    .filter(ability => !children.has(ability))
    .map(attachChildren);
}

function estimateAbilityHeight(ability) {
  if (!ability) return 0;

  const textLengths = [
    ability.trigger,
    [ability.target, ability.range].filter(Boolean).join(" "),
    [ability.check, ability.challenge].filter(Boolean).join(" CR: "),
    ability.baseEffect,
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

function estimateTraitHeight(trait) {
  if (!trait) return 0;

  const body = [trait.description, trait.baseEffect].filter(Boolean).join(" ");
  const bodyLines = body
    ? Math.max(1, Math.ceil(String(body).length / 58))
    : 0;
  const titleLines = Math.max(1, Math.ceil(String(trait.name ?? "").length / 30));

  return 38 + (titleLines - 1) * 16 + 8 + bodyLines * 16;
}

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

export function tidyRichText(html) {
  if (!html) return html;

  const template = document.createElement("template");
  template.innerHTML = html;
  const content = template.content;

  const isBlank = node => node.nodeType === Node.TEXT_NODE
    ? !node.textContent.trim()
    : node.nodeName === "P" && !node.textContent.trim() && !node.querySelector("img, video, iframe");

  while (content.firstChild && isBlank(content.firstChild)) content.firstChild.remove();
  while (content.lastChild && isBlank(content.lastChild)) content.lastChild.remove();

  const first = content.firstChild;
  if (first?.nodeName === "P") first.replaceWith(...Array.from(first.childNodes));

  return template.innerHTML;
}

async function enrichRichText(value, document, depth = 0) {
  const normalized = text(value);
  if (!normalized) return "";

  try {
    return tidyRichText(await enrich(normalized, document, { depth }));
  } catch (error) {
    console.warn("FFXIV TTRPG Layout | Unable to enrich Class Summary rich text", error);
    return normalized;
  }
}

function buildCheckModifier(rawCheck, jobItem, jobSystem) {
  if (text(rawCheck) === SPECIAL_CHECK) return "";
  const check = normalizeCheck(rawCheck);
  if (!check) return "";
  const modifier = getCheckModifier(jobSystem, check);
  if (modifier !== null) return formatCheckModifier(modifier);
  if (!jobItem && CHECK_ATTRIBUTE_KEYS.has(check.toUpperCase())) return `(d20 + ${check})`;
  return "";
}

async function normalizeAbility(grant, item, jobItem, depth = 0) {
  const system = item?.system ?? {};
  const jobSystem = jobItem?.system ?? {};
  const tags = Array.isArray(system.tags) ? system.tags : [];
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
    checkModifier: buildCheckModifier(system.check, jobItem, jobSystem),
    challenge: text(system.challenge),
    challengeParts: formatChallengeParts(system.challenge),
    trigger: text(system.trigger),
    baseEffect: await enrichRichText(system.base_effect, item, depth),
    combo: text(system.combo),
    contentKeys: getContentKeys(item),
    comboKeys: getComboKeys(item),
    directHit: await enrichRichText(system.direct_hit, item, depth),
    limitations: text(system.limitations),
    markerArea: text(system.marker_area),
    markerTrigger: text(system.marker_trigger),
    markerEffect: await enrichRichText(system.marker_effect, item, depth),
    condition: await enrichRichText(system.condition, item, depth),
    description: await enrichRichText(system.description, item, depth),
  };
}

async function normalizeTrait(grant, item, depth = 0) {
  const system = item?.system ?? {};
  const tags = Array.isArray(system.tags) ? system.tags : [];
  const labels = localizeTags(tags);
  return {
    uuid: grant?.uuid ?? item?.uuid ?? "",
    name: text(item?.name ?? grant?.name),
    img: text(item?.img),
    description: await enrichRichText(system.description, item, depth),
    baseEffect: await enrichRichText(system.base_effect, item, depth),
    typeLabel: labels.join(", "),
  };
}

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

export async function buildPetCardData(actor, { depth = 0 } = {}) {
  if (!actor || actor.documentName !== "Actor" || actor.type !== "pet") return null;

  const system = actor.system ?? {};
  const traitsHTML = await enrichRichText(system.traits, actor, depth);
  const abilities = [];

  for (const child of Array.from(actor.items ?? [])) {
    if (!isAbilityType(child?.type)) continue;
    const ability = await buildAbilityCardData(child, actor, { depth });
    if (ability) abilities.push(ability);
  }

  const speedValue = text(system.speed?.value);
  const speedUnit = text(system.speed?.unit) || localize("FFXIVTTRPGLayout.NPC.Squares");

  return {
    uuid: actor.uuid ?? "",
    actorType: actor.type,
    name: text(actor.name),
    petLabel: localize("FFXIV.ActorType.pet"),
    speedText: speedValue
      ? `${localize("FFXIV.Attributes.Speed")}: ${speedValue} ${speedUnit}`
      : "",
    traits: traitsHTML,
    abilities,
    hasTraits: Boolean(traitsHTML),
    hasAbilities: abilities.length > 0,
  };
}

export async function buildTraitCardData(item, { depth = 0 } = {}) {
  if (!item || item.documentName !== "Item" || item.type !== "trait") return null;
  return normalizeTrait({ uuid: item.uuid, name: item.name }, item, depth);
}

export async function buildAbilityCardData(item, contextDocument = null, { depth = 0 } = {}) {
  if (!item || item.documentName !== "Item" || !isAbilityType(item.type)) return null;
  return normalizeAbility({ uuid: item.uuid, name: item.name }, item, contextDocument, depth);
}

async function resolveJobFromUuid(uuid) {
  if (typeof uuid !== "string" || !uuid.trim()) return null;

  const item = await fromUuid(uuid.trim());
  if (!item || item.documentName !== "Item" || item.type !== "job") return null;
  return item;
}

async function resolveGrantItem(grant) {
  let item = null;
  try {
    item = await fromUuid(grant.uuid);
  } catch (_error) {
    item = null;
  }
  if (item) return item;

  const key = getContentKeys(grant?.item ?? grant)[0];
  const collection = String(grant.uuid).split(".").slice(1, 3).join(".");
  const pack = String(grant.uuid).startsWith("Compendium.") ? game.packs.get(collection) : null;
  if (!key || pack?.documentName !== "Item") return null;

  const matches = (await pack.getIndex()).filter(entry => getContentKeys(entry).includes(key));
  return matches.length === 1 ? pack.getDocument(matches[0]._id) : null;
}

async function buildClassSummaryData(item) {
  if (!item || item.documentName !== "Item" || item.type !== "job") return null;

  const system = item.system ?? {};
  const grants = Array.isArray(system.ability_grants) ? system.ability_grants : [];

  const resolved = await Promise.all(grants.map(async grant => {
    if (grant?.item) return { grant, item: grant.item };
    if (!grant?.uuid) return { grant, item: null };

    try {
      return { grant, item: await resolveGrantItem(grant) };
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
    petsSectionLabel: localize("FFXIV.CharacterSheet.Pets"),
    hasPets: pets.length > 0,
  };
}

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
