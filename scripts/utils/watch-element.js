/* Watch element */

const watched = new WeakMap();

export function watchElement(root, key, callback) {
  if (!(root instanceof HTMLElement)) return;
  let keys = watched.get(root);
  if (!keys) watched.set(root, keys = new Set());
  if (keys.has(key)) return;
  keys.add(key);

  let frame = 0;
  new MutationObserver(() => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (root.isConnected) callback(root);
    });
  }).observe(root, { childList: true, subtree: true });
}
