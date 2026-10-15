/**
 * FFXIV TTRPG Layout — Rollable Table Embed
 *
 * Syntax: `@FFXIVTable[uuid]{label|left|right|center}`
 *
 * Renders a Foundry RollTable as a table with a roll button. Rolling uses the
 * table's own `draw()`, so chat output, replacement rules and permissions are
 * Foundry's (the result is posted to chat). The drawn rows are highlighted in
 * every embed of that table.
 */

import { localize } from "../i18n.js";
import { normalizePosition, parseEnricherOptions, pickPosition } from "../utils/enricher-options.js";
import { enrich } from "../utils/enrich.js";
import { renderElement } from "../utils/render.js";

const TEMPLATE = "modules/ffxiv-ttrpg-layout/templates/embeds/table-embed.hbs";
const EMBED_SELECTOR = ".ffxiv-table-embed";
const ROLL_SELECTOR = "[data-ffxiv-table-roll]";

const formatRange = ([low, high]) => (low === high ? String(low) : `${low}–${high}`);

/** Font Awesome (free) only ships a d6 and a d20 icon; every other die uses the generic dice icon. */
const DIE_ICONS = Object.freeze({ 6: "fa-dice-d6", 20: "fa-dice-d20" });

/** Die shown on the roll button: "1d6" → "d6", "2d6+1" stays as written. */
function describeFormula(formula) {
  const text = String(formula ?? "").trim().replace(/\s+/g, "");
  const sides = Number(text.match(/d(\d+)/i)?.[1]);
  return { dice: text.replace(/^1(?=d)/i, ""), icon: DIE_ICONS[sides] ?? "fa-dice" };
}

/** HTML of a table result: its name, an optional description, or a link to the referenced document. */
function resultSource(result) {
  const name = String(result.name ?? result.text ?? "").trim();
  const description = String(result.description ?? "").trim();
  const escapedName = foundry.utils.escapeHTML(name);

  const heading = result.documentUuid
    ? `@UUID[${result.documentUuid}]{${name.replace(/[{}\]]/g, "") || result.documentUuid}}`
    : escapedName;

  return [heading, description].filter(Boolean).join(" ");
}

async function buildTableData(table, label) {
  const results = [...table.results.contents].sort((a, b) => a.range[0] - b.range[0]);
  const { dice, icon } = describeFormula(table.formula);

  return {
    uuid: table.uuid,
    name: label || table.name,
    dice,
    diceIcon: icon,
    description: table.description ? await enrich(table.description, table) : "",
    rollLabel: localize("FFXIVTTRPGLayout.Table.Roll"),
    resultLabel: localize("FFXIVTTRPGLayout.Table.Result"),
    results: await Promise.all(results.map(async result => ({
      id: result.id,
      rangeText: formatRange(result.range),
      content: await enrich(resultSource(result), table),
      spent: result.drawn && !table.replacement,
    }))),
  };
}

async function createTableEmbed(uuid, { label, position } = {}) {
  if (typeof uuid !== "string" || !uuid.trim()) return null;

  const table = await fromUuid(uuid.trim());
  if (table?.documentName !== "RollTable") return null;
  if (!table.testUserPermission(game.user, "OBSERVER")) return null;

  const root = await renderElement(TEMPLATE, await buildTableData(table, label));
  if (!root) return null;

  root.classList.add(`ffxiv-table-embed--float-${normalizePosition(position)}`);
  return root;
}

/** Highlight the drawn rows in every visible embed of the table. */
function showDrawResult(table, { results }) {
  const drawnIds = new Set(results.map(result => result.id));

  for (const embed of document.querySelectorAll(EMBED_SELECTOR)) {
    if (embed.dataset.uuid !== table.uuid) continue;

    for (const row of embed.querySelectorAll("tbody tr")) {
      const drawn = drawnIds.has(row.dataset.resultId);
      row.classList.toggle("is-drawn", drawn);
      if (drawn && !table.replacement) row.classList.add("is-spent");
    }
  }
}

async function onRollClick(event) {
  const button = event.target?.closest?.(ROLL_SELECTOR);
  const uuid = button?.closest(EMBED_SELECTOR)?.dataset.uuid;
  if (!uuid) return;

  event.preventDefault();
  event.stopPropagation();
  if (button.disabled) return;

  button.disabled = true;
  try {
    const table = await fromUuid(uuid);
    if (table?.documentName !== "RollTable") throw new Error(`Not a RollTable: ${uuid}`);
    const draw = await table.draw();
    if (draw) showDrawResult(table, draw);
  } catch (error) {
    console.error("FFXIV TTRPG Layout | Could not roll the table", uuid, error);
    ui.notifications.error(localize("FFXIVTTRPGLayout.Table.RollError"));
  } finally {
    button.disabled = false;
  }
}

export function registerTableEmbed() {
  CONFIG.TextEditor.enrichers.push({
    id: "ffxiv-table-embed",
    pattern: /@FFXIVTable\[([^\]\s]+)\](?:\{([^}]+)\})?/g,
    enricher: match => {
      const { label, options } = parseEnricherOptions(match[2]);
      return createTableEmbed(match[1], { label, position: pickPosition(options) });
    },
  });

  // Enriched HTML is serialized, so listeners cannot live on the elements themselves.
  document.addEventListener("click", onRollClick);
}
