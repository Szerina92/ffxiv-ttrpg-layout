/**
 * FFXIV TTRPG Layout — Quest Summary authoring and rendering.
 *
 * Quest Summaries are intentionally independent from the FFXIV system.
 * They are user-authored Journal content stored directly in the parent
 * JournalEntryPage text as a small, self-contained HTML component.
 */

import { localize } from "./i18n.js";
import { createNativeTextDocument } from "./utils/native-text-proxy.js";

const { JournalEntryPageProseMirrorSheet } = foundry.applications.sheets.journal;

const QUEST_SUMMARY_MARKER = "1";
const QUEST_DESCRIPTION_ICON = "modules/ffxiv-ttrpg-layout/images/Icons/Journal_detail_hr1_04.png";
const QUEST_OBJECTIVES_ICON = "modules/ffxiv-ttrpg-layout/images/Icons/Journal_detail_hr1_01.png";

const QUEST_STYLE_DEFAULT = "sidequest";
const QUEST_STYLE_NONE = "none";
const QUEST_ALIGNMENT_DEFAULT = "center";
const QUEST_ALIGNMENTS = Object.freeze({
  left: {
    key: "FFXIVTTRPGLayout.Editor.QuestAlignmentLeft",
  },
  right: {
    key: "FFXIVTTRPGLayout.Editor.QuestAlignmentRight",
  },
  center: {
    key: "FFXIVTTRPGLayout.Editor.QuestAlignmentCenter",
  },
});
const QUEST_STYLES = Object.freeze({
  none: {
    image: "",
    key: "FFXIVTTRPGLayout.Editor.QuestStyleNone",
  },
  sidequest: {
    image: "modules/ffxiv-ttrpg-layout/images/Icons/Sidequest1_Icon.png",
    key: "FFXIVTTRPGLayout.Editor.QuestStyleSideQuest",
  },
  mainquest: {
    image: "modules/ffxiv-ttrpg-layout/images/Icons/Mainquest1_Icon.png",
    key: "FFXIVTTRPGLayout.Editor.QuestStyleMainQuest",
  },
  guildhest: {
    image: "modules/ffxiv-ttrpg-layout/images/Icons/Guildhest1_Icon.png",
    key: "FFXIVTTRPGLayout.Editor.QuestStyleGuildhest",
  },
  levequest: {
    image: "modules/ffxiv-ttrpg-layout/images/Icons/Levequest1_Icon.png",
    key: "FFXIVTTRPGLayout.Editor.QuestStyleLevequest",
  },
});

function escapeHTML(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

function makeQuestSummaryId() {
  return foundry.utils.randomID(16);
}

function normalizeData(data = {}) {
  const requestedStyle = String(data.questStyle ?? QUEST_STYLE_DEFAULT).trim().toLowerCase();
  const questStyle = Object.hasOwn(QUEST_STYLES, requestedStyle) ? requestedStyle : QUEST_STYLE_DEFAULT;
  const requestedAlignment = String(data.alignment ?? QUEST_ALIGNMENT_DEFAULT).trim().toLowerCase();
  const alignment = Object.hasOwn(QUEST_ALIGNMENTS, requestedAlignment)
    ? requestedAlignment
    : QUEST_ALIGNMENT_DEFAULT;

  return {
    level: String(data.level ?? "00").trim() || "00",
    name: String(data.name ?? "").trim(),
    image: String(data.image ?? "").trim(),
    questStyle,
    alignment,
    description: String(data.description ?? "").trim(),
    objectives: String(data.objectives ?? "").trim(),
    hideObjectives: [true, "true", 1, "1"].includes(data.hideObjectives),
  };
}

function levelPrefix() {
  return localize("FFXIVTTRPGLayout.Editor.QuestLevelPrefix");
}

/**
 * Build the HTML which is stored in the JournalEntryPage text field.
 */
export function buildQuestSummaryHTML(data = {}, { questId = makeQuestSummaryId() } = {}) {
  const value = normalizeData(data);
  const level = escapeHTML(value.level);
  const name = escapeHTML(value.name || localize("FFXIVTTRPGLayout.Editor.QuestTitlePlaceholder"));
  const playerInfo = localize("FFXIVTTRPGLayout.Editor.QuestPlayerInformation");
  const questStyle = QUEST_STYLES[value.questStyle] ?? QUEST_STYLES[QUEST_STYLE_DEFAULT];
  const questStyleLabel = escapeHTML(localize(questStyle.key));
  const image = escapeHTML(value.image);
  const questStyleHTML = value.questStyle !== QUEST_STYLE_NONE && questStyle.image
    ? `<div class="ffxiv-quest-summary__style" data-ffxiv-quest-style-label="${questStyleLabel}"><img src="${questStyle.image}" alt="" aria-hidden="true"></div>`
    : "";
  const hideObjectives = Boolean(value.hideObjectives);
  const hiddenObjectivesClass = hideObjectives ? " ffxiv-quest-summary__objectives--hidden" : "";
  const hiddenObjectivesAttr = hideObjectives ? "true" : "false";
  const noStyleClass = value.questStyle === QUEST_STYLE_NONE ? " ffxiv-quest-summary--no-style" : "";
  const alignmentClass = ` ffxiv-quest-summary--align-${value.alignment}`;

  const imageHTML = value.image
    ? `
      <div class="ffxiv-quest-summary__image" data-ffxiv-quest-image="${image}">
        <img src="${image}" alt="" aria-hidden="true">
      </div>`
    : "";

  return `<div class="ffxiv-quest-summary${noStyleClass}${alignmentClass}"
    data-ffxiv-quest-summary="${QUEST_SUMMARY_MARKER}"
    data-ffxiv-quest-id="${escapeHTML(questId)}"
    data-ffxiv-quest-level="${level}"
    data-ffxiv-quest-style="${escapeHTML(value.questStyle)}"
    data-ffxiv-quest-alignment="${escapeHTML(value.alignment)}"
    data-ffxiv-quest-hide-objectives="${hiddenObjectivesAttr}">
    <div class="ffxiv-quest-summary__header">
      <div class="ffxiv-quest-summary__level">${escapeHTML(levelPrefix())} ${level}</div>
      ${questStyleHTML}
      <div class="ffxiv-quest-summary__title-group">
        <div class="ffxiv-quest-summary__title">${name}</div>
        ${playerInfo ? `<div class="ffxiv-quest-summary__subtitle">${playerInfo}</div>` : ""}
      </div>
    </div>
    <div class="ffxiv-quest-summary__rule"></div>
    ${imageHTML}
    <div class="ffxiv-quest-summary__section ffxiv-quest-summary__description">
      <div class="ffxiv-quest-summary__section-title">
        <img src="${QUEST_DESCRIPTION_ICON}" alt="" aria-hidden="true">
        <span>${escapeHTML(localize("FFXIVTTRPGLayout.Editor.QuestDescription"))}</span>
      </div>
      <div class="ffxiv-quest-summary__section-content">${value.description}</div>
    </div>
    <div class="ffxiv-quest-summary__section ffxiv-quest-summary__objectives${hiddenObjectivesClass}">
      <div class="ffxiv-quest-summary__section-title">
        <img src="${QUEST_OBJECTIVES_ICON}" alt="" aria-hidden="true">
        <span>${escapeHTML(localize("FFXIVTTRPGLayout.Editor.QuestObjectives"))}</span>
      </div>
      <div class="ffxiv-quest-summary__section-content">${value.objectives}</div>
    </div>
  </div>`;
}

function extractSectionContent(element, selector) {
  const section = element.querySelector(selector);
  if (!section) return "";

  const content = section.querySelector(":scope > .ffxiv-quest-summary__section-content");
  if (content) return content.innerHTML.trim();

  // Support older Quest Summary markup where section content was nested
  // directly under the section wrapper.
  const clone = section.cloneNode(true);
  clone.querySelector(".ffxiv-quest-summary__section-title")?.remove();
  clone.querySelector(".ffxiv-quest-summary__description-title")?.remove();
  return clone.innerHTML.trim();
}

function extractLegacyLevel(element) {
  const raw = String(element.querySelector(".ffxiv-quest-summary__level")?.textContent ?? "").trim();
  if (!raw) return "00";
  const localizedPrefix = levelPrefix();
  if (localizedPrefix && raw.toLowerCase().startsWith(localizedPrefix.toLowerCase())) {
    return raw.slice(localizedPrefix.length).trim() || "00";
  }
  return raw.replace(/^(?:lv\.?|st\.?|level|stufe)\s*/i, "").trim() || "00";
}

/**
 * Read Quest Summary data from the rendered card, including older markup
 * that can still be migrated transparently.
 */
export function parseQuestSummaryElement(element) {
  if (!element) return normalizeData();

  const imageElement = element.querySelector(".ffxiv-quest-summary__image img");
  const imageWrapper = element.querySelector(".ffxiv-quest-summary__image");

  return normalizeData({
    level: element.dataset.ffxivQuestLevel || extractLegacyLevel(element),
    name: element.querySelector(".ffxiv-quest-summary__title")?.textContent ?? "",
    questStyle: element.dataset.ffxivQuestStyle || QUEST_STYLE_DEFAULT,
    alignment: element.dataset.ffxivQuestAlignment || QUEST_ALIGNMENT_DEFAULT,
    image: imageWrapper?.dataset?.ffxivQuestImage || imageElement?.getAttribute("src") || "",
    description: extractSectionContent(element, ".ffxiv-quest-summary__description"),
    objectives: extractSectionContent(element, ".ffxiv-quest-summary__objectives"),
    hideObjectives: String(element.dataset.ffxivQuestHideObjectives ?? "false").toLowerCase() === "true"
      || element.querySelector(".ffxiv-quest-summary__objectives--hidden") !== null,
  });
}

function createFieldRow(label, input) {
  const row = document.createElement("div");
  row.classList.add("ffxiv-quest-summary-editor__field");
  const labelElement = document.createElement("label");
  labelElement.classList.add("ffxiv-quest-summary-editor__label");
  labelElement.textContent = label;
  row.append(labelElement, input);
  return row;
}

function createContentPreview(value, emptyLabel) {
  const preview = document.createElement("div");
  preview.classList.add("ffxiv-quest-summary-editor__content-preview");

  if (String(value ?? "").trim()) {
    preview.innerHTML = String(value);
  } else {
    const empty = document.createElement("span");
    empty.classList.add("ffxiv-empty-state", "ffxiv-quest-summary-editor__content-empty");
    empty.textContent = emptyLabel;
    preview.appendChild(empty);
  }

  return preview;
}



/**
 * Open a native Foundry V14 ProseMirror editor for one Quest Summary field.
 *
 * This intentionally follows the same architecture as the Class Summary
 * introduction editor: a JournalEntryPageProseMirrorSheet receives a proxy
 * text document, while the real source page is kept untouched until the
 * Quest Summary dialog is finally saved.
 */
async function openQuestSummaryFieldEditor(sourcePage, field, value, onChange) {
  if (!sourcePage?.isOwner) return null;
  if (![
    "description",
    "objectives",
  ].includes(field)) return null;

  const title = field === "description"
    ? localize("FFXIVTTRPGLayout.Editor.QuestDescription")
    : localize("FFXIVTTRPGLayout.Editor.QuestObjectives");

  const editor = new FFXIVQuestSummaryProseMirrorEditor(
    sourcePage,
    field,
    String(value ?? ""),
    nextValue => onChange?.(String(nextValue ?? "")),
  );
  await editor.render({ force: true });
  editor.bringToFront();
  return editor;
}

class FFXIVQuestSummaryProseMirrorEditor extends JournalEntryPageProseMirrorSheet {
  static DEFAULT_OPTIONS = {
    form: {
      // Finish the native child editor on Save so control returns to the
      // Quest Summary dialog.
      submitOnChange: false,
      closeOnSubmit: true,
    },
    position: {
      width: 760,
      height: 560,
    },
    window: {
      resizable: true,
    },
  };

  #sourcePage;
  #field;
  #onChange;

  constructor(sourcePage, field, value, onChange, options = {}) {
    const state = { value: String(value ?? "") };
    const proxy = FFXIVQuestSummaryProseMirrorEditor.#createNativeTextDocument(
      sourcePage,
      field,
      state,
    );

    super({
      ...options,
      document: proxy,
      window: {
        ...(options.window ?? {}),
        title: field === "description"
          ? localize("FFXIVTTRPGLayout.Editor.QuestDescription")
          : localize("FFXIVTTRPGLayout.Editor.QuestObjectives"),
        resizable: true,
      },
    });

    this.#sourcePage = sourcePage;
    this.#field = field;
    this.#onChange = onChange;
    this.#state = state;
  }

  #state;

  static #createNativeTextDocument(page, field, state) {
    const title = field === "description"
      ? localize("FFXIVTTRPGLayout.Editor.QuestDescription")
      : localize("FFXIVTTRPGLayout.Editor.QuestObjectives");

    return createNativeTextDocument(page, {
      getName: () => title,
      getContent: () => state.value,
      update: (target, value) => {
        state.value = String(value ?? "");
        return target;
      },
      updateSource: (target, value) => {
        state.value = String(value ?? "");
        return target;
      },
    });
  }

  _canRender(options) {
    return Boolean(this.#sourcePage?.isOwner) && super._canRender(options);
  }

  _onAutosave(content) {
    const nextValue = String(content ?? "");
    this.#state.value = nextValue;
    this.#onChange?.(nextValue);
  }

  async _onClose(options) {
    this.#onChange?.(this.#state.value);
    return super._onClose(options);
  }
}

function makeDialogContent(data, editorState, sourcePage) {
  const content = document.createElement("div");
  const wrapper = document.createElement("div");
  wrapper.classList.add("ffxiv-quest-summary-editor");
  content.appendChild(wrapper);

  const headerContainer = document.createElement("section");
  headerContainer.classList.add(
    "ffxiv-quest-summary-editor__container",
    "ffxiv-quest-summary-editor__header-container",
  );

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.name = "name";
  nameInput.value = data.name;
  if (data.name) nameInput.setAttribute("value", data.name);
  else nameInput.removeAttribute("value");
  nameInput.required = true;
  nameInput.autocomplete = "off";
  nameInput.placeholder = localize("FFXIVTTRPGLayout.Editor.QuestTitlePlaceholder");
  nameInput.autofocus = true;

  const titleRow = createFieldRow(
    localize("FFXIVTTRPGLayout.Editor.QuestName"),
    nameInput,
  );
  titleRow.classList.add("ffxiv-quest-summary-editor__title-row");
  headerContainer.appendChild(titleRow);

  const secondaryRow = document.createElement("div");
  secondaryRow.classList.add("ffxiv-quest-summary-editor__header-secondary");

  const levelInput = document.createElement("input");
  levelInput.type = "text";
  levelInput.name = "level";
  levelInput.value = data.level;
  if (data.level) levelInput.setAttribute("value", data.level);
  else levelInput.removeAttribute("value");
  levelInput.autocomplete = "off";
  levelInput.placeholder = "00";

  const levelField = createFieldRow(
    localize("FFXIVTTRPGLayout.Editor.QuestLevel"),
    levelInput,
  );
  levelField.classList.add("ffxiv-quest-summary-editor__header-field");
  secondaryRow.appendChild(levelField);

  const styleField = document.createElement("div");
  styleField.classList.add(
    "ffxiv-quest-summary-editor__field",
    "ffxiv-quest-summary-editor__header-field",
    "ffxiv-quest-summary-editor__field--style",
  );

  const styleLabel = document.createElement("label");
  styleLabel.classList.add("ffxiv-quest-summary-editor__label");
  styleLabel.textContent = localize("FFXIVTTRPGLayout.Editor.QuestStyle");
  styleLabel.htmlFor = "ffxiv-quest-summary-style-select";

  const styleControl = document.createElement("div");
  styleControl.classList.add("ffxiv-quest-summary-editor__style-control");

  const styleSelect = document.createElement("select");
  styleSelect.name = "questStyle";
  styleSelect.id = "ffxiv-quest-summary-style-select";
  styleSelect.classList.add("ffxiv-quest-summary-editor__style-select");
  styleSelect.setAttribute("aria-label", localize("FFXIVTTRPGLayout.Editor.QuestStyle"));

  for (const [styleKey, style] of Object.entries(QUEST_STYLES)) {
    const option = document.createElement("option");
    option.value = styleKey;
    option.textContent = localize(style.key);
    if (data.questStyle === styleKey) option.setAttribute("selected", "");
    else option.removeAttribute("selected");
    option.selected = data.questStyle === styleKey;
    styleSelect.appendChild(option);
  }

  const stylePreview = document.createElement("img");
  stylePreview.classList.add("ffxiv-quest-summary-editor__style-preview");
  stylePreview.alt = "";
  stylePreview.setAttribute("aria-hidden", "true");

  styleControl.append(styleSelect, stylePreview);
  styleField.append(styleLabel, styleControl);
  secondaryRow.appendChild(styleField);

  const alignmentField = document.createElement("div");
  alignmentField.classList.add(
    "ffxiv-quest-summary-editor__field",
    "ffxiv-quest-summary-editor__header-field",
    "ffxiv-quest-summary-editor__field--alignment",
  );

  const alignmentLabel = document.createElement("label");
  alignmentLabel.classList.add("ffxiv-quest-summary-editor__label");
  alignmentLabel.textContent = localize("FFXIVTTRPGLayout.Editor.QuestAlignment");
  alignmentLabel.htmlFor = "ffxiv-quest-summary-alignment-select";

  const alignmentSelect = document.createElement("select");
  alignmentSelect.name = "alignment";
  alignmentSelect.id = "ffxiv-quest-summary-alignment-select";
  alignmentSelect.classList.add("ffxiv-quest-summary-editor__alignment-select");
  alignmentSelect.setAttribute("aria-label", localize("FFXIVTTRPGLayout.Editor.QuestAlignment"));

  for (const [alignmentKey, alignment] of Object.entries(QUEST_ALIGNMENTS)) {
    const option = document.createElement("option");
    option.value = alignmentKey;
    option.textContent = localize(alignment.key);
    option.selected = data.alignment === alignmentKey;
    alignmentSelect.appendChild(option);
  }

  alignmentField.append(alignmentLabel, alignmentSelect);
  secondaryRow.appendChild(alignmentField);
  headerContainer.appendChild(secondaryRow);
  wrapper.appendChild(headerContainer);

  const imageField = document.createElement("section");
  imageField.classList.add(
    "ffxiv-quest-summary-editor__container",
    "ffxiv-quest-summary-editor__image-container",
    "ffxiv-quest-summary-editor__field",
    "ffxiv-quest-summary-editor__field--image",
  );

  const imageLabel = document.createElement("div");
  imageLabel.classList.add("ffxiv-quest-summary-editor__label");
  imageLabel.textContent = localize("FFXIVTTRPGLayout.Editor.QuestImage");

  const imageControl = document.createElement("div");
  imageControl.classList.add("ffxiv-quest-summary-editor__image-control");

  if (!customElements.get("file-picker")) {
    throw new Error("FFXIV TTRPG Layout: Foundry V14 FilePicker element is unavailable.");
  }
  const picker = document.createElement("file-picker");
  picker.classList.add("ffxiv-quest-summary-editor__file-picker");
  picker.setAttribute("name", "image");
  picker.setAttribute("type", "image");
  picker.setAttribute("placeholder", "path/to/file.ext");
  if (data.image) picker.setAttribute("value", data.image);

  const clearImage = document.createElement("button");
  clearImage.type = "button";
  clearImage.classList.add("ffxiv-quest-summary-editor__clear-image");
  clearImage.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
  clearImage.title = localize("FFXIVTTRPGLayout.Editor.QuestRemoveImage");

  const preview = document.createElement("img");
  preview.classList.add("ffxiv-quest-summary-editor__image-preview");
  preview.alt = localize("FFXIVTTRPGLayout.Editor.QuestImagePreview");

  imageControl.append(picker, clearImage);
  imageField.append(imageLabel, imageControl, preview);
  wrapper.appendChild(imageField);

  const editors = document.createElement("div");
  editors.classList.add("ffxiv-quest-summary-editor__editors");

  for (const field of ["description", "objectives"]) {
    const richField = document.createElement("section");
    richField.classList.add("ffxiv-quest-summary-editor__rich-field");

    const labelRow = document.createElement("div");
    labelRow.classList.add("ffxiv-quest-summary-editor__section-heading");

    const label = document.createElement("div");
    label.classList.add("ffxiv-quest-summary-editor__label");
    label.textContent = field === "description"
      ? localize("FFXIVTTRPGLayout.Editor.QuestDescription")
      : localize("FFXIVTTRPGLayout.Editor.QuestObjectives");
    labelRow.appendChild(label);

    if (field === "objectives") {
      const hideLabel = document.createElement("label");
      hideLabel.classList.add("ffxiv-quest-summary-editor__hide-objectives");

      const hideInput = document.createElement("input");
      hideInput.type = "checkbox";
      hideInput.name = "hideObjectives";
      hideInput.checked = Boolean(data.hideObjectives);
      if (data.hideObjectives) hideInput.setAttribute("checked", "");
      else hideInput.removeAttribute("checked");

      const hideText = document.createElement("span");
      hideText.textContent = localize("FFXIVTTRPGLayout.Editor.QuestHideObjectives");

      hideLabel.append(hideText, hideInput);
      labelRow.appendChild(hideLabel);
    }

    const previewBox = createContentPreview(
      editorState[field],
      field === "description"
        ? localize("FFXIVTTRPGLayout.Editor.QuestDescriptionEmpty")
        : localize("FFXIVTTRPGLayout.Editor.QuestObjectivesEmpty"),
    );

    previewBox.dataset.ffxivQuestPreview = field;

    const button = document.createElement("button");
    button.type = "button";
    button.classList.add("ffxiv-action-button", "ffxiv-quest-summary-editor__edit-rich");
    button.dataset.ffxivQuestEditRich = field;
    button.innerHTML = '<i class="fa-solid fa-pen-to-square" aria-hidden="true"></i>';
    button.append(
      field === "description"
        ? localize("FFXIVTTRPGLayout.Editor.QuestEditDescription")
        : localize("FFXIVTTRPGLayout.Editor.QuestEditObjectives"),
    );

    richField.append(labelRow, previewBox, button);
    editors.appendChild(richField);
  }

  wrapper.appendChild(editors);
  return content;
}

/**
 * Open the user-facing Quest Summary editor.
 * Returns normalized data on Save and null when the dialog is canceled.
 */
export async function openQuestSummaryEditor(initial = {}, { sourcePage = null } = {}) {
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (!DialogV2) {
    globalThis.ui?.notifications?.error?.(
      localize("FFXIVTTRPGLayout.Editor.QuestSummaryDialogUnavailable")
    );
    return null;
  }

  if (!sourcePage?.isOwner) {
    globalThis.ui?.notifications?.error?.(
      localize("FFXIVTTRPGLayout.Editor.QuestSummaryPageUnavailable")
    );
    return null;
  }

  const data = normalizeData(initial);
  const editorState = {
    questStyle: data.questStyle,
    alignment: data.alignment,
    description: data.description,
    objectives: data.objectives,
    hideObjectives: data.hideObjectives,
  };
  const content = makeDialogContent(data, editorState, sourcePage);

  const result = await DialogV2.input({
    window: {
      title: localize("FFXIVTTRPGLayout.Editor.QuestSummary"),
    },
    classes: ["ffxiv-ttrpg-layout", "ffxiv-quest-summary-dialog"],
    position: { width: 760 },
    modal: false,
    rejectClose: false,
    content,
    render: (event, dialog) => {
      const dialogRoot = dialog.element;
      if (!dialogRoot) return;

      const picker = dialogRoot.querySelector('file-picker[name="image"]');
      const preview = dialogRoot.querySelector('.ffxiv-quest-summary-editor__image-preview');
      const clearImage = dialogRoot.querySelector('.ffxiv-quest-summary-editor__clear-image');

      const updatePreview = () => {
        if (!picker || !preview) return;
        const src = String(picker.value ?? "").trim();
        preview.hidden = !src;
        if (src) preview.src = src;
        else preview.removeAttribute("src");
      };

      if (picker && preview && dialogRoot.dataset.ffxivQuestImageBound !== "true") {
        dialogRoot.dataset.ffxivQuestImageBound = "true";
        picker.addEventListener("change", updatePreview);
        picker.querySelector?.("button")?.addEventListener?.("click", () => {
          globalThis.setTimeout(() => picker.picker?.bringToFront?.(), 0);
        });

        clearImage?.addEventListener("click", event => {
          event.preventDefault();
          picker.value = "";
          updatePreview();
        });
      }

      const styleSelect = dialogRoot.querySelector('select[name="questStyle"]');
      const alignmentSelect = dialogRoot.querySelector('select[name="alignment"]');
      const stylePreview = dialogRoot.querySelector('.ffxiv-quest-summary-editor__style-preview');
      const syncStylePreview = () => {
        if (!styleSelect || !stylePreview) return;
        editorState.questStyle = String(styleSelect.value ?? QUEST_STYLE_DEFAULT);
        const selected = QUEST_STYLES[editorState.questStyle];
        const src = String(selected?.image ?? "").trim();
        stylePreview.hidden = !src;
        if (src) stylePreview.src = src;
        else stylePreview.removeAttribute("src");
      };
      if (styleSelect && styleSelect.dataset.ffxivQuestStyleBound !== "true") {
        styleSelect.dataset.ffxivQuestStyleBound = "true";
        styleSelect.addEventListener("change", syncStylePreview);
      }
      syncStylePreview();

      if (alignmentSelect && alignmentSelect.dataset.ffxivQuestAlignmentBound !== "true") {
        alignmentSelect.dataset.ffxivQuestAlignmentBound = "true";
        alignmentSelect.addEventListener("change", () => {
          const requested = String(alignmentSelect.value ?? QUEST_ALIGNMENT_DEFAULT).trim().toLowerCase();
          editorState.alignment = Object.hasOwn(QUEST_ALIGNMENTS, requested)
            ? requested
            : QUEST_ALIGNMENT_DEFAULT;
        });
      }
      if (alignmentSelect) {
        alignmentSelect.value = editorState.alignment;
        editorState.alignment = String(alignmentSelect.value ?? QUEST_ALIGNMENT_DEFAULT).trim().toLowerCase();
        if (!Object.hasOwn(QUEST_ALIGNMENTS, editorState.alignment)) {
          alignmentSelect.value = QUEST_ALIGNMENT_DEFAULT;
          editorState.alignment = QUEST_ALIGNMENT_DEFAULT;
        }
      }

      const hideObjectives = dialogRoot.querySelector('input[name="hideObjectives"]');
      if (hideObjectives && hideObjectives.dataset.ffxivQuestBound !== "true") {
        hideObjectives.dataset.ffxivQuestBound = "true";
        hideObjectives.addEventListener("change", () => {
          editorState.hideObjectives = Boolean(hideObjectives.checked);
        });
      }
      if (hideObjectives) editorState.hideObjectives = Boolean(hideObjectives.checked);

      updatePreview();

      if (dialogRoot.dataset.ffxivQuestRichButtonsBound === "true") return;
      dialogRoot.dataset.ffxivQuestRichButtonsBound = "true";

      dialogRoot.addEventListener("click", async event => {
        const button = event.target?.closest?.(".ffxiv-quest-summary-editor__edit-rich[data-ffxiv-quest-edit-rich]");
        if (!button || !dialogRoot.contains(button)) return;

        event.preventDefault();
        event.stopPropagation();

        const field = String(button.dataset.ffxivQuestEditRich ?? "").trim();
        if (!["description", "objectives"].includes(field)) return;

        const previewBox = dialogRoot.querySelector(`[data-ffxiv-quest-preview="${field}"]`);
        await openQuestSummaryFieldEditor(
          sourcePage,
          field,
          editorState[field],
          nextValue => {
            editorState[field] = String(nextValue ?? "");
            if (!previewBox) return;

            previewBox.innerHTML = "";
            if (editorState[field].trim()) {
              previewBox.innerHTML = editorState[field];
              return;
            }

            const empty = document.createElement("span");
            empty.classList.add("ffxiv-empty-state", "ffxiv-quest-summary-editor__content-empty");
            empty.textContent = field === "description"
              ? localize("FFXIVTTRPGLayout.Editor.QuestDescriptionEmpty")
              : localize("FFXIVTTRPGLayout.Editor.QuestObjectivesEmpty");
            previewBox.appendChild(empty);
          },
        );

      });
    },
    ok: {
      label: localize("FFXIVTTRPGLayout.Editor.QuestSave"),
      icon: "fa-solid fa-check",
    },
    buttons: [
      {
        action: "cancel",
        label: localize("FFXIVTTRPGLayout.Editor.QuestCancel"),
        icon: "fa-solid fa-xmark",
        callback: () => null,
      },
    ],
  });

  if (!result) return null;

  return normalizeData({
    ...result,
    questStyle: editorState.questStyle,
    alignment: editorState.alignment,
    description: editorState.description,
    objectives: editorState.objectives,
    hideObjectives: editorState.hideObjectives,
  });
}

/**
 * Replace one Quest Summary in an existing JournalEntryPage text document.
 * Returns false when the target cannot be found.
 */
export async function replaceQuestSummaryInPage(page, questId, data, { cardIndex = -1 } = {}) {
  if (!page) return false;
  if (page.type !== "text" || !page.text) return false;

  const holder = document.createElement("div");
  holder.innerHTML = String(page.text.content ?? "");

  const cards = [...holder.querySelectorAll(".ffxiv-quest-summary")];
  let card = null;
  if (typeof questId === "string" && questId.trim()) {
    card = cards.find(candidate => candidate.dataset.ffxivQuestId === questId) ?? null;
  }
  if (!card && Number.isInteger(cardIndex) && cardIndex >= 0) card = cards[cardIndex] ?? null;
  if (!card) return false;

  const targetQuestId = String(questId ?? "").trim() || card.dataset.ffxivQuestId || makeQuestSummaryId();
  card.outerHTML = buildQuestSummaryHTML(data, { questId: targetQuestId });
  await page.update({ "text.content": holder.innerHTML });
  return true;
}

/**
 * Add the edit affordance to rendered Quest Summaries without storing UI-only
 * state back into Journal content.
 */
export function decorateQuestSummaryCards(root, { editable = false } = {}) {
  if (!root) return;
  for (const card of root.querySelectorAll(".ffxiv-quest-summary")) {
    card.classList.toggle("ffxiv-quest-summary--editable", Boolean(editable));
    if (editable) {
      card.title = localize("FFXIVTTRPGLayout.Editor.QuestSummaryEditHint");
    } else {
      card.removeAttribute("title");
    }
  }
}

