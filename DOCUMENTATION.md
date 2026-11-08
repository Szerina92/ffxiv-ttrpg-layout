# FFXIV TTRPG Layout documentation

This page explains how to embed FFXIV content in text, which HTML classes the Layout provides, and how to change their look. Embeds work wherever Foundry renders rich text: Journals, item and actor descriptions, and chat. The text classes (colors, callouts, quest summaries) are styled in the Layout Journal and its editor.

## 1. Embeds

### Syntax

```
@FFXIV[uuid]
@FFXIV[uuid option option]
```

The uuid is the UUID of the document. Copy it from the document's sheet header, or drag the document into the editor and take the UUID from the `@UUID[…]` link.

Options can go inside the brackets after the UUID. Case does not matter.

### Which embed

`@FFXIV[uuid]` picks the embed from the document type. Each specific form does the same for one type only.

| Document | Universal | Specific | Options |
|---|---|---|---|
| Item, type ability | `@FFXIV` | `@FFXIVAbility` | `half`, `left`, `right`, `center` |
| Item, type trait | `@FFXIV` | `@FFXIVTrait` | `half`, `left`, `right`, `center` |
| Any other Item | `@FFXIV` | `@FFXIVItem` | none |
| Actor, type npc | `@FFXIV` | `@FFXIVActor` | `left`, `right`, `center`, `double` |
| Actor, type pet | `@FFXIV` | `@FFXIVPet` | `left`, `right`, `center` |
| RollTable | `@FFXIV` | `@FFXIVTable` | `left`, `right`, `center` |

### Options

| Option | Effect |
|---|---|
| `half` | The card takes half the width, like a Job Summary column. |
| `left` / `right` | The embed floats on that side and text flows around it. |
| `center` | The embed stands on its own line (default for actors, pets and tables). |
| `double` | The NPC statblock spans the full width in two columns. This is currently a WIP!|

### Behavior

Clicking a card's icon opens the item. Dragging the icon onto an actor sheet, the sidebar or the hotbar works like dragging a `@UUID` link. Trait cards have no icon, so you drag them by the name.

Clicking the name of an NPC or Pet embed opens the actor sheet.

The dice button in a table's header draws from the table.

An embed inside a card's text renders as a nested card, one level deep; an augment can show the ability it grants this way. Deeper embeds become normal links, which also prevents loops.

## 2. Text classes

The Layout's editor menu (X|V in the editor toolbar) inserts these classes. You can also write them in the HTML source of a page.

### Text colors (inline, `<span>`)

| Class | Use |
|---|---|
| `ffxiv-text-note` | Sidenote text |
| `ffxiv-text-example` | Example text Colour |
| `ffxiv-header-blue` / `ffxiv-header-red` / `ffxiv-header-green` | Colored text in the style of an H3 heading, without being a H3 |
| `ffxiv-abi` | Attribute color like VIT, Speed|
| `ffxiv-att` | Attack color |

`ffxiv-abi` and `ffxiv-att` also work inside ability descriptions, where they color the text on cards, in tooltips and in chat. Currently only in Paper theme.

### Callouts (block, `<div>`)

You can combine a background class and the GM icon on one `<div>`.

| Class | Use |
|---|---|
| `ffxiv-bg-light-blue` | Light blue box |
| `ffxiv-bg-white` | White box |
| `ffxiv-bg-paperscroll` | Paper scroll box |
| `ffxiv-bg-green` | Green box |
| `ffxiv-icon-gm` | GM icon in the box |

```html
<div class="ffxiv-bg-paperscroll ffxiv-icon-gm">
  <p>Only the GM should read this.</p>
</div>
```

### Scenario text

This is a box with a speaker icon for text the GM reads aloud. The editor menu inserts it:

```html
<div class="ffxiv-callout ffxiv-callout--scenario">
  <div class="ffxiv-callout__label"><i class="fa-solid fa-volume-high" aria-hidden="true"></i></div>
  <p>Read-aloud text.</p>
</div>
```

### Quest Summary

Insert and edit a Quest Summary through the editor menu (X|V → Quest). Double-clicking an existing Quest Summary in the Journal opens the editor again. Don't write it by hand, because the editor stores its settings in `data-ffxiv-quest-*` attributes.

### Two columns

`ffxiv-columns` sets its content in two columns, for example a list of item cards:

```html
<div class="ffxiv-columns">
  <p>@FFXIV[Item.a]</p>
  <p>@FFXIV[Item.b]</p>
</div>
```
