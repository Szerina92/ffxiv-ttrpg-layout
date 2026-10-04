/**
 * FFXIV TTRPG Layout — Experimental Journal Page Pointer for Foundry VTT V14.
 *
 * The pointer follows the active page entry in the custom journal sidebar.
 * It is optional and controlled through the module settings.
 *
 * Multiple open Journal windows are handled by comparing their actual
 * ApplicationV2 frame z-index in the current document. The pointer never
 * relies exclusively on ApplicationV2.frontApp, because this custom sheet
 * is a DocumentSheetV2 implementation with its own rendered page structure.
 */

const MODULE_ID = "ffxiv-ttrpg-layout";
const SETTING_KEY = "experimentalPagePointer";
const POINTER_TRANSITION = "top 180ms cubic-bezier(0.22, 0.61, 0.36, 1), left 180ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 120ms";

const CONTROLLERS = new Set();
let FRONT_CONTROLLER = null;

export function registerPagePointerSetting() {
  game.settings.register(MODULE_ID, SETTING_KEY, {
    name: "FFXIVTTRPGLayout.Settings.ExperimentalPagePointer",
    hint: "FFXIVTTRPGLayout.Settings.ExperimentalPagePointerHint",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: enabled => Hooks.callAll("ffxiv-page-pointer-setting-changed", Boolean(enabled))
  });
}

export function isPagePointerEnabled() {
  return game.settings.get(MODULE_ID, SETTING_KEY) === true;
}

export { SETTING_KEY as pagePointerSettingKey };

function requestAllUpdates() {
  for (const controller of CONTROLLERS) controller.scheduleUpdate();
}

function setFrontController(controller) {
  FRONT_CONTROLLER = controller;
  requestAllUpdates();
}

export class FFXIVJournalPagePointer {
  #sheet;
  #pointer = null;
  #sidebar = null;
  #raf = 0;
  #attached = false;
  #ownerDocument = null;
  #ownerWindow = null;
  #onPosition = () => this.scheduleUpdate();
  #onResize = () => this.scheduleUpdate();
  #onScroll = () => this.scheduleUpdate();
  #onActivate = event => this.#handleActivation(event);
  #onSettingChanged = enabled => {
    if (enabled) this.attach();
    else this.destroy();
  };

  constructor(sheet) {
    this.#sheet = sheet;
    CONTROLLERS.add(this);
    Hooks.on("ffxiv-page-pointer-setting-changed", this.#onSettingChanged);
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
      this.#pointer.className = "ffxiv-experimental-page-pointer";
      this.#pointer.src = "modules/ffxiv-ttrpg-layout/images/Icons/pointer.webp";
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
        transition: POINTER_TRANSITION,
        filter: "drop-shadow(0 1px 1px rgba(0,0,0,.35))"
      });
      ownerDocument.body.appendChild(this.#pointer);
    }

    if (this.#attached && this.#sidebar === sidebar && this.#ownerDocument === ownerDocument) {
      this.scheduleUpdate();
      return true;
    }

    this.#detachListeners();
    this.#sidebar = sidebar;
    this.#ownerDocument = ownerDocument;
    this.#ownerWindow = ownerWindow;
    this.#sidebar.addEventListener("scroll", this.#onScroll, { passive: true });
    ownerWindow.addEventListener("resize", this.#onResize, { passive: true });
    ownerDocument.addEventListener("pointerdown", this.#onActivate, true);
    ownerDocument.addEventListener("focusin", this.#onActivate, true);
    this.#sheet?.addEventListener?.("position", this.#onPosition);

    this.#attached = true;

    // Establish an initial front controller from the current ApplicationV2
    // stacking order without depending on ApplicationV2.frontApp identity.
    if (!FRONT_CONTROLLER || !this.#hasRenderedApplicationAboveCurrent()) {
      FRONT_CONTROLLER = this.#findFrontControllerForDocument(ownerDocument);
    }

    this.scheduleUpdate();
    return true;
  }

  destroy() {
    this.#detachListeners();
    cancelAnimationFrame(this.#raf);
    this.#raf = 0;
    this.#pointer?.remove();
    this.#pointer = null;
    if (FRONT_CONTROLLER === this) {
      FRONT_CONTROLLER = null;
      requestAllUpdates();
    }
  }

  dispose() {
    this.destroy();
    CONTROLLERS.delete(this);
    Hooks.off("ffxiv-page-pointer-setting-changed", this.#onSettingChanged);
    if (FRONT_CONTROLLER === this) FRONT_CONTROLLER = null;
  }

  scheduleUpdate() {
    cancelAnimationFrame(this.#raf);
    this.#raf = requestAnimationFrame(() => {
      this.#raf = 0;
      this.update();
    });
  }

  update() {
    if (!isPagePointerEnabled()) {
      this.#hide();
      return;
    }

    const sidebar = this.#sidebar;
    const pointer = this.#pointer;
    if (!sidebar || !pointer) return;

    const frontController = this.#getFrontController();
    if (frontController && frontController !== this) {
      this.#hide(false);
      return;
    }

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

    const pointerWidth = pointer.getBoundingClientRect().width || 53;
    const pointerHeight = pointer.getBoundingClientRect().height || 29;
    const left = Math.round(rect.left - pointerWidth + 18);
    const top = Math.round(rect.top + (rect.height - pointerHeight) / 2 + 4);

    pointer.style.left = `${left}px`;
    pointer.style.top = `${top}px`;
    pointer.style.visibility = "visible";
    pointer.style.opacity = "1";
  }

  #handleActivation(event) {
    if (!isPagePointerEnabled()) return;

    const target = event?.target;
    if (!(target instanceof this.#ownerWindow?.Element ?? Element)) return;

    for (const controller of CONTROLLERS) {
      const element = controller.#sheet?.element;
      if (!element || !element.isConnected) continue;
      if (element.contains(target)) {
        FRONT_CONTROLLER = controller;
        controller.#sheet?.bringToFront?.();
        requestAllUpdates();
        return;
      }
    }

    // A click on another ApplicationV2 (or elsewhere in the UI) means no
    // Journal pointer should be considered front-most until a Journal is
    // activated again. Actual z-index inspection below also protects against
    // overlapping non-Journal applications.
    const application = target?.closest?.(".application");
    if (application && ![...CONTROLLERS].some(controller => controller.#sheet?.element?.contains?.(application))) {
      FRONT_CONTROLLER = null;
      requestAllUpdates();
    }
  }

  #getFrontController() {
    const doc = this.#ownerDocument;
    if (!doc) return null;

    const localControllers = [...CONTROLLERS].filter(controller =>
      controller.#ownerDocument === doc && controller.#sheet?.element?.isConnected && controller.#pointer
    );
    if (!localControllers.length) return null;

    // Explicit activation wins immediately. This avoids waiting for Foundry's
    // own z-index bookkeeping after a click between overlapping windows.
    if (FRONT_CONTROLLER && localControllers.includes(FRONT_CONTROLLER)) {
      const frontElement = FRONT_CONTROLLER.#sheet?.element;
      if (frontElement && this.#isLikelyTopApplication(frontElement, doc)) return FRONT_CONTROLLER;
    }

    return this.#findFrontControllerForDocument(doc, localControllers);
  }

  #findFrontControllerForDocument(doc, controllers = null) {
    const candidates = controllers ?? [...CONTROLLERS].filter(controller =>
      controller.#ownerDocument === doc && controller.#sheet?.element?.isConnected && controller.#pointer
    );
    if (!candidates.length) return null;

    let best = null;
    let bestZ = -Infinity;
    let bestIndex = -1;

    for (const controller of candidates) {
      const element = controller.#sheet?.element;
      if (!element) continue;
      const frame = element.closest?.(".application") ?? element;
      const z = Number.parseInt(doc.defaultView?.getComputedStyle(frame).zIndex ?? "0", 10);
      const resolvedZ = Number.isFinite(z) ? z : 0;
      const index = [...doc.querySelectorAll(".application")].indexOf(frame);
      if (resolvedZ > bestZ || (resolvedZ === bestZ && index > bestIndex)) {
        best = controller;
        bestZ = resolvedZ;
        bestIndex = index;
      }
    }

    if (best) FRONT_CONTROLLER = best;
    return best;
  }

  #hasRenderedApplicationAboveCurrent() {
    const doc = this.#ownerDocument;
    const element = this.#sheet?.element;
    if (!doc || !element) return false;
    const currentFrame = element.closest?.(".application") ?? element;
    const currentZ = Number.parseInt(doc.defaultView?.getComputedStyle(currentFrame).zIndex ?? "0", 10);
    for (const app of doc.querySelectorAll(".application")) {
      if (app === currentFrame) continue;
      const z = Number.parseInt(doc.defaultView?.getComputedStyle(app).zIndex ?? "0", 10);
      if (Number.isFinite(z) && Number.isFinite(currentZ) && z > currentZ) return true;
    }
    return false;
  }

  #isLikelyTopApplication(element, doc) {
    const frame = element.closest?.(".application") ?? element;
    const z = Number.parseInt(doc.defaultView?.getComputedStyle(frame).zIndex ?? "0", 10);
    if (!Number.isFinite(z)) return true;
    for (const app of doc.querySelectorAll(".application")) {
      if (app === frame) continue;
      const otherZ = Number.parseInt(doc.defaultView?.getComputedStyle(app).zIndex ?? "0", 10);
      if (Number.isFinite(otherZ) && otherZ > z) return false;
    }
    return true;
  }

  #hide(animated = true) {
    if (!this.#pointer) return;
    if (!animated) this.#pointer.style.transition = "none";
    this.#pointer.style.opacity = "0";
    this.#pointer.style.visibility = "hidden";
    if (!animated) {
      requestAnimationFrame(() => {
        if (this.#pointer) this.#pointer.style.transition = POINTER_TRANSITION;
      });
    }
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
    this.#sidebar?.removeEventListener("scroll", this.#onScroll);
    this.#ownerWindow?.removeEventListener("resize", this.#onResize);
    this.#ownerDocument?.removeEventListener("pointerdown", this.#onActivate, true);
    this.#ownerDocument?.removeEventListener("focusin", this.#onActivate, true);
    this.#sheet?.removeEventListener?.("position", this.#onPosition);
    this.#sidebar = null;
    this.#ownerDocument = null;
    this.#ownerWindow = null;
    this.#attached = false;
  }
}
