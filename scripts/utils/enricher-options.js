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
