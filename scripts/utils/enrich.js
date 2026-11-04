/** FFXIV TTRPG Layout — shared rich-text enrichment. */

import { stripRuleMacros } from "../rule-migration.js";

const TextEditor = foundry.applications.ux.TextEditor.implementation;

/**
 * Enrich HTML with the option set used throughout this module.
 *
 * @param {string} content Raw HTML.
 * @param {foundry.abstract.Document|null} [relativeTo] Document used to resolve relative links.
 * @param {object} [options]
 * @param {boolean} [options.secrets] Reveal secret blocks. Defaults to the ownership of `relativeTo`,
 *   so GM-only secrets are never shown to players.
 * @returns {Promise<string>}
 */
export function enrich(content, relativeTo = null, { secrets = relativeTo?.isOwner ?? false } = {}) {
  return TextEditor.enrichHTML(stripRuleMacros(String(content ?? "")), {
    custom: true,
    documents: true,
    embeds: true,
    links: true,
    rolls: true,
    secrets,
    relativeTo,
  });
}
