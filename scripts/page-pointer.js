/* Page pointer */

import { MODULE_ID } from "./constants.js";
import { isPagePointerEnabled } from "./settings.js";

const POINTER_SRC = `modules/${MODULE_ID}/images/Icons/pointer.webp`;
const POINTER_WIDTH = 37;
const POINTER_HEIGHT = 30;
const TIP_X = 35;
const TIP_Y = 12;
const TIP_GAP = 2;
const POINTER_TRANSITION = "top 180ms cubic-bezier(0.22, 0.61, 0.36, 1), left 180ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 120ms";

const CONTROLLERS = new Set();

export function refreshPagePointers() {
  for (const controller of CONTROLLERS) controller.sync();
}

function requestAllUpdates() {
  for (const controller of CONTROLLERS) controller.scheduleUpdate();
}

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
  #onScroll = () => this.update({ animate: false });
  #onActivate = () => {
    this.scheduleUpdate();
    setTimeout(() => this.scheduleUpdate(), 120);
  };
  #onPointerMove = event => {
    if (event.buttons) this.scheduleUpdate();
  };

  constructor(sheet) {
    this.#sheet = sheet;
    CONTROLLERS.add(this);
  }

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
        width: `${POINTER_WIDTH}px`,
        height: `${POINTER_HEIGHT}px`,
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

    const probeX = rect.left + Math.min(8, rect.width / 2);
    const probeY = rect.top + rect.height / 2;
    const hit = doc.elementFromPoint(probeX, probeY);
    if (!hit || !target.contains(hit)) {
      this.#hide();
      return;
    }

    const left = Math.round(rect.left + TIP_GAP - TIP_X);
    const top = Math.round(rect.top + rect.height / 2 - TIP_Y);

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
    return pageId ? sidebar.querySelector(`[data-page-id="${CSS.escape(pageId)}"]`) : null;
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
