/* Ability data */

export const ATTRIBUTES = Object.freeze([
  ["STR", "strength"],
  ["DEX", "dexterity"],
  ["VIT", "vitality"],
  ["INT", "intelligence"],
  ["MND", "mind"],
]);

export const CHECK_ABBREVIATIONS = Object.freeze({
  "FFXIV.Attributes.Strength.long": "STR",
  "FFXIV.Attributes.Dexterity.long": "DEX",
  "FFXIV.Attributes.Vitality.long": "VIT",
  "FFXIV.Attributes.Intelligence.long": "INT",
  "FFXIV.Attributes.Mind.long": "MND",
});

export const SPECIAL_CHECK = "FFXIV.Special";

const ABILITY_TYPES = new Set(["ability", "primary_ability", "secondary_ability", "instant_ability"]);
export const isAbilityType = type => ABILITY_TYPES.has(type);
