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

/**
 * Build the shared enricher pattern `@Name[uuid option option]{label|option}`.
 * Options may sit inside the brackets (after the UUID) and/or after the label.
 */
export function embedPattern(name) {
  return new RegExp(`@${name}\\[([^\\]\\s]+)([^\\]]*)\\](?:\\{([^}]+)\\})?`, "g");
}

/** Read a match of `embedPattern` into `{uuid, label, options}` (options from both places, in order). */
export function readEmbedMatch(match) {
  const bracketOptions = String(match[2] ?? "").split(/\s+/).filter(Boolean);
  const { label, options } = parseEnricherOptions(match[3]);
  return { uuid: match[1], label, options: [...bracketOptions, ...options] };
}
