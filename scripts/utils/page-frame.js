/* Page frame */

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
