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
    const isDragOver = ref(false);

    const palette = reactive(loadPalette());
    const selectedPaletteIndex = ref(palette.length ? 0 : -1);
    const currentColor = ref(palette.length ? palette[0] : '#5b8def');
    const newColorHex = ref('#5b8def');

    const detectedColors = ref([]); // [{color, count}]
    const selectedDetectedColors = ref([]); // array, supports multi-select

    const zoomA = ref(1);
    const zoomB = ref(1);
    const ZOOM_MIN = 0.2;
    const ZOOM_MAX = 8;
    const ZOOM_STEP = 0.0015;

    function onWheelZoom(e, which) {
      if (!hasSvg.value) return;
      e.preventDefault();
      const target = which === 'a' ? zoomA : zoomB;
      const factor = Math.exp(-e.deltaY * ZOOM_STEP);
      target.value = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, target.value * factor));
    }

    function resetZoom(which) {
      if (which === 'a') zoomA.value = 1;
      else zoomB.value = 1;
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
      zoomA.value = 1;
      zoomB.value = 1;
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

    function scanColors() {
      if (!svgRootB) { detectedColors.value = []; return; }
      const counts = new Map();
      const els = getPaintableElements(svgRootB);
      els.forEach(el => {
        const fill = normalizeColor(el.getAttribute('fill') || getComputedStyle(el).fill);
        if (fill && fill !== 'none') {
          counts.set(fill, (counts.get(fill) || 0) + 1);
        }
      });
      detectedColors.value = Array.from(counts.entries())
        .map(([color, count]) => ({ color, count }))
        .sort((a, b) => b.count - a.count);
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

    // Builds a version of the current SVG containing only the shapes matching
    // `color`; every other paintable shape is hidden via display:none so the
    // document structure (defs, viewBox, gradients) stays intact even when
    // shapes overlap in the original artwork.
    function buildLayerSvg(color) {
      if (!svgRootB) return null;
      const clone = svgRootB.cloneNode(true);
      getPaintableElements(clone).forEach(el => {
        const fill = normalizeColor(el.getAttribute('fill') || el.style.fill);
        if (fill !== color) {
          el.style.display = 'none';
        }
      });
      return serializeCleanSvg(clone);
    }

    function downloadLayer(color) {
      const markup = buildLayerSvg(color);
      if (!markup) return;
      triggerDownload(markup, baseName() + '-layer-' + sanitizeForFilename(color) + '.svg');
    }

    function downloadAllLayersZip() {
      if (!svgRootB || !detectedColors.value.length) return;
      const files = detectedColors.value.map(item => ({
        name: baseName() + '-layer-' + sanitizeForFilename(item.color) + '.svg',
        content: buildLayerSvg(item.color),
      }));
      const zipBlob = createZip(files);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = baseName() + '-layers.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    return {
      hasSvg, fileName, compareMode, isDragOver,
      svgHostA, svgHostB,
      palette, selectedPaletteIndex, currentColor, newColorHex,
      detectedColors, selectedDetectedColors,
      canUndo, canRedo,
      zoomA, zoomB, onWheelZoom, resetZoom,
      onFileInputChange, onDrop, onDragOver, onDragLeave,
      selectPaletteColor, addColorToPalette, removeColorFromPalette,
      onCurrentColorTextInput,
      toggleDetectedColor, clearDetectedSelection, recolorSelected,
      undo, redo, resetToOriginal, downloadSvg,
      downloadLayer, downloadAllLayersZip,
      colorToHex,
    };
  }
}).mount('#app');
