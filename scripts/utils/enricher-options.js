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
function parseEnricherOptions(rawOptions = "") {
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
function readEmbedMatch(match) {
  const bracketOptions = String(match[2] ?? "").split(/\s+/).filter(Boolean);
  const { label, options } = parseEnricherOptions(match[3]);
  return { uuid: match[1], label, options: [...bracketOptions, ...options] };
}

/* -------------------------------------------- */
/*  Nested embeds                               */
/* -------------------------------------------- */

/**
 * Cards may contain cards (an augment showing the ability it grants), one
 * level deep: a card inside a card renders, anything deeper becomes a normal
 * link. That also stops loops such as an item that embeds itself.
 */
export const MAX_EMBED_DEPTH = 2;

/** Safety net in case nesting information is lost on the way (e.g. foreign enrichment). */
const MAX_ACTIVE_EMBEDS = 40;
let activeEmbeds = 0;

/** A plain content link to the document, used where a card would nest too deep. */
async function embedLink(uuid, label) {
  let document = null;
  try {
    document = await fromUuid(String(uuid ?? "").trim());
  } catch (_error) {
    document = null;
  }
  return document?.toAnchor?.({ name: label || document.name }) ?? null;
}

/**
 * Enricher body shared by all Layout embeds. Reads the match, works out the
 * nesting level from the enrichment options and calls
 * `create({ uuid, label, options, depth })`, or returns a link when the card
 * would nest too deep. `depth` is the level of the new card (1 = top level);
 * the card passes it on when it enriches its own text.
 */
export async function enrichEmbed(match, enrichOptions, create) {
  const { uuid, label, options } = readEmbedMatch(match);
  const depth = Number(enrichOptions?.ffxivEmbedDepth ?? 0) + 1;
  if (depth > MAX_EMBED_DEPTH || activeEmbeds >= MAX_ACTIVE_EMBEDS) return embedLink(uuid, label);

  activeEmbeds += 1;
  try {
    return await create({ uuid, label, options, depth });
  } finally {
    activeEmbeds -= 1;
  }
}
