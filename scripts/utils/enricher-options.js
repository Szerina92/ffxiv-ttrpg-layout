/** FFXIV TTRPG Layout — shared enricher option parsing. */

const EMBED_POSITIONS = Object.freeze(["left", "right", "center"]);

/**
 * Parse the shared optional enricher syntax: {label|option|option|...}
 *
 * The parser is intentionally semantic-neutral. Consumers decide what the
 * returned options mean.
 *
 * @param {string} rawOptions Raw text from the optional enricher block.
 * @returns {{label: string, options: string[]}}
 */
export function parseEnricherOptions(rawOptions = "") {
  const optionParts = String(rawOptions ?? "").trim()
    ? String(rawOptions).split("|").map(part => part.trim()).filter(Boolean)
    : [];

  const label = optionParts.shift() ?? "";
  return {
    label,
    options: optionParts,
  };
}

/** Return the first float position (left/right/center) named in the options, else `fallback`. */
export function pickPosition(options, fallback = "center") {
  const lowered = options.map(option => option.toLowerCase());
  return EMBED_POSITIONS.find(position => lowered.includes(position)) ?? fallback;
}

/** Restrict a position value to the supported float positions. */
export function normalizePosition(position, fallback = "center") {
  return EMBED_POSITIONS.includes(position) ? position : fallback;
}
