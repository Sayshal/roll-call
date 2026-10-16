/** @type {number} Pixels the pointer must travel before a press becomes a drag. */
const DRAG_THRESHOLD = 6;

/** @type {number} Pixels from an edge within which a drop snaps to it; farther drops float. */
const SNAP_DISTANCE = 96;

/** @type {number} Gap kept between the dock and the edge it sits on. */
const EDGE_GAP = 8;

/**
 * The part of the viewport not covered by the left controls, the sidebar or the hotbar.
 * The left edge also stops above the wider widgets under the controls (player list, system buttons) and starts below the viewed and active scene pills.
 * @param {string} [edge] Placement edge.
 * @returns {{left: number, right: number, top: number, bottom: number}} Free area in pixels.
 */
function freeArea(edge) {
  const column = document.getElementById('ui-left-column-1');
  const controls = column?.getBoundingClientRect();
  const sidebar = document.getElementById('sidebar')?.getBoundingClientRect();
  const hotbar = document.getElementById('hotbar')?.getBoundingClientRect();
  const left = edge === 'left';
  const below = left ? [...(column?.children ?? [])].filter((el) => el.id !== 'scene-controls' && el.offsetParent).map((el) => el.getBoundingClientRect().top) : [];
  const pills = left ? [...document.querySelectorAll('#scene-navigation-viewed, #scene-navigation-active')].map((el) => el.getBoundingClientRect().bottom) : [];
  return { left: controls?.right ?? 0, right: sidebar?.left ?? window.innerWidth, top: Math.max(0, ...pills), bottom: Math.min(hotbar?.top ?? window.innerHeight, ...below) };
}

/**
 * Pixel position for a placement given the dock's size.
 * @param {{edge: string, offset: number, x: number, y: number}} placement Stored placement.
 * @param {{width: number, height: number}} size Scaled dock size.
 * @returns {{left: number, top: number}} Top-left corner in pixels.
 */
function resolve(placement, size) {
  const area = freeArea(placement.edge);
  const along = (start, end, length) => start + Math.clamp(placement.offset, 0, 1) * Math.max(end - start - length, 0);
  switch (placement.edge) {
    case 'top':
      return { left: along(area.left, area.right, size.width), top: area.top + EDGE_GAP };
    case 'bottom':
      return { left: along(area.left, area.right, size.width), top: area.bottom - size.height - EDGE_GAP };
    case 'left':
      return { left: area.left + EDGE_GAP, top: along(area.top, area.bottom, size.height) };
    case 'right':
      return { left: area.right - size.width - EDGE_GAP, top: along(area.top, area.bottom, size.height) };
    default:
      return {
        left: Math.clamp(placement.x * window.innerWidth, 0, window.innerWidth - size.width),
        top: Math.clamp(placement.y * window.innerHeight, 0, window.innerHeight - size.height)
      };
  }
}

/**
 * Largest scale up to the user's choice at which the dock still fits along its edge.
 * @param {string} edge Placement edge.
 * @param {number} width Unscaled dock width.
 * @param {number} height Unscaled dock height.
 * @param {number} userScale Scale chosen by the user.
 * @returns {number} Scale to apply.
 */
function fitScale(edge, width, height, userScale) {
  const area = freeArea(edge);
  if (edge === 'top' || edge === 'bottom') return Math.min(userScale, (area.right - area.left - 2 * EDGE_GAP) / width);
  if (edge === 'left' || edge === 'right') return Math.min(userScale, (area.bottom - area.top - 2 * EDGE_GAP) / height);
  return Math.min(userScale, window.innerWidth / width, window.innerHeight / height);
}

/**
 * Whether the dock as currently laid out would have to shrink below the user's scale to fit its placement.
 * @param {HTMLElement} element Dock element.
 * @param {{edge: string}} placement Stored placement.
 * @param {number} userScale Scale chosen by the user.
 * @returns {boolean} Whether it is crowded.
 */
export function isCrowded(element, placement, userScale) {
  return fitScale(placement.edge, element.offsetWidth, element.offsetHeight, userScale) < userScale;
}

/**
 * Position and scale the dock element for a placement, and flag its edge and orientation for styles.
 * Side edges are vertical, top and bottom horizontal; a floating dock uses its own `vertical` flag.
 * Bottom and right docks are anchored to that edge, so cards that grow after measuring (height transitions, re-renders) grow away from it.
 * @param {HTMLElement} element Dock element.
 * @param {{edge: string, offset: number, x: number, y: number, vertical: boolean}} placement Stored placement.
 * @param {number} userScale Scale chosen by the user; shrunk further when the dock would overflow its edge.
 */
export function applyPlacement(element, placement, userScale) {
  const { edge } = placement;
  element.dataset.edge = edge;
  element.dataset.orientation = edge === 'left' || edge === 'right' || (edge === 'float' && placement.vertical) ? 'vertical' : 'horizontal';
  const { offsetWidth: width, offsetHeight: height } = element;
  const scale = fitScale(edge, width, height, userScale);
  const { left, top } = resolve(placement, { width: width * scale, height: height * scale });
  const area = freeArea(edge);
  const fromBottom = edge === 'bottom';
  const fromRight = edge === 'right';
  element.style.transform = `scale(${scale})`;
  element.style.transformOrigin = `${fromBottom ? 'bottom' : 'top'} ${fromRight ? 'right' : 'left'}`;
  element.style.left = fromRight ? 'auto' : `${left}px`;
  element.style.right = fromRight ? `${window.innerWidth - area.right + EDGE_GAP}px` : 'auto';
  element.style.top = fromBottom ? 'auto' : `${top}px`;
  element.style.bottom = fromBottom ? `${window.innerHeight - area.bottom + EDGE_GAP}px` : 'auto';
}

/**
 * Placement a dock dropped at this rectangle would take.
 * @param {DOMRect} rect Dock rectangle at the drop point.
 * @returns {{edge: string, offset: number, x: number, y: number}} Placement.
 */
function placementAt(rect) {
  const area = freeArea();
  const gaps = { top: rect.top - area.top, bottom: area.bottom - rect.bottom, left: rect.left - area.left, right: area.right - rect.right };
  const [edge, gap] = Object.entries(gaps).sort((a, b) => a[1] - b[1])[0];
  const x = rect.left / window.innerWidth;
  const y = rect.top / window.innerHeight;
  if (gap > SNAP_DISTANCE) return { edge: 'float', offset: 0.5, x, y };
  const horizontal = edge === 'top' || edge === 'bottom';
  const span = horizontal ? area.right - area.left - rect.width : area.bottom - area.top - rect.height;
  const start = horizontal ? rect.left - area.left : rect.top - area.top;
  return { edge, offset: span > 0 ? Math.clamp(start / span, 0, 1) : 0.5, x, y };
}

/**
 * Show the snap preview for a placement.
 * @param {HTMLElement} ghost Preview element.
 * @param {{edge: string}} placement Target placement.
 */
function showGhost(ghost, { edge }) {
  const area = freeArea();
  ghost.dataset.edge = edge;
  ghost.hidden = edge === 'float';
  const band = SNAP_DISTANCE / 2;
  const rects = {
    top: [area.left, area.top, area.right - area.left, band],
    bottom: [area.left, area.bottom - band, area.right - area.left, band],
    left: [area.left, area.top, band, area.bottom - area.top],
    right: [area.right - band, area.top, band, area.bottom - area.top]
  };
  const [left, top, width, height] = rects[edge] ?? [0, 0, 0, 0];
  Object.assign(ghost.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
}

/**
 * Drag the dock from a grip press; a press shorter than the threshold does nothing.
 * @param {PointerEvent} event The pointerdown event on the grip.
 * @param {HTMLElement} element Dock element.
 * @param {Function} onDrop Receives the new placement.
 */
export function dragDock(event, element, onDrop) {
  const start = { x: event.clientX, y: event.clientY };
  const origin = element.getBoundingClientRect();
  const ghost = document.createElement('div');
  ghost.className = 'roll-call rc-snap-ghost';
  ghost.hidden = true;
  let dragging = false;
  let placement = null;

  /**
   * Follow the pointer once past the threshold.
   * @param {PointerEvent} move The pointermove event.
   */
  const onMove = (move) => {
    const dx = move.clientX - start.x;
    const dy = move.clientY - start.y;
    if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!dragging) {
      dragging = true;
      document.body.append(ghost);
      element.classList.add('is-dragging');
      Object.assign(element.style, { transformOrigin: 'top left', right: 'auto', bottom: 'auto' });
    }
    element.style.left = `${origin.left + dx}px`;
    element.style.top = `${origin.top + dy}px`;
    placement = placementAt(element.getBoundingClientRect());
    showGhost(ghost, placement);
  };

  /** Save the placement and remove every drag listener. */
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    ghost.remove();
    element.classList.remove('is-dragging');
    if (placement) onDrop(placement);
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}
