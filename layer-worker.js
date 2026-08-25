// Web Worker: runs boolean polygon subtraction (via the vendored, pre-bundled
// martinez clipping library) off the main thread so the tab never freezes
// while exporting layers, and reports progress as it goes.
//
// martinez-bundle.js is a self-contained classic script (built with esbuild
// from the real martinez-polygon-clipping npm package + its dependencies,
// see BUNDLE.md), loaded via importScripts so no ES module / import-map
// support is required inside the worker.
//
// Message in:  { type: 'build', jobId, requests: [{ color, layer, ownShapes, cutterShapes }] }
//   - ownShapes: array of shapes for this color; each shape is an array of rings (ring[0] outer, rest holes)
//   - cutterShapes: parallel array, cutterShapes[i] = shapes (each an array of rings) that may cut ownShapes[i]
// Message out (repeated): { type: 'progress', jobId, done, total, color }
// Message out (once):     { type: 'done', jobId, results: [{ color, layer, polygons }] }
//   - polygons: array of martinez polygons (array of rings) representing the true visible silhouette

importScripts('martinez-bundle.js');
const martinez = MartinezBundle.martinez;

function toMultiPolygon(shapeRings) {
  return [shapeRings]; // one polygon (with its rings), martinez multipolygon = array of polygons
}

function unionAll(shapes) {
  if (!shapes.length) return null;
  let acc = toMultiPolygon(shapes[0]);
  for (let i = 1; i < shapes.length; i++) {
    try {
      acc = martinez.union(acc, toMultiPolygon(shapes[i]));
    } catch (e) {
      // skip a degenerate cutter rather than aborting the whole layer
    }
  }
  return acc;
}

function subtractOne(ownRings, cutterShapes) {
  if (!cutterShapes.length) return [ownRings]; // unchanged
  const cutterUnion = unionAll(cutterShapes);
  if (!cutterUnion) return [ownRings];
  try {
    const result = martinez.diff(toMultiPolygon(ownRings), cutterUnion);
    return result ? result.map(polygon => polygon) : [];
  } catch (e) {
    return [ownRings]; // clipping failed on this shape - keep it whole rather than losing it
  }
}

self.onmessage = function (e) {
  const msg = e.data;
  if (msg.type !== 'build') return;

  const { jobId, requests } = msg;
  const results = [];
  const total = requests.length;

  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];
    let polygons = []; // flat list of martinez polygons (each: array of rings)
    for (let s = 0; s < req.ownShapes.length; s++) {
      const cut = subtractOne(req.ownShapes[s], req.cutterShapes[s] || []);
      cut.forEach(polygon => polygons.push(polygon));
    }
    results.push({ color: req.color, layer: req.layer, polygons });
    self.postMessage({ type: 'progress', jobId, done: i + 1, total, color: req.color });
  }

  self.postMessage({ type: 'done', jobId, results });
};
