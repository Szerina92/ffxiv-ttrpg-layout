/**
 * FFXIV TTRPG Layout — Class Summary View Model.
 *
 * This module contains the presentation-ready data for the Class Summary
 * attribute block. The FFXIV Job Item remains the authoritative source.
 *
 * The attribute view model is consumed by the Class Summary renderer and keeps
 * level-specific presentation data separate from raw Item data.
 */

import { localize, localizeOr } from "../i18n.js";

const PRIMARY_ATTRIBUTES = [
  {
    key: "strength",
    abbr: "STR",
    localization: "FFXIV.Attributes.Strength.abbrv",
  },
  {
    key: "dexterity",
    abbr: "DEX",
    localization: "FFXIV.Attributes.Dexterity.abbrv",
  },
  {
    key: "vitality",
    abbr: "VIT",
    localization: "FFXIV.Attributes.Vitality.abbrv",
  },
  {
    key: "intelligence",
    abbr: "INT",
    localization: "FFXIV.Attributes.Intelligence.abbrv",
  },
  {
    key: "mind",
    abbr: "MND",
    localization: "FFXIV.Attributes.Mind.abbrv",
  },
];

const SECONDARY_ATTRIBUTES = [
  {
    key: "defense",
    label: "Defense",
    localization: "FFXIV.Attributes.Defense",
  },
  {
    key: "magic_defense",
    label: "Magic Defense",
    localization: "FFXIV.Attributes.MagicDefense",
  },
  {
    key: "vigilance",
    label: "Vigilance",
    localization: "FFXIV.Attributes.Vigilance",
  },
  {
    key: "speed",
    label: "Speed",
    localization: "FFXIV.Attributes.Speed",
  },
];

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function readNestedValue(source, key) {
  return numberValue(source?.[key]?.value);
}

function formatSignedValue(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return value ?? "";
  return numericValue > 0 ? `+${numericValue}` : `${numericValue}`;
}

/**
 * Build the level-specific attribute View Model for a Job Item.
 *
 * @param {Item} item The FFXIV TTRPG Job Item.
 * @returns {object|null} Presentation-ready attribute data.
 */
export function buildClassSummaryAttributesViewModel(item) {
  if (!item || item.documentName !== "Item" || item.type !== "job") {
    return null;
  }

  const system = item.system ?? {};
  const primarySource = system.primary_attributes ?? {};
  const secondarySource = system.secondary_attributes ?? {};

  const primary = PRIMARY_ATTRIBUTES.map(attribute => ({
    key: attribute.key,
    label: localizeOr(attribute.localization, attribute.abbr),
    abbr: attribute.abbr,
    value: readNestedValue(primarySource, attribute.key),
    displayValue: formatSignedValue(readNestedValue(primarySource, attribute.key)),
  }));

  const secondary = SECONDARY_ATTRIBUTES.map(attribute => ({
    key: attribute.key,
    label: localizeOr(attribute.localization, attribute.label),
    value: readNestedValue(secondarySource, attribute.key),
  }));

  secondary.push({
    key: "max_hp",
    label: localizeOr("FFXIV.Health.max", "Max HP"),
    value: numberValue(system.health?.max),
  });

  return {
    level: numberValue(system.level),
    primary,
    secondary,
    primaryHeading: localize("FFXIVTTRPGLayout.ClassSummary.PrimaryAttributes"),
    secondaryHeading: localize("FFXIVTTRPGLayout.ClassSummary.SecondaryAttributes"),
  };
}
