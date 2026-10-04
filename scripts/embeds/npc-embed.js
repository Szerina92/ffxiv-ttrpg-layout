import { localize, localizeTags } from "../i18n.js";
import { isMarkerRendererEnabled } from "../marker-renderer.js";
import { buildAbilityCardData } from "../sheets/class-summary-data.js";
import { parseEnricherOptions } from "../utils/enricher-options.js";
/**
 * FFXIV TTRPG Layout — NPC / Actor Embed
 * Restored from the known-good 1.7.0 Actor Embed implementation.
 */
const TextEditor = foundry.applications.ux.TextEditor.implementation;

class FFXIVActorEmbed {
  static async createActorEmbed(uuid, options = {}) {
    if (typeof uuid !== "string" || !uuid.trim()) return null;
    const actor = await fromUuid(uuid.trim());
    if (!actor || actor.documentName !== "Actor") return null;
    // This subsystem renders NPC Actors only.
    // Pet Actors are handled exclusively by pet-embed.js / @FFXIVPet.
    if (actor.type !== "npc") return null;

    const system = actor.system ?? {};
    const primary = system.primary_attributes ?? {};
    const secondary = system.secondary_attributes ?? {};
    const size = this.#displayValue(system.size);
    const specie = this.#displayValue(system.specie);
    const sizeGrid = this.#getNpcSizeGrid(system.size, actor);

    const templateData = {
      uuid: actor.uuid,
      actorType: actor.type,
      name: actor.name ?? "",
      sizeText: size ? `${localize("FFXIVTTRPGLayout.NPC.Size", "Size")}: ${size}${sizeGrid ? ` (${sizeGrid})` : ""}` : "",
      specieText: specie ? ` - ${specie}` : "",
      vigilance: this.#numberOrFallback(secondary.vigilance?.value, 0),
      leftProperties: [
        { label: localize("FFXIVTTRPGLayout.NPC.Defense", "Defense"), value: this.#numberOrFallback(secondary.defense?.value, 0) },
        { label: localize("FFXIVTTRPGLayout.NPC.MaxHP", "Max HP"), value: this.#numberOrFallback(system.health?.max, 0) }
      ],
      rightProperties: [
        { label: localize("FFXIVTTRPGLayout.NPC.MagicDefense", "Magic Defense"), value: this.#numberOrFallback(secondary.magic_defense?.value, 0) },
        { label: localize("FFXIVTTRPGLayout.NPC.Speed", "Speed"), value: `${this.#numberOrFallback(secondary.speed?.value, 0)} ${this.#displayValue(secondary.speed?.unit) || localize("FFXIVTTRPGLayout.NPC.Squares", "squares")}` }
      ],
      primaryStats: [
        ["STR", primary.strength?.value], ["DEX", primary.dexterity?.value],
        ["VIT", primary.vitality?.value], ["INT", primary.intelligence?.value],
        ["MND", primary.mind?.value]
      ].map(([label,value]) => {
        const number=this.#numberOrFallback(value,0);
        return {label,value:number>=0?`+${number}`:`${number}`};
      }),
      traits: [],
      abilityGroups: [],
      doubleAbilityItems: [],
      doublePrimaryAbilities: [],
      doubleExtendedAbilities: [],
      hasAbilities: false,
      isDouble: options.double === true
    };

    const items=Array.from(actor.items ?? []);
    const abilityGroups={primary:[],secondary:[],instant:[]};

    for(const item of items){
      if(item?.type==="trait"){
        const description=this.#displayValue(item.system?.description);
        let descriptionHtml="";
        if(description){
          descriptionHtml=await TextEditor.enrichHTML(description,{
            async:true,custom:true,documents:true,embeds:true,links:true,rolls:true,secrets:true,relativeTo:item
          });
        }
        templateData.traits.push({name:item.name ?? "",descriptionHtml});
        continue;
      }
      if(item?.type==="limit_break") continue;
      const group=this.#getActorAbilityGroup(item);
      if(group && abilityGroups[group]) abilityGroups[group].push(item);
    }

    for(const [key,sourceItems] of Object.entries(abilityGroups)){
      const itemsData=[];
      for(let index=0;index<sourceItems.length;index++){
        const item=sourceItems[index];
        const card = await buildAbilityCardData(item, actor);
        if (!card) continue;
        const abilityDetail = await this.#buildAbilityDetailData(item, { checkModifier: card.checkModifier });
        const doubleOrder = templateData.doubleAbilityItems.length;
        const itemData={
          ...card,
          typeLabel: card.typeLabel ?? "",
          abilityDetail,
          index,
          groupKey:key,
          doubleOrder,
        };
        itemsData.push(itemData);
        templateData.doubleAbilityItems.push({
          ...itemData,
          groupKey:key,
          doubleOrder,
        });
      }
      templateData.abilityGroups.push({key,items:itemsData});
    }

    templateData.doublePrimaryAbilities = templateData.doubleAbilityItems.slice(0, 2);
    templateData.doubleExtendedAbilities = templateData.doubleAbilityItems.slice(2);
    templateData.hasAbilities=templateData.abilityGroups.some(group=>group.items.length>0);

    const html=await foundry.applications.handlebars.renderTemplate("modules/ffxiv-ttrpg-layout/templates/embeds/npc-embed.hbs",templateData);
    const template=document.createElement("template");
    template.innerHTML=String(html ?? "").trim();
    const root=template.content.firstElementChild;
    if(!root) return null;
    if (options.label) root.dataset.label = options.label;

    const position = ["left", "right", "center"].includes(options.position)
      ? options.position
      : "center";

    if (options.double === true) {
      root.classList.add("ffxiv-actor-embed--double");
    } else {
      root.classList.add(`ffxiv-actor-embed--float-${position}`);
    }

    // Experimental marker graphics are optional and controlled centrally
    // through the module setting registered by marker-renderer.js.
    if (isMarkerRendererEnabled()) {
      for (const group of templateData.abilityGroups) {
        const sourceItems = abilityGroups[group.key];
        for (let index = 0; index < sourceItems.length; index++) {
          const block = root.querySelector(
            `[data-ability-group="${CSS.escape(group.key)}"] [data-ability-index="${index}"]`
          );
          if (!block) continue;

          const graphics = this.#buildMarkerGraphics(
            sourceItems[index],
            actor
          );

          for (const graphic of graphics) {
            block.appendChild(graphic);
          }
        }
      }
    }

    if (templateData.isDouble && templateData.doubleAbilityItems.length > 1) {
      this.#scheduleDoubleBalance(root);
    }
    return root;
  }

  static #scheduleDoubleBalance(root) {
    // The enricher returns the root before Foundry necessarily inserts it into
    // the live document. Waiting on the disconnected root can therefore miss
    // the real render lifecycle (and leave the extended column empty).
    // Observe document insertions first, then balance once the actual node is
    // connected.
    const tryBalance = () => {
      if (!root.isConnected) return false;
      this.#balanceDoubleAbilities(root);
      this.#installDoubleBalanceObserver(root);
      return true;
    };

    if (tryBalance()) return;

    const host = document.body ?? document.documentElement;
    if (!host) {
      requestAnimationFrame(() => this.#scheduleDoubleBalance(root));
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
  static #balanceDoubleAbilities(root) {
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

  static #installDoubleBalanceObserver(root) {
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
        this.#balanceDoubleAbilities(root);
      });
    });

    root.__ffxivDoubleBalanceObserver = observer;
    observer.observe(root);
  }

  static async #buildAbilityDetailData(item, { includeTags = false, checkModifier = "" } = {}) {
    const system=item?.system ?? {};
    const lines=[];
    const add=(label,value,rich=false)=>{
      const text=this.#displayValue(value);
      if(!text)return;
      lines.push({parts:[{label,value:text,rich,separator:false}]});
    };
    const pair=(a,av,b,bv)=>{
      const left=this.#displayValue(av),right=this.#displayValue(bv);
      if(!left&&!right)return;
      const parts=[];
      if(left)parts.push({
        label:a,
        value:left,
        rich:false,
        separator:false,
        valueClass:a === "Check" ? "ffxiv-actor-embed__ability-value--blue-dark" : "",
        checkModifier:a === "Check" ? checkModifier : ""
      });
      if(right)parts.push({
        label:b,
        value:right,
        rich:false,
        separator:Boolean(left),
        crValue:b === "CR" ? this.#formatCrValue(right) : null,
        valueClass:b === "CR" ? "" : ""
      });
      lines.push({parts});
    };
    if(includeTags){
      const tags=this.#getItemTagLabels(item,system.tags);
      if(tags.length)add(localize("FFXIVTTRPGLayout.NPC.Tags", "Tags"),tags.join(", "));
    }
    pair(localize("FFXIVTTRPGLayout.Ability.Target", "Target"),system.target,localize("FFXIVTTRPGLayout.Ability.Range", "Range"),system.range);
    pair(localize("FFXIVTTRPGLayout.Ability.Check", "Check"),this.#formatAbilityCheck(system.check),localize("FFXIVTTRPGLayout.Ability.CR", "CR"),system.challenge);
    add(localize("FFXIVTTRPGLayout.NPC.Origin", "Origin"),system.origin);
    add(localize("FFXIVTTRPGLayout.NPC.MarkerArea", "Marker Area"),system.marker_area);
    add(localize("FFXIVTTRPGLayout.NPC.MarkerTrigger", "Marker Trigger"),system.marker_trigger);
    await this.#appendRichTextData(lines,localize("FFXIVTTRPGLayout.NPC.MarkerEffect", "Marker Effect"),system.marker_effect,item);
    await this.#appendRichTextData(lines,localize("FFXIVTTRPGLayout.NPC.BaseEffect", "Base Effect"),system.base_effect,item);
    await this.#appendRichTextData(lines,localize("FFXIVTTRPGLayout.NPC.DirectHit", "Direct Hit"),system.direct_hit,item);
    await this.#appendRichTextData(lines,localize("FFXIVTTRPGLayout.NPC.Limitations", "Limitations"),system.limitations,item);
    const statuses=Array.isArray(system.status_effects)?system.status_effects.filter(Boolean):[];
    if(statuses.length)add(localize("FFXIVTTRPGLayout.NPC.StatusEffects", "Status Effects"),statuses.join(", "));
    add(localize("FFXIVTTRPGLayout.NPC.StatusEffect", "Status Effect"),system.status_effect);
    return lines;
  }

  static #formatCrValue(value) {
    const text = this.#displayValue(value);
    if (!text) return null;

    const parts = [];
    let cursor = 0;
    const pattern = /Magic Defense|Defense/g;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      if (match.index > cursor) {
        parts.push({ text: text.slice(cursor, match.index), highlight: false });
      }

      parts.push({
        text: match[0],
        highlight: true
      });

      cursor = match.index + match[0].length;
    }

    if (cursor < text.length) {
      parts.push({ text: text.slice(cursor), highlight: false });
    }

    return parts.length ? parts : [{ text, highlight: false }];
  }

  static async #appendRichTextData(lines, label, content, relativeTo = null) {
    const html = this.#displayValue(content);
    if (!html) return;

    const enriched = await TextEditor.enrichHTML(html, {
      async: true,
      custom: true,
      secrets: true,
      documents: true,
      embeds: true,
      links: true,
      rolls: true,
      relativeTo
    });

    // The NPC Embed places this rich value inside an existing <p>.
    // Foundry's enrichment may return one or more block-level <p>/<div>
    // elements. Nesting those directly inside another <p> causes the browser
    // to repair the invalid HTML, which separates the value onto a new line
    // and introduces the apparent indentation/margin seen in the NPC card.
    // Flatten the top-level block wrappers while retaining their inline HTML.
    const wrapper = document.createElement("div");
    wrapper.innerHTML = String(enriched ?? "");

    const parts = [];
    for (const node of wrapper.childNodes) {
      if (node.nodeType === Node.ELEMENT_NODE && ["P", "DIV"].includes(node.tagName)) {
        const inner = node.innerHTML.trim();
        if (inner) parts.push(inner);
        continue;
      }
      if (node.nodeType === Node.TEXT_NODE) {
        const value = node.textContent?.trim();
        if (value) parts.push(value);
        continue;
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        parts.push(node.outerHTML);
      }
    }

    const inlineValue = parts.join("<br>");
    if (!inlineValue) return;

    lines.push({
      parts: [{ label, value: inlineValue, rich: true, separator: false }]
    });
  }



  static #buildMarkerGraphics(item, actor) {
      const markers = Array.isArray(item?.system?.markers)
        ? item.system.markers.filter(marker => Array.isArray(marker?.state))
        : [];
  
      if (markers.length) {
        return markers
          .map((marker, index) => this.#buildMarkerGraphicFromState(marker, actor, index, item?.system?.marker_area))
          .filter(Boolean);
      }
  
      // Fallback for marker data without a saved state matrix. We parse the
      // human-readable marker description into the simplest useful geometry.
      // The saved state matrix remains authoritative whenever it exists.
      const markerText = this.#displayValue(item?.system?.marker_area);
      const fallback = this.#buildMarkerFallbackState(markerText, actor);
      if (!fallback) return [];
  
      return [this.#buildMarkerGraphicFromGrid(fallback.state, actor, {
        label: fallback.label,
        actorOrigin: fallback.actorOrigin,
        actorWidth: fallback.actorWidth,
        actorHeight: fallback.actorHeight,
        index: 0,
      })].filter(Boolean);
    }

  static #buildMarkerFallbackState(markerText, actor) {
      const text = String(markerText ?? '').trim();
      const size = this.#parseMarkerGridSize(text);
      if (!size) return null;
  
      const actorWidth = this.#getTokenDimension(actor?.prototypeToken?.width, 1);
      const actorHeight = this.#getTokenDimension(actor?.prototypeToken?.height, 1);
  
      const isAdjacent = /\badjacent\b/i.test(text);
      const isStraight = /\bstraight line\b/i.test(text);
  
      // A straight-line marker extends away from the origin. Without a saved
      // matrix the exact facing cannot be known, so use the official preview's
      // neutral vertical presentation. The system matrix, when available,
      // always takes precedence and preserves the real direction.
      if (isStraight) {
        const state = Array.from({ length: size.height }, () =>
          Array(size.width).fill(true),
        );
        const actorOrigin = {
          x: Math.floor(size.width / 2),
          y: size.height - 1,
        };
        return {
          state,
          actorOrigin,
          actorWidth,
          actorHeight,
          label: localize("FFXIVTTRPGLayout.Marker.StraightLine", `${size.width}x${size.height} straight-line marker`, { size: `${size.width}x${size.height}` }),
        };
      }
  
      if (isAdjacent) {
        // Put the marker immediately above the actor in the fallback preview.
        // A saved marker matrix is required for the actual in-system direction.
        const rows = size.height + actorHeight;
        const cols = Math.max(size.width, actorWidth);
        const state = Array.from({ length: rows }, () =>
          Array(cols).fill(false),
        );
        const markerLeft = Math.floor((cols - size.width) / 2);
        const markerTop = 0;
        for (let y = 0; y < size.height; y++) {
          for (let x = 0; x < size.width; x++) {
            state[markerTop + y][markerLeft + x] = true;
          }
        }
        return {
          state,
          actorOrigin: {
            x: Math.floor(cols / 2),
            y: size.height + Math.floor(actorHeight / 2),
          },
          actorWidth,
          actorHeight,
          label: localize("FFXIVTTRPGLayout.Marker.Adjacent", `${size.width}x${size.height} adjacent marker`, { size: `${size.width}x${size.height}` }),
        };
      }
  
      const state = Array.from({ length: size.height }, () =>
        Array(size.width).fill(true),
      );
      return {
        state,
        actorOrigin: {
          x: Math.floor(size.width / 2),
          y: Math.floor(size.height / 2),
        },
        actorWidth,
        actorHeight,
        label: localize("FFXIVTTRPGLayout.Marker.Area", `${size.width}x${size.height} marker area`, { size: `${size.width}x${size.height}` }),
      };
    }

  static #buildMarkerGraphicFromState(marker, actor, index = 0, markerAreaText = '') {
      const state = marker?.state;
      if (!Array.isArray(state) || !state.length) return null;
  
      const rowCount = state.length;
      const colCount = Math.max(0, ...state.map(row => Array.isArray(row) ? row.length : 0));
      if (!colCount) return null;
  
      const actorWidth = this.#getTokenDimension(actor?.prototypeToken?.width, 1);
      const actorHeight = this.#getTokenDimension(actor?.prototypeToken?.height, 1);
      const isAdjacent = /\badjacent\b/i.test(String(markerAreaText ?? ''));
  
      // Find the actual occupied marker bounds in the system matrix.
      let markerMinX = colCount;
      let markerMinY = rowCount;
      let markerMaxX = -1;
      let markerMaxY = -1;
      for (let y = 0; y < rowCount; y++) {
        const row = Array.isArray(state[y]) ? state[y] : [];
        for (let x = 0; x < row.length; x++) {
          if (!row[x]) continue;
          markerMinX = Math.min(markerMinX, x);
          markerMinY = Math.min(markerMinY, y);
          markerMaxX = Math.max(markerMaxX, x);
          markerMaxY = Math.max(markerMaxY, y);
        }
      }
      if (markerMaxX < 0) return null;
  
      const markerWidth = markerMaxX - markerMinX + 1;
      const markerHeight = markerMaxY - markerMinY + 1;
  
      let minX;
      let minY;
      let maxX;
      let maxY;
      let actorLeft;
      let actorTop;
  
      if (isAdjacent) {
        // Adjacent: keep one empty column on each side, place the actor directly
        // below the marker, and use a rightward tie-breaker for even-sized actors
        // under odd-sized marker widths (e.g. 2x2 actor under 5x5 marker).
        const totalWidth = markerWidth + 2;
        const totalHeight = markerHeight + actorHeight;
        const topPadding = Math.max(0, totalWidth - totalHeight);
  
        minX = markerMinX - 1;
        maxX = markerMaxX + 1;
        minY = markerMinY - topPadding;
        maxY = markerMaxY + actorHeight;
  
        actorLeft = markerMinX + Math.ceil((markerWidth - actorWidth) / 2);
        actorTop = markerMaxY + 1;
  
        // If the actor is wider/taller than the marker, keep the complete actor
        // footprint inside the square preview while preserving adjacency.
        if (actorWidth > markerWidth) {
          actorLeft = markerMinX - Math.floor((actorWidth - markerWidth) / 2);
          minX = Math.min(minX, actorLeft - 1);
          maxX = Math.max(maxX, actorLeft + actorWidth);
        }
        maxY = Math.max(maxY, actorTop + actorHeight - 1);
      } else {
        // Centered: always use one empty row/column around the marker and place
        // the actor exactly in the geometric center of the marker area.
        const totalWidth = markerWidth + 2;
        const totalHeight = markerHeight + 2;
        const actorLeftInMarker = Math.floor((markerWidth - actorWidth) / 2);
        const actorTopInMarker = Math.floor((markerHeight - actorHeight) / 2);
  
        minX = markerMinX - 1;
        minY = markerMinY - 1;
        maxX = markerMaxX + 1;
        maxY = markerMaxY + 1;
        actorLeft = markerMinX + actorLeftInMarker;
        actorTop = markerMinY + actorTopInMarker;
  
        // Keep centered previews square even if a non-square marker matrix is
        // supplied. Padding is distributed symmetrically around the marker.
        if (totalWidth !== totalHeight) {
          if (totalWidth > totalHeight) {
            const extra = totalWidth - totalHeight;
            const top = Math.floor(extra / 2);
            const bottom = extra - top;
            minY -= top;
            maxY += bottom;
            actorTop += top;
          } else {
            const extra = totalHeight - totalWidth;
            const left = Math.floor(extra / 2);
            const right = extra - left;
            minX -= left;
            maxX += right;
            actorLeft += left;
          }
        }
      }
  
      const width = maxX - minX + 1;
      const height = maxY - minY + 1;
      const cropped = Array.from({ length: height }, (_, y) =>
        Array.from({ length: width }, (_, x) => Boolean(state[minY + y]?.[minX + x])),
      );
  
      return this.#buildMarkerGraphicFromGrid(cropped, actor, {
        label: localize("FFXIVTTRPGLayout.Marker.Preview", `${width}x${height} marker preview`, { size: `${width}x${height}` }),
        actorOrigin: {
          x: actorLeft - minX + Math.floor(actorWidth / 2),
          y: actorTop - minY + Math.floor(actorHeight / 2),
        },
        actorWidth,
        actorHeight,
        marker,
        index,
      });
    }

  static #buildMarkerGraphicFromGrid(state, actor, {
      label = 'Marker preview',
      actorOrigin = { x: 0, y: 0 },
      actorWidth = 1,
      actorHeight = 1,
      marker = null,
      index = 0,
    } = {}) {
      const rows = state.length;
      const cols = rows ? Math.max(0, ...state.map(row => row.length)) : 0;
      if (!rows || !cols) return null;
  
      const actorLeft = actorOrigin.x - Math.floor(actorWidth / 2);
      const actorTop = actorOrigin.y - Math.floor(actorHeight / 2);
  
      const graphic = document.createElement('div');
      graphic.classList.add('ffxiv-actor-embed__marker-graphic');
      if (index > 0) graphic.classList.add('ffxiv-actor-embed__marker-graphic--additional');
      graphic.setAttribute('role', 'img');
      graphic.setAttribute('aria-label', label);
      if (marker?.type) graphic.dataset.markerType = marker.type;
      if (marker?.mode) graphic.dataset.markerMode = marker.mode;
  
      const grid = document.createElement('div');
      grid.classList.add('ffxiv-actor-embed__marker-grid');
      grid.style.setProperty('--marker-cols', String(cols));
      grid.style.setProperty('--marker-rows', String(rows));
      grid.style.setProperty('--marker-ratio', `${cols} / ${rows}`);
  
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const cell = document.createElement('span');
          cell.classList.add('ffxiv-actor-embed__marker-cell');
          const isMarker = Boolean(state[row]?.[col]);
          const inActor =
            col >= actorLeft && col < actorLeft + actorWidth &&
            row >= actorTop && row < actorTop + actorHeight;
          cell.classList.toggle('is-marker', isMarker);
          cell.classList.toggle('is-origin', inActor);
          grid.appendChild(cell);
        }
      }
  
      if (actor?.img) {
        const actorImage = document.createElement('img');
        actorImage.classList.add('ffxiv-actor-embed__marker-image');
        actorImage.src = actor.img;
        actorImage.alt = actor.name ?? '';
        actorImage.loading = 'lazy';
        // The actor coordinates are already expressed in the cropped grid's
        // coordinate system. Do not offset them again: doing so shifts the
        // actor one full cell down and right, which breaks centered and
        // adjacent marker previews alike.
        actorImage.style.setProperty('--actor-left', String(actorLeft));
        actorImage.style.setProperty('--actor-top', String(actorTop));
        actorImage.style.setProperty('--actor-width', String(actorWidth));
        actorImage.style.setProperty('--actor-height', String(actorHeight));
        actorImage.style.setProperty('--marker-cols', String(cols));
        actorImage.style.setProperty('--marker-rows', String(rows));
        grid.appendChild(actorImage);
      }
  
      graphic.appendChild(grid);
      return graphic;
    }

  static #parseMarkerGridSize(value) {
      const text = String(value ?? '').trim();
      const match = text.match(/\b(\d+)\s*[x×]\s*(\d+)\b/i);
      if (!match) return null;
      const width = Math.max(1, Math.min(20, Number(match[1])));
      const height = Math.max(1, Math.min(20, Number(match[2])));
      return { width, height };
    }

  static #getTokenDimension(value, fallback = 1) {
      const number = Number(value);
      return Number.isFinite(number) && number > 0 ? Math.max(1, Math.min(20, Math.round(number))) : fallback;
    }

  

  static #getNpcSizeGrid(sizeValue, actor) {
      const size = String(sizeValue ?? "").trim().toLowerCase();
      const map = {
        small: "1x1",
        medium: "1x1",
        large: "2x2",
        huge: "3x3",
        colossal: "4x4"
      };
      if (map[size]) return map[size];
  
      const width = actor?.prototypeToken?.width;
      const height = actor?.prototypeToken?.height;
      if (Number.isFinite(width) && Number.isFinite(height)) return `${width}x${height}`;
      return "";
    }

  

  

  static #formatAbilityCheck(value) {
      const text = String(value ?? "").trim();
      const map = {
        "FFXIV.Attributes.Strength.long": "STR",
        "FFXIV.Attributes.Dexterity.long": "DEX",
        "FFXIV.Attributes.Vitality.long": "VIT",
        "FFXIV.Attributes.Intelligence.long": "INT",
        "FFXIV.Attributes.Mind.long": "MND"
      };
      return map[text] ?? text;
    }

  static #escapeHTML(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

  static #getActorAbilityGroup(item) {
      const type = item?.type;
      if (type === "primary_ability") return "primary";
      if (type === "secondary_ability") return "secondary";
      if (type === "instant_ability") return "instant";
  
      if (type !== "ability") return null;
  
      const tags = Array.isArray(item.system?.tags) ? item.system.tags : [];
      if (tags.includes("FFXIV.Tags.Primary")) return "primary";
      if (tags.includes("FFXIV.Tags.Secondary")) return "secondary";
      if (tags.includes("FFXIV.Tags.Instant")) return "instant";
  
      return null;
    }

  static #numberOrFallback(value, fallback = 0) {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    }

  static #displayValue(value) {
      if (value === null || value === undefined) return "";
      const text = String(value).trim();
      return text;
    }

  static #getItemTagLabels(item, tags) {
      const itemTags = Array.isArray(tags)
        ? tags.map((tag) => String(tag ?? "").trim()).filter(Boolean)
        : [];

      // Tags are authoritative. Every supplied tag is displayed; there is no
      // type-specific whitelist. minion_type is only a fallback when no tags exist.
      if (itemTags.length) return localizeTags(itemTags);

      const minionType = String(item?.system?.minion_type ?? "").trim();
      if (!minionType) return [];

      const label = localizeTags([minionType])[0] ?? "";
      return label ? [label] : [];
    }

}

export async function createActorEmbed(uuid, options = {}) {
  return FFXIVActorEmbed.createActorEmbed(uuid, options);
}

export function registerNPCEmbed() {
  CONFIG.TextEditor.enrichers.push({
    id: "ffxiv-actor-embed",
    pattern: /@FFXIVActor\[([^\]\s]+)\](?:\{([^}]+)\})?/g,
    enricher: async match => {
      const uuid = match?.[1];
      const { label, options } = parseEnricherOptions(match?.[2]);
      const modifiers = new Set(options.map(part => part.toLowerCase()));

      const double = modifiers.has("double");
      const position = double
        ? "center"
        : (["left", "right", "center"].find(value => modifiers.has(value)) ?? "center");

      const element = await createActorEmbed(uuid, {
        label,
        position,
        double
      });

      if (!element) return null;
      if (label) element.dataset.label = label;
      return element;
    }
  });
}
