/**
 * FFXIV TTRPG Layout — Journal Page Pointer for Foundry VTT V14.
 *
 * The pointer follows the active page entry in the custom journal sidebar.
 * It is optional and controlled through the module settings.
 *
 * The pointer is an image on <body> with a very high z-index, so it would
 * shine through any window above its Journal. Instead of tracking which
 * Journal is in front, every update asks the browser what is really visible
 * at the page entry (`elementFromPoint`): the pointer is shown only when the
 * entry itself is the topmost element there. That covers other Journals,
 * other applications and entries scrolled out of the sidebar.
 */

import { MODULE_ID } from "./constants.js";
import { isPagePointerEnabled } from "./settings.js";

const POINTER_SRC = `modules/${MODULE_ID}/images/Icons/pointer.webp`;
const POINTER_TRANSITION = "top 180ms cubic-bezier(0.22, 0.61, 0.36, 1), left 180ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 120ms";

const CONTROLLERS = new Set();

/** Re-apply the Page Pointer setting to every open Journal sheet. */
export function refreshPagePointers() {
  for (const controller of CONTROLLERS) controller.sync();
}

function requestAllUpdates() {
  for (const controller of CONTROLLERS) controller.scheduleUpdate();
}

// Windows opening or closing change what covers a Journal. The new window
// gets its z-index after rendering, so check once it has settled.
for (const hook of ["renderApplicationV2", "closeApplicationV2"]) {
  Hooks.on(hook, () => setTimeout(requestAllUpdates, 60));
}

export class FFXIVJournalPagePointer {
  #sheet;
  #pointer = null;
  #sidebar = null;
  #raf = 0;
  #visible = false;
  #attached = false;
  #ownerDocument = null;
  #ownerWindow = null;
  #onPosition = () => this.scheduleUpdate();
  #onResize = () => this.scheduleUpdate();
  // Scrolling updates immediately and without gliding, or the pointer trails behind the list.
  #onScroll = () => this.update({ animate: false });
  #onActivate = () => {
    this.scheduleUpdate();
    setTimeout(() => this.scheduleUpdate(), 120);
  };
  // While a mouse button is held, another window may be dragged over this one.
  #onPointerMove = event => {
    if (event.buttons) this.scheduleUpdate();
  };

  constructor(sheet) {
    this.#sheet = sheet;
    CONTROLLERS.add(this);
  }

  /** Attach or remove the pointer according to the current setting. */
  sync() {
    if (isPagePointerEnabled()) this.attach();
    else this.destroy();
  }

  attach() {
    if (!isPagePointerEnabled()) {
      this.destroy();
      return false;
    }

    const sidebar = this.#sheet?.parts?.sidebar;
    if (!sidebar) return false;

    const ownerDocument = sidebar.ownerDocument ?? document;
    const ownerWindow = ownerDocument.defaultView ?? window;

    if (!this.#pointer || this.#pointer.ownerDocument !== ownerDocument) {
      this.#pointer?.remove();
      this.#pointer = ownerDocument.createElement("img");
      this.#pointer.className = "ffxiv-page-pointer";
      this.#pointer.src = POINTER_SRC;
      this.#pointer.alt = "";
      this.#pointer.draggable = false;
      this.#pointer.setAttribute("aria-hidden", "true");
      Object.assign(this.#pointer.style, {
        position: "fixed",
        display: "block",
        width: "53px",
        height: "29px",
        margin: "0",
        padding: "0",
        border: "0",
        background: "transparent",
        pointerEvents: "none",
        userSelect: "none",
        objectFit: "contain",
        opacity: "0",
        visibility: "hidden",
        zIndex: "2147483647",
        filter: "drop-shadow(0 1px 1px rgba(0,0,0,.35))"
      });
      ownerDocument.body.appendChild(this.#pointer);
      this.#visible = false;
    }

    if (this.#attached && this.#sidebar === sidebar && this.#ownerDocument === ownerDocument) {
      this.scheduleUpdate();
      return true;
    }

    this.#detachListeners();
    this.#sidebar = sidebar;
    this.#ownerDocument = ownerDocument;
    this.#ownerWindow = ownerWindow;
    // `scroll` does not bubble; capture also catches the scrolling list inside the sidebar.
    this.#sidebar.addEventListener("scroll", this.#onScroll, { capture: true, passive: true });
    ownerWindow.addEventListener("resize", this.#onResize, { passive: true });
    ownerDocument.addEventListener("pointerdown", this.#onActivate, true);
    ownerDocument.addEventListener("pointermove", this.#onPointerMove, { capture: true, passive: true });
    ownerDocument.addEventListener("focusin", this.#onActivate, true);
    this.#sheet?.addEventListener?.("position", this.#onPosition);

    this.#attached = true;
    this.scheduleUpdate();
    return true;
  }

  destroy() {
    this.#detachListeners();
    cancelAnimationFrame(this.#raf);
    this.#raf = 0;
    this.#pointer?.remove();
    this.#pointer = null;
    this.#visible = false;
  }

  dispose() {
    this.destroy();
    CONTROLLERS.delete(this);
  }

  scheduleUpdate() {
    cancelAnimationFrame(this.#raf);
    this.#raf = requestAnimationFrame(() => {
      this.#raf = 0;
      this.update();
    });
  }

  /**
   * @param {object} [options]
   * @param {boolean} [options.animate=true] Glide to the new position. Never glides
   *   when the pointer was hidden, so it does not fly in from an old place.
   */
  update({ animate = true } = {}) {
    if (!isPagePointerEnabled()) {
      this.#hide();
      return;
    }

    const sidebar = this.#sidebar;
    const pointer = this.#pointer;
    const doc = this.#ownerDocument;
    if (!sidebar || !pointer || !doc) return;

    const target = this.#findActiveTarget(sidebar);
    if (!target) {
      this.#hide();
      return;
    }

    const rect = target.getBoundingClientRect();
    if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top) || rect.width <= 0 || rect.height <= 0) {
      this.#hide();
      return;
    }

    // Only show the pointer when the page entry itself is what the user sees at
    // its position: not scrolled out of the list, not covered by another window.
    const probeX = rect.left + Math.min(8, rect.width / 2);
    const probeY = rect.top + rect.height / 2;
    const hit = doc.elementFromPoint(probeX, probeY);
    if (!hit || !target.contains(hit)) {
      this.#hide();
      return;
    }

    const pointerWidth = pointer.getBoundingClientRect().width || 53;
    const pointerHeight = pointer.getBoundingClientRect().height || 29;
    const left = Math.round(rect.left - pointerWidth + 18);
    const top = Math.round(rect.top + (rect.height - pointerHeight) / 2 + 4);

    pointer.style.transition = animate && this.#visible ? POINTER_TRANSITION : "none";
    pointer.style.left = `${left}px`;
    pointer.style.top = `${top}px`;
    pointer.style.visibility = "visible";
    pointer.style.opacity = "1";
    this.#visible = true;
  }

  #hide() {
    if (!this.#pointer) return;
    this.#pointer.style.transition = "none";
    this.#pointer.style.opacity = "0";
    this.#pointer.style.visibility = "hidden";
    this.#visible = false;
  }

  #findActiveTarget(sidebar) {
    const pageId = this.#sheet?.pageId;

    if (pageId) {
      try {
        const exact = sidebar.querySelector(`[data-page-id="${CSS.escape(pageId)}"]`);
        if (exact) return exact;
      } catch {
        // Fall through to locally managed active state.
      }
    }

    return sidebar.querySelector(".ffxiv-journal__page-item.is-active");
  }

  #detachListeners() {
    if (!this.#attached) return;
    this.#sidebar?.removeEventListener("scroll", this.#onScroll, { capture: true });
    this.#ownerWindow?.removeEventListener("resize", this.#onResize);
    this.#ownerDocument?.removeEventListener("pointerdown", this.#onActivate, true);
    this.#ownerDocument?.removeEventListener("pointermove", this.#onPointerMove, { capture: true });
    this.#ownerDocument?.removeEventListener("focusin", this.#onActivate, true);
    this.#sheet?.removeEventListener?.("position", this.#onPosition);
    this.#sidebar = null;
    this.#ownerDocument = null;
    this.#ownerWindow = null;
    this.#attached = false;
  }
}
