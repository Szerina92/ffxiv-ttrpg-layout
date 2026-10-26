/**
 * FFXIV TTRPG Layout — NPC / Actor Embed
 * Renders `@FFXIVActor[uuid]{label|left|right|center|double}` as an NPC stat block.
 */

import { localize } from "../i18n.js";
import { isMarkerRendererEnabled } from "../settings.js";
import { buildAbilityCardData } from "../sheets/class-summary-data.js";
import { embedPattern, normalizePosition, pickPosition, readEmbedMatch } from "../utils/enricher-options.js";
import { enrich } from "../utils/enrich.js";
import { renderElement } from "../utils/render.js";
import { numberOr, text } from "../utils/values.js";
import { scheduleDoubleBalance } from "./npc-embed-balance.js";
import { buildMarkerGraphics } from "./npc-embed-marker.js";

const TEMPLATE = "modules/ffxiv-ttrpg-layout/templates/embeds/npc-embed.hbs";

const PRIMARY_STATS = [
  ["STR", "strength"],
  ["DEX", "dexterity"],
  ["VIT", "vitality"],
  ["INT", "intelligence"],
  ["MND", "mind"],
];

const NPC_SIZE_GRIDS = { small: "1x1", medium: "1x1", large: "2x2", huge: "3x3", colossal: "4x4" };

const ABILITY_CHECK_ABBREVIATIONS = {
  "FFXIV.Attributes.Strength.long": "STR",
  "FFXIV.Attributes.Dexterity.long": "DEX",
  "FFXIV.Attributes.Vitality.long": "VIT",
  "FFXIV.Attributes.Intelligence.long": "INT",
  "FFXIV.Attributes.Mind.long": "MND",
};

/* -------------------------------------------- */
/*  Small formatters                            */
/* -------------------------------------------- */

function getNpcSizeGrid(sizeValue, actor) {
  const size = text(sizeValue).toLowerCase();
  if (NPC_SIZE_GRIDS[size]) return NPC_SIZE_GRIDS[size];

  const { width, height } = actor?.prototypeToken ?? {};
  return Number.isFinite(width) && Number.isFinite(height) ? `${width}x${height}` : "";
}

function formatAbilityCheck(value) {
  const check = text(value);
  return ABILITY_CHECK_ABBREVIATIONS[check] ?? check;
}

/** Split a CR value so that "Defense" / "Magic Defense" can be highlighted. */
function formatCrValue(value) {
  const crText = text(value);
  if (!crText) return null;

  return crText
    .split(/(Magic Defense|Defense)/)
    .filter(Boolean)
    .map(part => ({ text: part, highlight: part === "Magic Defense" || part === "Defense" }));
}

function getActorAbilityGroup(item) {
  switch (item?.type) {
    case "primary_ability": return "primary";
    case "secondary_ability": return "secondary";
    case "instant_ability": return "instant";
    case "ability": break;
    default: return null;
  }

  const tags = Array.isArray(item.system?.tags) ? item.system.tags : [];
  if (tags.includes("FFXIV.Tags.Primary")) return "primary";
  if (tags.includes("FFXIV.Tags.Secondary")) return "secondary";
  if (tags.includes("FFXIV.Tags.Instant")) return "instant";
  return null;
}

/* -------------------------------------------- */
/*  Ability detail lines                        */
/* -------------------------------------------- */

const detailPart = (label, value, extra = {}) => ({ label, value, rich: false, separator: false, ...extra });

async function appendRichTextLine(lines, label, content, relativeTo = null) {
  const html = text(content);
  if (!html) return;

  const enriched = await enrich(html, relativeTo);

  // The NPC Embed places this rich value inside an existing <p>.
  // Foundry's enrichment may return one or more block-level <p>/<div>
  // elements. Nesting those directly inside another <p> causes the browser
  // to repair the invalid HTML, which separates the value onto a new line
  // and introduces the apparent indentation/margin seen in the NPC card.
  // Flatten the top-level block wrappers while retaining their inline HTML.
  const wrapper = document.createElement("div");
  wrapper.innerHTML = String(enriched ?? "");

  const parts = [];
  for (const node of wrapper.childNodes) {
    if (node.nodeType === Node.ELEMENT_NODE && ["P", "DIV"].includes(node.tagName)) {
      const inner = node.innerHTML.trim();
      if (inner) parts.push(inner);
    } else if (node.nodeType === Node.TEXT_NODE) {
      const value = node.textContent?.trim();
      if (value) parts.push(value);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      parts.push(node.outerHTML);
    }
  }

  const inlineValue = parts.join("<br>");
  if (inlineValue) lines.push({ parts: [detailPart(label, inlineValue, { rich: true })] });
}

async function buildAbilityDetailData(item, { checkModifier = "" } = {}) {
  const system = item?.system ?? {};
  const lines = [];

  const addLine = (label, value) => {
    const content = text(value);
    if (content) lines.push({ parts: [detailPart(label, content)] });
  };

  // Two values share one line, separated visually when both are present.
  const addPairLine = (first, second) => {
    const parts = [first, second].filter(part => part.value);
    parts.forEach((part, index) => { part.separator = index > 0; });
    if (parts.length) lines.push({ parts });
  };

  const target = text(system.target);
  const range = text(system.range);
  addPairLine(
    detailPart(localize("FFXIV.Abilities.Target"), target),
    detailPart(localize("FFXIV.Abilities.Range"), range),
  );

  const check = text(formatAbilityCheck(system.check));
  const challenge = text(system.challenge);
  addPairLine(
    detailPart(localize("FFXIV.Abilities.Check"), check, {
      valueClass: "ffxiv-actor-embed__ability-value--blue-dark",
      checkModifier,
    }),
    detailPart(localize("FFXIV.Abilities.Challenge"), challenge, { crValue: formatCrValue(challenge) }),
  );

  addLine(localize("FFXIVTTRPGLayout.NPC.Origin"), system.origin);
  addLine(localize("FFXIV.Abilities.MarkerArea"), system.marker_area);
  addLine(localize("FFXIV.Abilities.MarkerTrigger"), system.marker_trigger);
  await appendRichTextLine(lines, localize("FFXIV.Abilities.MarkerEffect"), system.marker_effect, item);
  await appendRichTextLine(lines, localize("FFXIV.Abilities.BaseEffect"), system.base_effect, item);
  await appendRichTextLine(lines, localize("FFXIV.Abilities.DirectHit"), system.direct_hit, item);
  await appendRichTextLine(lines, localize("FFXIVTTRPGLayout.NPC.Limitations"), system.limitations, item);

  const statuses = Array.isArray(system.status_effects) ? system.status_effects.filter(Boolean) : [];
  if (statuses.length) addLine(localize("FFXIVTTRPGLayout.NPC.StatusEffects"), statuses.join(", "));
  addLine(localize("FFXIV.Abilities.StatusEffect"), system.status_effect);

  return lines;
}

/* -------------------------------------------- */
/*  Embed data                                  */
/* -------------------------------------------- */

/**
 * Build the template data of an NPC embed.
 * Also returns the source ability Items per group, which the marker renderer needs.
 */
async function buildActorEmbedData(actor, { double = false } = {}) {
  const system = actor.system ?? {};
  const primary = system.primary_attributes ?? {};
  const secondary = system.secondary_attributes ?? {};
  const size = text(system.size);
  const specie = text(system.specie);
  const sizeGrid = getNpcSizeGrid(system.size, actor);

  const traits = [];
  const sourceGroups = { primary: [], secondary: [], instant: [] };

  for (const item of Array.from(actor.items ?? [])) {
    if (item?.type === "trait") {
      const description = text(item.system?.description);
      traits.push({ name: item.name ?? "", descriptionHtml: description ? await enrich(description, item) : "" });
      continue;
    }
    if (item?.type === "limit_break") continue;

    const group = getActorAbilityGroup(item);
    if (group) sourceGroups[group].push(item);
  }

  const abilityGroups = [];
  const doubleAbilityItems = [];

  for (const [key, sourceItems] of Object.entries(sourceGroups)) {
    const items = [];
    for (const [index, item] of sourceItems.entries()) {
      const card = await buildAbilityCardData(item, actor);
      if (!card) continue;

      const itemData = {
        ...card,
        typeLabel: card.typeLabel ?? "",
        abilityDetail: await buildAbilityDetailData(item, { checkModifier: card.checkModifier }),
        index,
        groupKey: key,
        doubleOrder: doubleAbilityItems.length,
      };
      items.push(itemData);
      doubleAbilityItems.push({ ...itemData });
    }
    abilityGroups.push({ key, items });
  }

  const data = {
    uuid: actor.uuid,
    actorType: actor.type,
    name: actor.name ?? "",
    sizeText: size ? `${localize("FFXIV.CharacterSheet.Size")}: ${size}${sizeGrid ? ` (${sizeGrid})` : ""}` : "",
    specieText: specie ? ` - ${specie}` : "",
    vigilance: numberOr(secondary.vigilance?.value, 0),
    leftProperties: [
      { label: localize("FFXIV.Attributes.Defense"), value: numberOr(secondary.defense?.value, 0) },
      { label: localize("FFXIV.Health.max"), value: numberOr(system.health?.max, 0) },
    ],
    rightProperties: [
      { label: localize("FFXIV.Attributes.MagicDefense"), value: numberOr(secondary.magic_defense?.value, 0) },
      {
        label: localize("FFXIV.Attributes.Speed"),
        value: `${numberOr(secondary.speed?.value, 0)} ${text(secondary.speed?.unit) || localize("FFXIVTTRPGLayout.NPC.Squares")}`,
      },
    ],
    primaryStats: PRIMARY_STATS.map(([label, key]) => {
      const value = numberOr(primary[key]?.value, 0);
      return { label, value: value >= 0 ? `+${value}` : `${value}` };
    }),
    traits,
    abilityGroups,
    doubleAbilityItems,
    doublePrimaryAbilities: doubleAbilityItems.slice(0, 2),
    doubleExtendedAbilities: doubleAbilityItems.slice(2),
    hasAbilities: abilityGroups.some(group => group.items.length > 0),
    isDouble: double,
  };

  return { data, sourceGroups };
}

/** Append the experimental marker graphics to the rendered ability blocks. */
function addMarkerGraphics(root, abilityGroups, sourceGroups, actor) {
  for (const group of abilityGroups) {
    sourceGroups[group.key].forEach((item, index) => {
      const block = root.querySelector(
        `[data-ability-group="${CSS.escape(group.key)}"] [data-ability-index="${index}"]`,
      );
      if (block) block.append(...buildMarkerGraphics(item, actor));
    });
  }
}

export async function createActorEmbed(uuid, { label, position, double = false } = {}) {
  if (typeof uuid !== "string" || !uuid.trim()) return null;

  const actor = await fromUuid(uuid.trim());
  // This subsystem renders NPC Actors only.
  // Pet Actors are handled exclusively by pet-embed.js / @FFXIVPet.
  if (actor?.documentName !== "Actor" || actor.type !== "npc") return null;

  const { data, sourceGroups } = await buildActorEmbedData(actor, { double });
  const root = await renderElement(TEMPLATE, data);
  if (!root) return null;

  if (label) root.dataset.label = label;
  root.classList.add(double ? "ffxiv-actor-embed--double" : `ffxiv-actor-embed--float-${normalizePosition(position)}`);

  // Experimental marker graphics are optional and controlled by a module setting.
  if (isMarkerRendererEnabled()) addMarkerGraphics(root, data.abilityGroups, sourceGroups, actor);

  if (double && data.doubleAbilityItems.length > 1) scheduleDoubleBalance(root);
  return root;
}

export function registerNPCEmbed() {
  CONFIG.TextEditor.enrichers.push({
    id: "ffxiv-actor-embed",
    pattern: embedPattern("FFXIVActor"),
    enricher: match => {
      const { uuid, label, options } = readEmbedMatch(match);
      const double = options.some(option => option.toLowerCase() === "double");
      return createActorEmbed(uuid, { label, position: double ? "center" : pickPosition(options), double });
    },
  });
}
