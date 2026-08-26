const { createApp, ref, reactive, computed, onMounted, onBeforeUnmount, nextTick, watch } = Vue;

const STORAGE_KEY = 'svgColorPicker.palette';

function normalizeColor(c) {
  if (!c) return null;
  c = c.trim().toLowerCase();
  if (c === 'none' || c === 'transparent') return c;
  return c;
}

function colorToHex(c) {
  // best-effort conversion of a CSS color to #rrggbb for the <input type=color>
  if (!c) return '#000000';
  c = c.trim();
  if (c.startsWith('#')) {
    if (c.length === 4) {
      return '#' + [1, 2, 3].map(i => c[i] + c[i]).join('');
    }
    if (c.length === 7) return c;
  }
  // fallback: use a canvas to resolve named colors / rgb()
  const d = document.createElement('canvas').getContext('2d');
  try {
    d.fillStyle = c;
    return d.fillStyle.startsWith('#') ? d.fillStyle : '#000000';
  } catch (e) {
    return '#000000';
  }
}

const DEFAULT_PALETTE = [
  '#e05a5a', '#f2994a', '#f2c94c', '#58d68d',
  '#5b8def', '#9b59b6', '#2c2f36', '#ffffff'
];

createApp({
  setup() {
    const svgMarkupOriginal = ref(''); // pristine, never mutated visually
    const svgHostA = ref(null); // "before" pane (read-only, shows original)
    const svgHostB = ref(null); // "after"/working pane (editable)
    const fileName = ref('');
    const hasSvg = computed(() => !!svgMarkupOriginal.value);

    const compareMode = ref(true);
    const transparentBackground = ref(true);
    const isDragOver = ref(false);

    const palette = reactive(loadPalette());
    const selectedPaletteIndex = ref(palette.length ? 0 : -1);
    const currentColor = ref(palette.length ? palette[0] : '#5b8def');
    const newColorHex = ref('#5b8def');

    const detectedColors = ref([]); // [{color, count}]
    const selectedDetectedColors = ref([]); // array, supports multi-select

    // One shared zoom/pan state for both preview panes, so the original and
    // editing views always show the same region at the same scale - there's
    // nothing to keep in sync since they read the same reactive object.
    const view = reactive({ zoom: 1, panX: 0, panY: 0 });
    const ZOOM_MIN = 0.2;
    const ZOOM_MAX = 8;
    const ZOOM_STEP = 0.0015;

    function paneTransform() {
      return `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`;
    }

    function onWheelZoom(e) {
      if (!hasSvg.value) return;
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      const oldZoom = view.zoom;
      const factor = Math.exp(-e.deltaY * ZOOM_STEP);
      const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, oldZoom * factor));
      if (newZoom === oldZoom) return;
      // keep the point under the cursor fixed while zooming
      view.panX = cx - (cx - view.panX) * (newZoom / oldZoom);
      view.panY = cy - (cy - view.panY) * (newZoom / oldZoom);
      view.zoom = newZoom;
    }

    function resetZoom() {
      view.zoom = 1;
      view.panX = 0;
      view.panY = 0;
    }

    const dragState = { active: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0, dragged: false };

    function onPaneMouseDown(e) {
      if (!hasSvg.value || e.button !== 0) return;
      dragState.active = true;
      dragState.startX = e.clientX;
      dragState.startY = e.clientY;
      dragState.startPanX = view.panX;
      dragState.startPanY = view.panY;
      dragState.dragged = false;
      window.addEventListener('mousemove', onPaneMouseMove);
      window.addEventListener('mouseup', onPaneMouseUp);
    }

    function onPaneMouseMove(e) {
      if (!dragState.active) return;
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragState.dragged = true;
      if (!dragState.dragged) return;
      view.panX = dragState.startPanX + dx;
      view.panY = dragState.startPanY + dy;
    }

    function onPaneMouseUp() {
      dragState.active = false;
      window.removeEventListener('mousemove', onPaneMouseMove);
      window.removeEventListener('mouseup', onPaneMouseUp);
    }

    const history = reactive({ stack: [], index: -1 }); // undo/redo of full SVG markup snapshots

    function loadPalette() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length) return parsed;
        }
      } catch (e) { /* ignore */ }
      return DEFAULT_PALETTE.slice();
    }

    function savePalette() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(palette));
      } catch (e) { /* ignore quota errors */ }
    }
    watch(palette, savePalette, { deep: true });

    // ---------- SVG loading ----------

    function handleFile(file) {
      if (!file) return;
      if (!/\.svg$/i.test(file.name) && file.type !== 'image/svg+xml') {
        alert('Please choose an SVG file.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        loadSvgMarkup(e.target.result, file.name);
      };
      reader.readAsText(file);
    }

    function loadSvgMarkup(markup, name) {
      svgMarkupOriginal.value = markup;
      fileName.value = name || 'image.svg';
      history.stack = [markup];
      history.index = 0;
      resetZoom();
      selectedDetectedColors.value = [];
      nextTick(() => {
        renderInto(svgHostA.value, markup, false);
        renderInto(svgHostB.value, markup, true);
        scanColors();
      });
    }

    function onFileInputChange(e) {
      const file = e.target.files && e.target.files[0];
      handleFile(file);
      e.target.value = '';
    }

    function onDrop(e) {
      e.preventDefault();
      isDragOver.value = false;
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      handleFile(file);
    }

    function onDragOver(e) { e.preventDefault(); isDragOver.value = true; }
    function onDragLeave(e) { isDragOver.value = false; }

    // ---------- Rendering ----------

    let svgRootB = null; // the live <svg> element user paints on

    function renderInto(hostEl, markup, interactive) {
      if (!hostEl) return;
      hostEl.innerHTML = markup;
      const svgEl = hostEl.querySelector('svg');
      if (!svgEl) return;
      svgEl.removeAttribute('width');
      svgEl.removeAttribute('height');
      svgEl.style.width = '100%';
      svgEl.style.height = 'auto';

      // tag every shape/paintable element
      const paintable = getPaintableElements(svgEl);
      paintable.forEach(el => el.setAttribute('data-paintable', '1'));

      if (interactive) {
        svgRootB = svgEl;
        svgEl.addEventListener('click', onSvgClick);
      }
    }

    const SHAPE_TAGS = ['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line', 'text', 'g'];

    function getPaintableElements(svgEl) {
      // Prefer leaf shape nodes; skip <g> wrappers that only group (no direct fill use needed)
      // but include <g> if it has a fill attribute itself and no shape children with their own fill.
      const all = Array.from(svgEl.querySelectorAll(SHAPE_TAGS.join(',')));
      return all.filter(el => el.tagName.toLowerCase() !== 'g' || el.getAttribute('fill') || el.style.fill);
    }

    function onSvgClick(e) {
      if (dragState.dragged) return; // ignore click that ends a pan drag
      const target = e.target.closest('[data-paintable]');
      if (!target) return;
      e.stopPropagation();
      applyColorToElement(target, currentColor.value, e.shiftKey);
    }

    function applyColorToElement(el, color, editStroke) {
      const prop = editStroke ? 'stroke' : 'fill';
      el.setAttribute(prop, color);
      el.style.removeProperty(prop);
      pushHistorySnapshot();
      scanColors();
    }

    // ---------- History (undo/redo) ----------

    function pushHistorySnapshot() {
      if (!svgRootB) return;
      const markup = svgRootB.outerHTML;
      history.stack = history.stack.slice(0, history.index + 1);
      history.stack.push(markup);
      history.index = history.stack.length - 1;
    }

    function undo() {
      if (history.index <= 0) return;
      history.index--;
      renderInto(svgHostB.value, history.stack[history.index], true);
      scanColors();
    }

    function redo() {
      if (history.index >= history.stack.length - 1) return;
      history.index++;
      renderInto(svgHostB.value, history.stack[history.index], true);
      scanColors();
    }

    const canUndo = computed(() => history.index > 0);
    const canRedo = computed(() => history.index < history.stack.length - 1);

    function resetToOriginal() {
      if (!confirm('Discard all color changes and reset to the original SVG?')) return;
      renderInto(svgHostB.value, svgMarkupOriginal.value, true);
      history.stack = [svgMarkupOriginal.value];
      history.index = 0;
      scanColors();
    }

    // ---------- Color detection / recolor-all ----------

    // Shapes whose effective width (2*area/perimeter - approximates average
    // thickness regardless of orientation or length) falls below this
    // fraction of the canvas's smaller dimension are treated as hairline
    // slivers/stray outline fragments rather than meaningful detail:
    // excluded from the "Colors in SVG" counts and from layer export (both
    // as a layer's own silhouette and as a potential cutter for other
    // layers). Area alone can't tell a thin elongated sliver apart from a
    // small chunky detail (both can have similarly small area), which is
    // why this uses effective width instead. Filtered shapes remain fully
    // clickable/paintable on the canvas - this only affects aggregation and
    // export.
    const MIN_EFFECTIVE_WIDTH_FRACTION = 0.0025;

    function minEffectiveWidth() {
      const canvas = getCanvasViewBox();
      return canvas ? Math.min(canvas.w, canvas.h) * MIN_EFFECTIVE_WIDTH_FRACTION : 0;
    }

    function scanColors() {
      if (!svgRootB) { detectedColors.value = []; return; }
      const threshold = minEffectiveWidth();
      const counts = new Map();
      const topmostIndex = new Map(); // color -> highest (last) z-order index seen
      const els = getPaintableElements(svgRootB);
      els.forEach((el, i) => {
        const fill = normalizeColor(el.getAttribute('fill') || getComputedStyle(el).fill);
        if (!fill || fill === 'none') return;
        if (threshold > 0) {
          const rings = SvgGeometry.shapeToRings(el, svgRootB, SvgGeometry.FLATTEN_TOLERANCE);
          if (rings.length && SvgGeometry.shapeEffectiveWidth(rings) < threshold) return;
        }
        counts.set(fill, (counts.get(fill) || 0) + 1);
        topmostIndex.set(fill, i); // document order == stacking order, later wins
      });
      detectedColors.value = Array.from(counts.entries())
        .map(([color, count]) => ({ color, count }))
        .sort((a, b) => topmostIndex.get(b.color) - topmostIndex.get(a.color))
        .map((item, i) => ({ ...item, layer: i + 1 }));
    }

    function toggleDetectedColor(color, e) {
      const multi = e && (e.ctrlKey || e.metaKey || e.shiftKey);
      if (multi) {
        const idx = selectedDetectedColors.value.indexOf(color);
        if (idx === -1) selectedDetectedColors.value = [...selectedDetectedColors.value, color];
        else selectedDetectedColors.value = selectedDetectedColors.value.filter(c => c !== color);
      } else {
        selectedDetectedColors.value = [color];
      }
      if (selectedDetectedColors.value.length === 1) {
        currentColor.value = selectedDetectedColors.value[0];
      }
      highlightMatching(selectedDetectedColors.value);
    }

    function clearDetectedSelection() {
      selectedDetectedColors.value = [];
      highlightMatching([]);
    }

    function highlightMatching(colors) {
      if (!svgRootB) return;
      svgRootB.querySelectorAll('.fill-target-highlight').forEach(el => el.classList.remove('fill-target-highlight'));
      if (!colors.length) return;
      getPaintableElements(svgRootB).forEach(el => {
        const fill = normalizeColor(el.getAttribute('fill') || getComputedStyle(el).fill);
        if (colors.includes(fill)) el.classList.add('fill-target-highlight');
      });
    }

    // Hovering a color in the "Colors in SVG" list flashes every matching
    // shape in both preview panes with a neon-green outline, so it's easy to
    // spot where that color actually is in the artwork.
    function hoverDetectedColor(color) {
      [svgHostA.value, svgHostB.value].forEach(host => {
        if (!host) return;
        const svgEl = host.querySelector('svg');
        if (!svgEl) return;
        svgEl.querySelectorAll('.hover-highlight').forEach(el => {
          el.classList.remove('hover-highlight');
          el.style.removeProperty('--hover-highlight-original');
        });
        if (!color) return;
        getPaintableElements(svgEl).forEach(el => {
          const fill = normalizeColor(el.getAttribute('fill') || getComputedStyle(el).fill);
          if (fill === color) {
            el.style.setProperty('--hover-highlight-original', color);
            el.classList.add('hover-highlight');
          }
        });
      });
    }

    function recolorSelected(newColor) {
      if (!svgRootB || !selectedDetectedColors.value.length) return;
      const targets = selectedDetectedColors.value;
      getPaintableElements(svgRootB).forEach(el => {
        const fill = normalizeColor(el.getAttribute('fill') || getComputedStyle(el).fill);
        if (targets.includes(fill)) {
          el.setAttribute('fill', newColor);
          el.style.removeProperty('fill');
        }
      });
      pushHistorySnapshot();
      scanColors();
      selectedDetectedColors.value = [];
    }

    // ---------- Palette ----------

    function selectPaletteColor(index) {
      selectedPaletteIndex.value = index;
      currentColor.value = palette[index];
    }

    function addColorToPalette() {
      palette.push(newColorHex.value);
      selectPaletteColor(palette.length - 1);
    }

    function removeColorFromPalette(index) {
      palette.splice(index, 1);
      if (selectedPaletteIndex.value === index) selectedPaletteIndex.value = -1;
      else if (selectedPaletteIndex.value > index) selectedPaletteIndex.value--;
    }

    function onCurrentColorTextInput(e) {
      currentColor.value = e.target.value;
    }

    // keyboard shortcuts 1-9, 0 -> jump to palette slot
    function onKeydown(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo(); return; }
      if (e.key === 'y' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); redo(); return; }
      if (/^[0-9]$/.test(e.key)) {
        const n = parseInt(e.key, 10);
        const idx = n === 0 ? 9 : n - 1;
        if (idx < palette.length) {
          selectPaletteColor(idx);
        }
      }
    }

    onMounted(() => {
      window.addEventListener('keydown', onKeydown);
    });
    onBeforeUnmount(() => {
      window.removeEventListener('keydown', onKeydown);
    });

    // ---------- Export ----------

    function serializeCleanSvg(svgEl) {
      const serializer = new XMLSerializer();
      let markup = serializer.serializeToString(svgEl);
      markup = markup
        .replace(/\sdata-paintable="1"/g, '')
        .replace(/\sclass="fill-target-highlight"/g, '')
        .replace(/\sclass=""/g, '');
      return markup;
    }

    function triggerDownload(content, filename, mime) {
      const blob = new Blob([content], { type: mime || 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    function baseName() {
      return fileName.value.replace(/\.svg$/i, '') || 'image';
    }

    function sanitizeForFilename(str) {
      return str.replace(/[^a-z0-9_-]/gi, '') || 'color';
    }

    function downloadSvg() {
      if (!svgRootB) return;
      const markup = serializeCleanSvg(svgRootB);
      triggerDownload(markup, baseName() + '-recolored.svg');
    }

    function layerFileName(item) {
      const label = item.color === BACKGROUND_COLOR ? 'background-ffffff' : sanitizeForFilename(item.color);
      return baseName() + '-layer' + item.layer + '-' + label + '.svg';
    }

    // Curve flattening (geometry.js) and the boolean-subtraction clipping
    // (martinez, in the worker) both produce far more points per path than
    // the shapes visually need - flattening samples curves finely, and
    // clipping adds an intersection vertex everywhere two edges cross, even
    // when the result is still nearly a straight line there. Slicers that
    // import these as modifiers re-triangulate every vertex, so an
    // unsimplified export can make an otherwise-small file painfully slow
    // to load. Douglas-Peucker removes points that don't meaningfully change
    // the outline shape before we serialize to a path.
    const SIMPLIFY_TOLERANCE = 0.35; // px; matches roughly half FLATTEN_TOLERANCE

    function perpendicularDistance(pt, a, b) {
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy);
      if (len === 0) return Math.hypot(pt[0] - a[0], pt[1] - a[1]);
      return Math.abs((pt[0] - a[0]) * dy - (pt[1] - a[1]) * dx) / len;
    }

    function douglasPeucker(points, tolerance) {
      if (points.length < 3) return points;
      let maxDist = 0, maxIndex = 0;
      const first = points[0], last = points[points.length - 1];
      for (let i = 1; i < points.length - 1; i++) {
        const d = perpendicularDistance(points[i], first, last);
        if (d > maxDist) { maxDist = d; maxIndex = i; }
      }
      if (maxDist <= tolerance) return [first, last];
      const left = douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
      const right = douglasPeucker(points.slice(maxIndex), tolerance);
      return left.slice(0, -1).concat(right);
    }

    // Runs Douglas-Peucker around the ring as a loop (rather than treating
    // it as an open line from first to last point), since a closed ring has
    // no natural start/end - splitting it at a few evenly spaced anchor
    // points keeps the simplification from distorting the shape near the
    // arbitrary index-0 seam.
    function simplifyRing(ring, tolerance) {
      const pts = (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1])
        ? ring.slice(0, -1) : ring;
      if (pts.length < 5) return pts;
      const anchors = 4;
      const step = Math.floor(pts.length / anchors) || 1;
      let result = [];
      for (let a = 0; a < anchors; a++) {
        const startI = a * step;
        const endI = a === anchors - 1 ? pts.length - 1 : (a + 1) * step;
        const segment = pts.slice(startI, endI + 1).concat(a === anchors - 1 ? [pts[0]] : []);
        if (segment.length < 2) continue;
        const simplified = douglasPeucker(segment, tolerance);
        result = result.concat(a === 0 ? simplified : simplified.slice(1));
      }
      return result.length >= 3 ? result : pts;
    }

    // martinez polygon = array of rings (ring[0] outer, ring[1..] holes).
    // fill-rule="evenodd" makes overlapping opposite-orientation rings
    // render as holes regardless of winding direction, so no explicit
    // CW/CCW bookkeeping is needed here.
    function ringToPathD(ring) {
      if (ring.length < 3) return '';
      const pts = simplifyRing(ring, SIMPLIFY_TOLERANCE);
      if (pts.length < 3) return '';
      return 'M' + pts.map(([x, y]) => `${round(x)},${round(y)}`).join('L') + 'Z';
    }

    function round(n) {
      return Math.round(n * 1000) / 1000;
    }

    function polygonsToPathD(polygons) {
      return polygons
        .flatMap(polygon => polygon.map(ringToPathD))
        .filter(Boolean)
        .join(' ');
    }

    function getCanvasViewBox() {
      const viewBox = svgRootB.getAttribute('viewBox');
      if (viewBox) {
        const parts = viewBox.trim().split(/[\s,]+/).map(Number);
        return { attr: viewBox, x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
      }
      const w = parseFloat(svgRootB.getAttribute('width'));
      const h = parseFloat(svgRootB.getAttribute('height'));
      if (w && h) return { attr: `0 0 ${w} ${h}`, x: 0, y: 0, w, h };
      return null;
    }

    function svgFromPolygons(polygons, color, includeWhiteBg) {
      const pathD = polygonsToPathD(polygons);
      if (!pathD) return null;
      const canvas = getCanvasViewBox();
      const ns = 'http://www.w3.org/2000/svg';
      const outSvg = document.createElementNS(ns, 'svg');
      outSvg.setAttribute('xmlns', ns);
      if (canvas) outSvg.setAttribute('viewBox', canvas.attr);
      if (includeWhiteBg && canvas) {
        const bgRect = document.createElementNS(ns, 'rect');
        bgRect.setAttribute('x', canvas.x);
        bgRect.setAttribute('y', canvas.y);
        bgRect.setAttribute('width', canvas.w);
        bgRect.setAttribute('height', canvas.h);
        bgRect.setAttribute('fill', '#ffffff');
        outSvg.appendChild(bgRect);
      }
      const pathEl = document.createElementNS(ns, 'path');
      pathEl.setAttribute('d', pathD);
      pathEl.setAttribute('fill', color);
      pathEl.setAttribute('fill-rule', 'evenodd');
      outSvg.appendChild(pathEl);
      return serializeCleanSvg(outSvg);
    }

    // Extracts, per requested color, this color's own shapes (each as rings)
    // plus, for each own-shape, only the shapes stacked above THAT specific
    // shape whose bounding box actually overlaps it. Cheap DOM/attribute
    // work done on the main thread; the actual boolean subtraction (via the
    // bundled martinez clipping library) runs in a Web Worker so the tab
    // never freezes, however long the geometry takes.
    // Synthetic bottommost shape spanning the whole canvas, used as a real
    // "background color" layer when the transparent-background toggle is
    // off: it gets cut by every actual shape in the artwork just like any
    // other layer, so its exported silhouette is exactly the gaps nothing
    // else covers - a proper solid-color backing layer for stacking/print,
    // not just a decorative rect.
    function backgroundShapeInfo() {
      const canvas = getCanvasViewBox();
      if (!canvas) return null;
      const ring = [
        [canvas.x, canvas.y], [canvas.x + canvas.w, canvas.y],
        [canvas.x + canvas.w, canvas.y + canvas.h], [canvas.x, canvas.y + canvas.h],
        [canvas.x, canvas.y],
      ];
      return { index: -1, fill: BACKGROUND_COLOR, rings: [ring], bbox: canvas.w ? { minX: canvas.x, minY: canvas.y, maxX: canvas.x + canvas.w, maxY: canvas.y + canvas.h } : null };
    }

    const BACKGROUND_COLOR = '__background__';

    function buildSubtractionRequests(colors) {
      if (!svgRootB) return [];
      const threshold = minEffectiveWidth();
      const els = getPaintableElements(svgRootB);
      const shapeInfo = els.map((el, i) => {
        if (el.tagName.toLowerCase() === 'g') return null;
        const fill = normalizeColor(el.getAttribute('fill') || el.style.fill);
        const rings = SvgGeometry.shapeToRings(el, svgRootB, SvgGeometry.FLATTEN_TOLERANCE);
        if (!rings.length) return null;
        if (threshold > 0 && SvgGeometry.shapeEffectiveWidth(rings) < threshold) return null;
        return { index: i, fill, rings, bbox: SvgGeometry.ringsBBox(rings) };
      });

      if (!transparentBackground.value) {
        const bg = backgroundShapeInfo();
        if (bg) shapeInfo.push(bg);
      }

      return colors.map(item => {
        const ownShapes = shapeInfo.filter(s => s && s.fill === item.color);
        const cutterShapes = ownShapes.map(own => {
          const cutters = [];
          for (let j = 0; j < shapeInfo.length; j++) {
            const other = shapeInfo[j];
            if (!other || other.index <= own.index) continue;
            if (!SvgGeometry.bboxOverlap(own.bbox, other.bbox)) continue;
            cutters.push(other.rings);
          }
          return cutters;
        });
        return {
          color: item.color,
          layer: item.layer,
          ownShapes: ownShapes.map(s => s.rings),
          cutterShapes,
        };
      }).filter(r => r.ownShapes.length);
    }

    const isExporting = ref(false);
    const exportLabel = ref('');
    const exportProgress = ref({ done: 0, total: 0 });

    let layerWorker = null;
    let workerJobCounter = 0;
    let activeJob = null;

    function getLayerWorker() {
      if (!layerWorker) {
        layerWorker = new Worker('layer-worker.js');
        layerWorker.onmessage = (e) => {
          const msg = e.data;
          if (!activeJob || msg.jobId !== activeJob.id) return;
          if (msg.type === 'progress') {
            exportProgress.value = { done: msg.done, total: msg.total };
            exportLabel.value = `Building layer ${msg.done} of ${msg.total}...`;
          } else if (msg.type === 'done') {
            const resolve = activeJob.resolve;
            activeJob = null;
            resolve(msg.results);
          }
        };
        layerWorker.onerror = (err) => {
          console.error('Layer worker error:', err.message);
          if (activeJob) {
            const resolve = activeJob.resolve;
            activeJob = null;
            resolve(null);
          }
        };
      }
      return layerWorker;
    }

    // Runs the boolean subtraction for `requests` in the worker, resolving
    // with [{color, layer, polygons}] (never blocks the main thread).
    function runSubtractionJob(requests) {
      return new Promise((resolve) => {
        const worker = getLayerWorker();
        const id = ++workerJobCounter;
        activeJob = { id, resolve };
        exportProgress.value = { done: 0, total: requests.length };
        worker.postMessage({ type: 'build', jobId: id, requests });
      });
    }

    function cancelExport() {
      if (layerWorker) {
        layerWorker.terminate();
        layerWorker = null;
      }
      activeJob = null;
      isExporting.value = false;
    }

    async function downloadLayer(item) {
      isExporting.value = true;
      exportLabel.value = 'Building layer...';
      try {
        const requests = buildSubtractionRequests([item]);
        const results = requests.length ? await runSubtractionJob(requests) : [];
        if (!isExporting.value) return; // cancelled
        const result = results && results[0];
        const markup = result ? svgFromPolygons(result.polygons, item.color) : null;
        if (!markup) return;
        triggerDownload(markup, layerFileName(item));
      } finally {
        isExporting.value = false;
      }
    }

    async function downloadAllLayersZip() {
      if (!svgRootB || !detectedColors.value.length) return;
      isExporting.value = true;
      exportLabel.value = 'Building layers...';
      try {
        const requestedItems = detectedColors.value.slice();
        if (!transparentBackground.value) {
          requestedItems.push({ color: BACKGROUND_COLOR, layer: detectedColors.value.length + 1 });
        }
        const requests = buildSubtractionRequests(requestedItems);
        const results = requests.length ? await runSubtractionJob(requests) : [];
        if (!isExporting.value) return; // cancelled
        if (!results) return; // worker error
        exportLabel.value = 'Zipping...';
        const itemByColor = new Map(requestedItems.map(item => [item.color, item]));
        const files = results
          .map(r => ({
            item: itemByColor.get(r.color),
            markup: svgFromPolygons(r.polygons, r.color === BACKGROUND_COLOR ? '#ffffff' : r.color),
          }))
          .filter(f => f.markup)
          .map(f => ({ name: layerFileName(f.item), content: f.markup }));
        files.push({ name: baseName() + '-complete.svg', content: serializeCleanSvg(svgRootB) });
        if (!files.length) return;
        const zipBlob = createZip(files);
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = baseName() + '-layers.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } finally {
        isExporting.value = false;
      }
    }

    return {
      hasSvg, fileName, compareMode, transparentBackground, isDragOver,
      svgHostA, svgHostB,
      palette, selectedPaletteIndex, currentColor, newColorHex,
      detectedColors, selectedDetectedColors,
      canUndo, canRedo,
      view, paneTransform, onWheelZoom, resetZoom, onPaneMouseDown,
      onFileInputChange, onDrop, onDragOver, onDragLeave,
      selectPaletteColor, addColorToPalette, removeColorFromPalette,
      onCurrentColorTextInput,
      toggleDetectedColor, clearDetectedSelection, recolorSelected, hoverDetectedColor,
      undo, redo, resetToOriginal, downloadSvg,
      downloadLayer, downloadAllLayersZip, isExporting, exportLabel, exportProgress, cancelExport,
      colorToHex,
    };
  }
}).mount('#app');
