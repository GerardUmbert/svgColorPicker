# SVG Color Picker

A browser-based tool for recoloring SVG artwork shape-by-shape, comparing the result against the original side by side, and exporting the artwork split into per-color layers — including geometrically correct layers where overlapping shapes are cut apart, suitable for feeding into a slicer for multi-color 3D printing.

Runs entirely client-side: no server, no database, no build step. Everything happens in your browser and nothing is uploaded anywhere.

Live at **https://gerardumbert.github.io/svgColorPicker/**

## What it's for

You have an SVG illustration (a character, a logo, a print-ready design) and you want to:

- Try out different color combinations without leaving the browser or reopening a vector editor.
- See the recolored version next to the untouched original as you work.
- Save a reusable palette of colors, with number-key shortcuts to jump between them.
- Pull the artwork apart by color into separate files — for example, to send each color to a different filament/extruder on a multi-material 3D printer, or to hand off isolated color layers to another tool.

## How to use it

1. **Upload an SVG** — drag and drop a file onto the page, or use the Upload button.
2. **Pick a color** — from your palette (left sidebar) or by editing the current color directly.
3. **Click any shape** in the artwork to fill it with the selected color. Hold `Shift` while clicking to set the shape's stroke instead of its fill.
4. **Compare as you go** — the side-by-side view shows the original SVG next to your edited version, updating live. Zoom and pan are synced between both panes, so you're always comparing the same region.
5. **Zoom and pan** — scroll to zoom in/out (centered on your cursor), click and drag to pan around, double-click to reset the view.
6. **Build a palette** — add colors with the color picker, remove ones you don't need. Each palette slot gets a number (1–9, 0); press that key to jump straight to it as your active color.
7. **Bulk recolor** — in the "Colors in SVG" list, click one color to select it, or Ctrl/Cmd/Shift-click to select several, then replace them all with the current color in one action. Hover a color in the list to flash its matching shapes in both preview panes, so you can spot exactly where it's used before recoloring.
8. **Toggle background** — switch the preview between a transparent checkerboard and a solid white background.
9. **Undo / redo / reset** — step back through your edits, or discard everything and start over from the original file.
10. **Download** — grab the fully recolored SVG, or split it into layers:
   - The ↓ button next to a color exports just that color's shapes as their own SVG file — with any part covered by shapes drawn on top of it cut away, so the exported layer matches exactly what's visible in the final image. If a transparent/white background toggle is on, white is exported as a real cut layer too.
   - "Download all layers (.zip)" does this for every color at once, numbered by stacking order (layer 1 = the topmost color, counting down from there) — stack the layers back together in that order and you get the original artwork back with no overlap.

Layer export runs in a background worker with a progress indicator, so the tab stays responsive even on complex artwork with many shapes. Exported layer paths are simplified (Douglas-Peucker) to keep file sizes and slicer import times down, and tiny sliver shapes left over from clipping are filtered out of both the color counts and the exported layers.

## Notes

- Your palette is saved in the browser's local storage, so it's remembered between visits (but only on the same browser/device — nothing is synced anywhere).
- Nothing is uploaded to a server; the SVG you load never leaves your machine.
- The layer-cutting geometry uses [martinez-polygon-clipping](https://github.com/w8r/martinez), bundled locally so the whole app works fully offline once loaded.
