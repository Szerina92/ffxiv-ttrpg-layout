/**
 * FFXIV TTRPG Layout — NPC Embed "double" layout balancing.
 *
 * In double mode the abilities are split into two columns at a point that
 * minimizes the height difference. This needs real layout measurements, so it
 * only runs once the embed is connected to the document and again on resize.
 */

export function scheduleDoubleBalance(root) {
  // The enricher returns the root before Foundry necessarily inserts it into
  // the live document. Waiting on the disconnected root can therefore miss
  // the real render lifecycle (and leave the extended column empty).
  // Observe document insertions first, then balance once the actual node is
  // connected.
  const tryBalance = () => {
    if (!root.isConnected) return false;
    balanceDoubleAbilities(root);
    installDoubleBalanceObserver(root);
    return true;
  };

  if (tryBalance()) return;

  const host = document.body ?? document.documentElement;
  if (!host) {
    requestAnimationFrame(() => scheduleDoubleBalance(root));
    return;
  }

  const mutationObserver = new MutationObserver(() => {
    if (!tryBalance()) return;
    mutationObserver.disconnect();
  });

  mutationObserver.observe(host, { childList: true, subtree: true });

  // Foundry/ProseMirror can perform insertion work between mutation cycles,
  // so also give the freshly returned node a couple of frame opportunities.
  let attempts = 0;
  const frameAttempt = () => {
    if (tryBalance()) {
      mutationObserver.disconnect();
      return;
    }
    if (++attempts < 12) requestAnimationFrame(frameAttempt);
    else mutationObserver.disconnect();
  };
  requestAnimationFrame(frameAttempt);
}

/**
 * Double mode uses a dynamic split point instead of a fixed ability count.
 * The split preserves ability order and minimizes the total vertical height
 * difference between the two outer columns. Because the right column is
 * narrower, each ability is measured at both final column widths before the
 * best contiguous split is selected.
 */
function balanceDoubleAbilities(root) {
  const layout = root.querySelector('.ffxiv-actor-embed__double-layout');
  const primaryColumn = layout?.querySelector('.ffxiv-actor-embed__ability-column--primary');
  const extendedColumn = layout?.querySelector('.ffxiv-actor-embed__ability-column--extended');
  const primary = layout?.querySelector('.ffxiv-actor-embed__double-primary');
  if (!layout || !primaryColumn || !extendedColumn || !primary) return;

  const blocks = Array.from(layout.querySelectorAll('.ffxiv-actor-embed__ability-block'))
    .sort((a, b) => Number(a.dataset.abilityOrder ?? 0) - Number(b.dataset.abilityOrder ?? 0));

  if (blocks.length <= 1) {
    if (blocks.length === 1) primaryColumn.appendChild(blocks[0]);
    extendedColumn.replaceChildren();
    return;
  }

  // Restore canonical order in the wider primary column before measuring.
  extendedColumn.replaceChildren();
  for (const block of blocks) primaryColumn.appendChild(block);

  const primaryAbilityHeight = primaryColumn.getBoundingClientRect().height;
  const primaryBaseHeight = Math.max(0, primary.getBoundingClientRect().height - primaryAbilityHeight);
  const leftHeights = blocks.map(block => block.getBoundingClientRect().height);

  // Measure the same blocks in the narrower right column so text wrapping is
  // reflected accurately in the balancing calculation.
  extendedColumn.replaceChildren(...blocks);
  const rightHeights = blocks.map(block => block.getBoundingClientRect().height);

  // Restore canonical order in the primary column before applying the split.
  for (const block of blocks) primaryColumn.appendChild(block);

  const leftTotal = leftHeights.reduce((sum, height) => sum + height, 0);
  const rightTotal = rightHeights.reduce((sum, height) => sum + height, 0);
  if (![primaryBaseHeight, leftTotal, rightTotal].every(Number.isFinite)) return;

  let bestSplit = 1;
  let bestDifference = Number.POSITIVE_INFINITY;
  let leftAbilities = 0;
  let rightAbilities = rightTotal;

  for (let split = 1; split < blocks.length; split++) {
    leftAbilities += leftHeights[split - 1];
    rightAbilities -= rightHeights[split - 1];

    const leftHeight = primaryBaseHeight + leftAbilities;
    const rightHeight = rightAbilities;
    const difference = Math.abs(leftHeight - rightHeight);

    if (difference < bestDifference) {
      bestDifference = difference;
      bestSplit = split;
    }
  }

  extendedColumn.replaceChildren();
  for (const [index, block] of blocks.entries()) {
    (index < bestSplit ? primaryColumn : extendedColumn).appendChild(block);
  }

  layout.dataset.doubleSplitIndex = String(bestSplit);
}

function installDoubleBalanceObserver(root) {
  if (typeof ResizeObserver === 'undefined') return;
  if (root.__ffxivDoubleBalanceObserver) return;

  let lastWidth = null;
  let frame = null;
  const observer = new ResizeObserver(() => {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = null;
      if (!root.isConnected) {
        observer.disconnect();
        return;
      }

      const width = root.getBoundingClientRect().width;
      if (!Number.isFinite(width)) return;
      if (lastWidth !== null && Math.abs(width - lastWidth) < 0.5) return;
      lastWidth = width;
      balanceDoubleAbilities(root);
    });
  });

  root.__ffxivDoubleBalanceObserver = observer;
  observer.observe(root);
}
