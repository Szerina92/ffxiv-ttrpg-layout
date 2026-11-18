/* Enricher options */

const EMBED_POSITIONS = Object.freeze(["left", "right", "center"]);

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

export function pickPosition(options, fallback = "center") {
  const lowered = options.map(option => option.toLowerCase());
  return EMBED_POSITIONS.find(position => lowered.includes(position)) ?? fallback;
}

export function normalizePosition(position, fallback = "center") {
  return EMBED_POSITIONS.includes(position) ? position : fallback;
}

export function embedPattern(name) {
  return new RegExp(`@${name}\\[([^\\]\\s]+)([^\\]]*)\\](?:\\{([^}]+)\\})?`, "g");
}

function readEmbedMatch(match) {
  const bracketOptions = String(match[2] ?? "").split(/\s+/).filter(Boolean);
  const { label, options } = parseEnricherOptions(match[3]);
  return { uuid: match[1], label, options: [...bracketOptions, ...options] };
}

/* -------------------------------------------- */
/*  Nested embeds                               */
/* -------------------------------------------- */

const MAX_EMBED_DEPTH = 2;

const MAX_ACTIVE_EMBEDS = 40;
let activeEmbeds = 0;

async function embedLink(uuid, label) {
  let document = null;
  try {
    document = await fromUuid(String(uuid ?? "").trim());
  } catch (_error) {
    document = null;
  }
  return document?.toAnchor?.({ name: label || document.name }) ?? null;
}

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
