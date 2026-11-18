/* Ability and Trait detection */

import { isAutoLinksEnabled } from "../settings.js";
import { isAbilityType } from "./ability-data.js";

const MIN_LENGTH = 3;
const MARK_CLASS = "ffxiv-auto-mark";
const LINK_CLASS = "ffxiv-auto-link";
const SKIP = [
  "a", "button", "input", "textarea", "select", "code", "h1", "h2", "h3", "h4",
  ".inline-roll", ".ffxiv-rule-reference", ".ffxiv-nolink", `.${MARK_CLASS}`,
  ".detail > strong", ".effect > strong", ".ffxiv-class-summary__ability-label",
].join(", ");

const ACTOR_REGIONS = ".ability-details .detail, .ability-effects .effect, .ability-description";
const RULE_SELECTOR = ".ffxiv-rule-reference";
const SUMMARY_REGIONS = ".ffxiv-class-summary__ability-meta .ffxiv-class-summary__ability-value, .ffxiv-class-summary__ability-body, .ffxiv-class-summary__trait-body";

const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const kindOf = type => (isAbilityType(type) ? "ability" : type === "trait" ? "trait" : null);

/* -------------------------------------------- */
/*  Matching                                    */
/* -------------------------------------------- */

function buildMatcher(entries) {
  const byName = new Map();
  const ordered = [...entries].sort((a, b) => Number(b.kind === "trait") - Number(a.kind === "trait"));
  for (const entry of ordered) {
    const name = String(entry.name ?? "").trim();
    if (name.length < MIN_LENGTH || !entry.uuid || !entry.kind || byName.has(name)) continue;
    byName.set(name, { ...entry, name });
  }
  if (!byName.size) return null;

  const names = [...byName.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp);
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${names.join("|")})(?![\\p{L}\\p{N}_])`, "gu");
  return { byName, pattern };
}

function isSkipped(element, region) {
  for (let current = element; current && current !== region; current = current.parentElement) {
    if (current.matches(SKIP)) return true;
  }
  return false;
}

function createLink(entry, text) {
  const link = document.createElement("a");
  link.className = `content-link ffxiv-uuid-link ffxiv-uuid-link--${entry.kind} ${LINK_CLASS}`;
  link.dataset.type = "Item";
  link.dataset.uuid = entry.uuid;
  link.draggable = true;
  link.textContent = text;
  return link;
}

function createMark(entry, text) {
  const mark = document.createElement("span");
  mark.className = `${MARK_CLASS} ${MARK_CLASS}--${entry.kind}`;
  mark.textContent = text;
  return mark;
}

/* -------------------------------------------- */
/*  Text runs                                   */
/* -------------------------------------------- */

const isRuleReference = node => node.nodeType === Node.ELEMENT_NODE && node.matches(RULE_SELECTOR);

function runsOf(parent) {
  const runs = [];
  let run = [];
  for (const node of parent.childNodes) {
    if (node.nodeType === Node.TEXT_NODE || isRuleReference(node)) run.push(node);
    else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);
  return runs;
}

function segmentsOf(run) {
  let position = 0;
  return run.map(node => {
    const text = node.nodeType === Node.TEXT_NODE ? node.nodeValue : node.textContent;
    const segment = { node, text, start: position, end: position + text.length, isRule: node.nodeType !== Node.TEXT_NODE };
    position = segment.end;
    return segment;
  });
}

function acceptedMatches(text, segments, { byName, pattern }) {
  const rules = segments.filter(segment => segment.isRule);
  const matches = [];
  pattern.lastIndex = 0;

  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const entry = byName.get(match[0]);
    const start = match.index;
    const end = start + match[0].length;
    const collides = rules.some(rule => rule.start < end && start < rule.end
      && !(start <= rule.start && rule.end <= end && end - start > rule.end - rule.start));
    if (!entry || collides) {
      pattern.lastIndex = start + 1;
      continue;
    }
    matches.push({ entry, start, end, text: match[0] });
  }
  return matches;
}

function rebuildRun(segments, matches, selfUuid, marksOnly) {
  const pieces = [];
  const pushRange = (from, to) => {
    for (const segment of segments) {
      if (segment.end <= from || segment.start >= to) continue;
      if (segment.isRule) pieces.push(segment.node);
      else pieces.push(segment.text.slice(Math.max(from, segment.start) - segment.start, Math.min(to, segment.end) - segment.start));
    }
  };

  let position = 0;
  for (const match of matches) {
    pushRange(position, match.start);
    pieces.push(marksOnly || match.entry.uuid === selfUuid ? createMark(match.entry, match.text) : createLink(match.entry, match.text));
    position = match.end;
  }
  pushRange(position, Infinity);

  const anchor = document.createTextNode("");
  segments[0].node.before(anchor);
  anchor.after(...pieces.filter(piece => piece !== ""));
  for (const { node } of segments) {
    if (!pieces.includes(node)) node.remove();
  }
  anchor.remove();
}

function linkRegion(region, matcher, selfUuid, { marksOnly = false } = {}) {
  const parents = [region, ...region.querySelectorAll("*")].filter(element => element === region || !isSkipped(element, region));
  for (const parent of parents) {
    for (const run of runsOf(parent)) {
      const segments = segmentsOf(run);
      const text = segments.map(segment => segment.text).join("");
      if (!text.trim()) continue;
      const matches = acceptedMatches(text, segments, matcher);
      if (matches.length) rebuildRun(segments, matches, selfUuid, marksOnly);
    }
  }
}

/* -------------------------------------------- */
/*  Character sheet                             */
/* -------------------------------------------- */

export function linkActorSheet(root, actor) {
  const matcher = buildMatcher(actor.items.map(item => ({ name: item.name, uuid: item.uuid, kind: kindOf(item.type) })));
  if (!matcher) return;

  for (const card of root.querySelectorAll(".ability-card[data-item-id]")) {
    const item = actor.items.get(card.dataset.itemId);
    if (!item) continue;
    for (const region of card.querySelectorAll(ACTOR_REGIONS)) linkRegion(region, matcher, item.uuid);
  }
}

/* -------------------------------------------- */
/*  Class Summary                               */
/* -------------------------------------------- */

export function linkClassSummary(root) {
  if (!isAutoLinksEnabled() || !root) return;

  const cards = [...root.querySelectorAll("[data-ffxiv-card-uuid]")];
  const entries = cards.map(card => ({
    name: card.querySelector("h3")?.textContent,
    uuid: card.dataset.ffxivCardUuid,
    kind: card.dataset.ffxivCardKind,
  }));
  const matcher = buildMatcher(entries);
  if (!matcher) return;

  for (const card of cards) {
    for (const region of card.querySelectorAll(SUMMARY_REGIONS)) linkRegion(region, matcher, card.dataset.ffxivCardUuid, { marksOnly: true });
  }
}
