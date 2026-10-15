/**
 * FFXIV TTRPG Layout — page frame helper.
 *
 * The parchment is stretched over the whole pages container, and the two
 * ornament overlays carry a slice of it so that the text fades out under them.
 * CSS cannot read the container size, so it is published here as
 * `--ffxiv-page-w` / `--ffxiv-page-h`.
 */

/**
 * @param {HTMLElement} scroller The `.journal-entry-pages` container.
 * @returns {() => void} Disposer.
 */
export function bindPageFrame(scroller) {
  const publishSize = () => {
    scroller.style.setProperty("--ffxiv-page-w", `${scroller.offsetWidth}px`);
    scroller.style.setProperty("--ffxiv-page-h", `${scroller.offsetHeight}px`);
  };

  const observer = new ResizeObserver(publishSize);
  observer.observe(scroller);
  publishSize();

  return () => observer.disconnect();
}
