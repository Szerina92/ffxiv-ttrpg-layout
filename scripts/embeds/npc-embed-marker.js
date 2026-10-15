/**
 * FFXIV TTRPG Layout — experimental NPC marker graphics.
 *
 * Renders the area of effect of an ability as a small grid preview, either
 * from the saved marker state matrix or, as a fallback, from the marker text.
 */

import { localize } from "../i18n.js";
import { text } from "../utils/values.js";

/** Build the optional experimental marker graphics of one ability. */
export function buildMarkerGraphics(item, actor) {
  const markers = Array.isArray(item?.system?.markers)
    ? item.system.markers.filter(marker => Array.isArray(marker?.state))
    : [];

  if (markers.length) {
    return markers
      .map((marker, index) => buildMarkerGraphicFromState(marker, actor, index, item?.system?.marker_area))
      .filter(Boolean);
  }

  // Fallback for marker data without a saved state matrix. We parse the
  // human-readable marker description into the simplest useful geometry.
  // The saved state matrix remains authoritative whenever it exists.
  const markerText = text(item?.system?.marker_area);
  const fallback = buildMarkerFallbackState(markerText, actor);
  if (!fallback) return [];

  return [buildMarkerGraphicFromGrid(fallback.state, actor, {
    label: fallback.label,
    actorOrigin: fallback.actorOrigin,
    actorWidth: fallback.actorWidth,
    actorHeight: fallback.actorHeight,
    index: 0,
  })].filter(Boolean);
}

function buildMarkerFallbackState(markerText, actor) {
  const text = String(markerText ?? '').trim();
  const size = parseMarkerGridSize(text);
  if (!size) return null;

  const actorWidth = getTokenDimension(actor?.prototypeToken?.width, 1);
  const actorHeight = getTokenDimension(actor?.prototypeToken?.height, 1);

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
      label: localize("FFXIVTTRPGLayout.Marker.StraightLine", { size: `${size.width}x${size.height}` }),
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
      label: localize("FFXIVTTRPGLayout.Marker.Adjacent", { size: `${size.width}x${size.height}` }),
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
    label: localize("FFXIVTTRPGLayout.Marker.Area", { size: `${size.width}x${size.height}` }),
  };
}

function buildMarkerGraphicFromState(marker, actor, index = 0, markerAreaText = '') {
  const state = marker?.state;
  if (!Array.isArray(state) || !state.length) return null;

  const rowCount = state.length;
  const colCount = Math.max(0, ...state.map(row => Array.isArray(row) ? row.length : 0));
  if (!colCount) return null;

  const actorWidth = getTokenDimension(actor?.prototypeToken?.width, 1);
  const actorHeight = getTokenDimension(actor?.prototypeToken?.height, 1);
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

  return buildMarkerGraphicFromGrid(cropped, actor, {
    label: localize("FFXIVTTRPGLayout.Marker.Preview", { size: `${width}x${height}` }),
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

function buildMarkerGraphicFromGrid(state, actor, {
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

function parseMarkerGridSize(value) {
  const text = String(value ?? '').trim();
  const match = text.match(/\b(\d+)\s*[x×]\s*(\d+)\b/i);
  if (!match) return null;
  const width = Math.max(1, Math.min(20, Number(match[1])));
  const height = Math.max(1, Math.min(20, Number(match[2])));
  return { width, height };
}

function getTokenDimension(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.max(1, Math.min(20, Math.round(number))) : fallback;
}
