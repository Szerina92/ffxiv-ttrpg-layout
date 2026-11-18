/* NPC embed double layout */

export function scheduleDoubleBalance(root) {
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

  extendedColumn.replaceChildren();
  for (const block of blocks) primaryColumn.appendChild(block);

  const primaryAbilityHeight = primaryColumn.getBoundingClientRect().height;
  const primaryBaseHeight = Math.max(0, primary.getBoundingClientRect().height - primaryAbilityHeight);
  const leftHeights = blocks.map(block => block.getBoundingClientRect().height);

  extendedColumn.replaceChildren(...blocks);
  const rightHeights = blocks.map(block => block.getBoundingClientRect().height);

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
