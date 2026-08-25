// DOM-dependent shape flattening: converts live SVG elements (with their
// cumulative transforms applied) into plain polygon ring arrays, ready to be
// handed to the real boolean-clipping engine (martinez, bundled and run in
// layer-worker.js). Runs on the main thread only (needs the DOM) - this file
// does no boolean math itself.
//
// A single SVG <path> can contain multiple subpaths (e.g. a donut shape: an
// outer ring plus an inner hole ring). shapeToRings() keeps all of an
// element's subpaths together as one shape's set of rings, matching
// martinez's polygon format: a polygon is an array of rings, ring[0] is the
// outer boundary, ring[1..] are holes.

const FLATTEN_TOLERANCE = 0.6; // px; smaller = smoother curves, more points

// ---------- Matrix / transform helpers ----------

function matMul(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function applyMatrix(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function parseTransform(str) {
  let m = [1, 0, 0, 1, 0, 0];
  if (!str) return m;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let match;
  while ((match = re.exec(str))) {
    const nums = match[2].trim().split(/[\s,]+/).map(Number);
    let t;
    switch (match[1]) {
      case 'matrix':
        t = nums;
        break;
      case 'translate':
        t = [1, 0, 0, 1, nums[0] || 0, nums[1] || 0];
        break;
      case 'scale':
        t = [nums[0], 0, 0, nums.length > 1 ? nums[1] : nums[0], 0, 0];
        break;
      case 'rotate': {
        const a = (nums[0] || 0) * Math.PI / 180;
        const cos = Math.cos(a), sin = Math.sin(a);
        if (nums.length >= 3) {
          const [cx, cy] = [nums[1], nums[2]];
          t = matMul([1, 0, 0, 1, cx, cy], matMul([cos, sin, -sin, cos, 0, 0], [1, 0, 0, 1, -cx, -cy]));
        } else {
          t = [cos, sin, -sin, cos, 0, 0];
        }
        break;
      }
      case 'skewX':
        t = [1, 0, Math.tan((nums[0] || 0) * Math.PI / 180), 1, 0, 0];
        break;
      case 'skewY':
        t = [1, Math.tan((nums[0] || 0) * Math.PI / 180), 0, 1, 0, 0];
        break;
      default:
        t = [1, 0, 0, 1, 0, 0];
    }
    m = matMul(m, t);
  }
  return m;
}

function getCumulativeTransform(el, root) {
  let m = [1, 0, 0, 1, 0, 0];
  const chain = [];
  let node = el;
  while (node && node !== root.parentNode) {
    chain.unshift(node);
    node = node.parentElement;
  }
  chain.forEach(n => {
    if (n.getAttribute && n.getAttribute('transform')) {
      m = matMul(m, parseTransform(n.getAttribute('transform')));
    }
  });
  return m;
}

// ---------- Curve flattening ----------

function flattenCubicBezier(p0, p1, p2, p3, out, tolerance) {
  function isFlat(p0, p1, p2, p3) {
    const d1 = pointLineDist(p1, p0, p3);
    const d2 = pointLineDist(p2, p0, p3);
    return (d1 + d2) < tolerance;
  }
  function pointLineDist(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    return Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / len;
  }
  function subdivide(p0, p1, p2, p3, depth) {
    if (depth > 18 || isFlat(p0, p1, p2, p3)) {
      out.push(p3);
      return;
    }
    const p01 = mid(p0, p1), p12 = mid(p1, p2), p23 = mid(p2, p3);
    const p012 = mid(p01, p12), p123 = mid(p12, p23);
    const p0123 = mid(p012, p123);
    subdivide(p0, p01, p012, p0123, depth + 1);
    subdivide(p0123, p123, p23, p3, depth + 1);
  }
  function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
  subdivide(p0, p1, p2, p3, 0);
}

function flattenQuadraticBezier(p0, p1, p2, out, tolerance) {
  const c1 = [p0[0] + 2 / 3 * (p1[0] - p0[0]), p0[1] + 2 / 3 * (p1[1] - p0[1])];
  const c2 = [p2[0] + 2 / 3 * (p1[0] - p2[0]), p2[1] + 2 / 3 * (p1[1] - p2[1])];
  flattenCubicBezier(p0, c1, c2, p2, out, tolerance);
}

function flattenArc(p0, rx, ry, xRot, largeArc, sweep, p1, out, tolerance) {
  if (rx === 0 || ry === 0) { out.push(p1); return; }
  const phi = xRot * Math.PI / 180;
  const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);
  const dx2 = (p0[0] - p1[0]) / 2, dy2 = (p0[1] - p1[1]) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;
  rx = Math.abs(rx); ry = Math.abs(ry);
  let lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s; ry *= s;
  }
  const sign = largeArc !== sweep ? 1 : -1;
  const num = Math.max(0, rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p);
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const co = den === 0 ? 0 : sign * Math.sqrt(num / den);
  const cxp = co * (rx * y1p) / ry;
  const cyp = -co * (ry * x1p) / rx;
  const cx = cosPhi * cxp - sinPhi * cyp + (p0[0] + p1[0]) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (p0[1] + p1[1]) / 2;

  function angle(u, v) {
    const sign = (u[0] * v[1] - u[1] * v[0]) < 0 ? -1 : 1;
    const dot = Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v))));
    return sign * Math.acos(dot);
  }
  const theta1 = angle([1, 0], [(x1p - cxp) / rx, (y1p - cyp) / ry]);
  let dTheta = angle([(x1p - cxp) / rx, (y1p - cyp) / ry], [(-x1p - cxp) / rx, (-y1p - cyp) / ry]);
  if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweep && dTheta < 0) dTheta += 2 * Math.PI;

  const steps = Math.max(4, Math.ceil(Math.abs(dTheta) / (tolerance * 0.05 + 0.05)));
  for (let i = 1; i <= steps; i++) {
    const t = theta1 + (dTheta * i) / steps;
    const x = cx + rx * Math.cos(t) * cosPhi - ry * Math.sin(t) * sinPhi;
    const y = cy + rx * Math.cos(t) * sinPhi + ry * Math.sin(t) * cosPhi;
    out.push([x, y]);
  }
}

// ---------- Path data -> subpaths (each a flat ring of points) ----------

function pathDataToSubpaths(d, tolerance) {
  const subpaths = [];
  let current = null;
  let cur = [0, 0];
  let start = [0, 0];
  let lastCtrl = null;
  let lastCmd = '';

  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g) || [];
  let i = 0;
  function nextNum() { return parseFloat(tokens[i++]); }

  function startNewSubpath(x, y) {
    if (current && current.length) subpaths.push(current);
    current = [[x, y]];
    cur = [x, y];
    start = [x, y];
  }

  while (i < tokens.length) {
    let cmd = tokens[i];
    if (/[a-zA-Z]/.test(cmd)) { i++; } else { cmd = lastCmd; }
    const isRel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();

    switch (C) {
      case 'M': {
        let x = nextNum(), y = nextNum();
        if (isRel) { x += cur[0]; y += cur[1]; }
        startNewSubpath(x, y);
        lastCmd = isRel ? 'l' : 'L';
        break;
      }
      case 'L': {
        let x = nextNum(), y = nextNum();
        if (isRel) { x += cur[0]; y += cur[1]; }
        current.push([x, y]);
        cur = [x, y];
        lastCmd = cmd;
        break;
      }
      case 'H': {
        let x = nextNum();
        if (isRel) x += cur[0];
        current.push([x, cur[1]]);
        cur = [x, cur[1]];
        lastCmd = cmd;
        break;
      }
      case 'V': {
        let y = nextNum();
        if (isRel) y += cur[1];
        current.push([cur[0], y]);
        cur = [cur[0], y];
        lastCmd = cmd;
        break;
      }
      case 'C': {
        let x1 = nextNum(), y1 = nextNum(), x2 = nextNum(), y2 = nextNum(), x = nextNum(), y = nextNum();
        if (isRel) { x1 += cur[0]; y1 += cur[1]; x2 += cur[0]; y2 += cur[1]; x += cur[0]; y += cur[1]; }
        const out = [];
        flattenCubicBezier(cur, [x1, y1], [x2, y2], [x, y], out, tolerance);
        out.forEach(p => current.push(p));
        cur = [x, y];
        lastCtrl = [x2, y2];
        lastCmd = cmd;
        break;
      }
      case 'S': {
        let x2 = nextNum(), y2 = nextNum(), x = nextNum(), y = nextNum();
        if (isRel) { x2 += cur[0]; y2 += cur[1]; x += cur[0]; y += cur[1]; }
        const reflected = lastCtrl ? [2 * cur[0] - lastCtrl[0], 2 * cur[1] - lastCtrl[1]] : cur;
        const out = [];
        flattenCubicBezier(cur, reflected, [x2, y2], [x, y], out, tolerance);
        out.forEach(p => current.push(p));
        cur = [x, y];
        lastCtrl = [x2, y2];
        lastCmd = cmd;
        break;
      }
      case 'Q': {
        let x1 = nextNum(), y1 = nextNum(), x = nextNum(), y = nextNum();
        if (isRel) { x1 += cur[0]; y1 += cur[1]; x += cur[0]; y += cur[1]; }
        const out = [];
        flattenQuadraticBezier(cur, [x1, y1], [x, y], out, tolerance);
        out.forEach(p => current.push(p));
        cur = [x, y];
        lastCtrl = [x1, y1];
        lastCmd = cmd;
        break;
      }
      case 'T': {
        let x = nextNum(), y = nextNum();
        if (isRel) { x += cur[0]; y += cur[1]; }
        const reflected = lastCtrl ? [2 * cur[0] - lastCtrl[0], 2 * cur[1] - lastCtrl[1]] : cur;
        const out = [];
        flattenQuadraticBezier(cur, reflected, [x, y], out, tolerance);
        out.forEach(p => current.push(p));
        cur = [x, y];
        lastCtrl = reflected;
        lastCmd = cmd;
        break;
      }
      case 'A': {
        const rx = nextNum(), ry = nextNum(), xRot = nextNum();
        const largeArc = nextNum() !== 0, sweep = nextNum() !== 0;
        let x = nextNum(), y = nextNum();
        if (isRel) { x += cur[0]; y += cur[1]; }
        const out = [];
        flattenArc(cur, rx, ry, xRot, largeArc, sweep, [x, y], out, tolerance);
        out.forEach(p => current.push(p));
        cur = [x, y];
        lastCmd = cmd;
        break;
      }
      case 'Z': {
        if (current && current.length) {
          current.push([start[0], start[1]]);
          subpaths.push(current);
          current = null;
        }
        cur = start;
        lastCmd = cmd;
        break;
      }
      default:
        i++; // unknown command, skip token to avoid infinite loop
    }
    if (C !== 'C' && C !== 'S' && C !== 'Q' && C !== 'T') lastCtrl = null;
  }
  if (current && current.length) subpaths.push(current);
  return subpaths;
}

function ellipseRing(cx, cy, rx, ry, tolerance) {
  const steps = Math.max(24, Math.ceil((2 * Math.PI * Math.max(rx, ry)) / Math.max(1, tolerance * 3)));
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const t = (2 * Math.PI * i) / steps;
    pts.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
  }
  pts.push(pts[0]);
  return pts;
}

// Returns ONE shape as an array of rings (ring[0] = outer boundary,
// ring[1..] = holes if the element is a compound path), in absolute
// document coordinates (transform applied). This is the unit martinez
// expects for one polygon: [ring, ring, ...].
function shapeToRings(el, root, tolerance) {
  const tag = el.tagName.toLowerCase();
  let rings = [];

  if (tag === 'rect') {
    const x = parseFloat(el.getAttribute('x')) || 0;
    const y = parseFloat(el.getAttribute('y')) || 0;
    const w = parseFloat(el.getAttribute('width')) || 0;
    const h = parseFloat(el.getAttribute('height')) || 0;
    let rx = el.hasAttribute('rx') ? parseFloat(el.getAttribute('rx')) : (el.hasAttribute('ry') ? parseFloat(el.getAttribute('ry')) : 0);
    if (!rx) {
      rings = [[[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]];
    } else {
      rx = Math.min(rx, w / 2, h / 2);
      const steps = 8;
      const pts = [];
      const corners = [
        [x + w - rx, y + rx, -Math.PI / 2, 0],
        [x + w - rx, y + h - rx, 0, Math.PI / 2],
        [x + rx, y + h - rx, Math.PI / 2, Math.PI],
        [x + rx, y + rx, Math.PI, Math.PI * 1.5],
      ];
      corners.forEach(([ccx, ccy, a0, a1]) => {
        for (let i = 0; i <= steps; i++) {
          const t = a0 + (a1 - a0) * (i / steps);
          pts.push([ccx + rx * Math.cos(t), ccy + rx * Math.sin(t)]);
        }
      });
      pts.push(pts[0]);
      rings = [pts];
    }
  } else if (tag === 'circle') {
    const cx = parseFloat(el.getAttribute('cx')) || 0;
    const cy = parseFloat(el.getAttribute('cy')) || 0;
    const r = parseFloat(el.getAttribute('r')) || 0;
    rings = [ellipseRing(cx, cy, r, r, tolerance)];
  } else if (tag === 'ellipse') {
    const cx = parseFloat(el.getAttribute('cx')) || 0;
    const cy = parseFloat(el.getAttribute('cy')) || 0;
    const rx = parseFloat(el.getAttribute('rx')) || 0;
    const ry = parseFloat(el.getAttribute('ry')) || 0;
    rings = [ellipseRing(cx, cy, rx, ry, tolerance)];
  } else if (tag === 'polygon' || tag === 'polyline') {
    const pointsAttr = el.getAttribute('points') || '';
    const nums = pointsAttr.trim().split(/[\s,]+/).map(Number);
    const pts = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
    if (pts.length) pts.push(pts[0]);
    rings = [pts];
  } else if (tag === 'path') {
    rings = pathDataToSubpaths(el.getAttribute('d') || '', tolerance);
  } else if (tag === 'line' || tag === 'text' || tag === 'g') {
    return []; // not fillable-area shapes we can meaningfully clip
  }

  const m = getCumulativeTransform(el, root);
  return rings
    .filter(r => r.length >= 3)
    .map(r => r.map(([x, y]) => applyMatrix(m, x, y)));
}

function ringsBBox(rings) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  rings.forEach(ring => ring.forEach(([x, y]) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }));
  return { minX, minY, maxX, maxY };
}

function bboxOverlap(a, b) {
  return !(a.maxX < b.minX || b.maxX < a.minX || a.maxY < b.minY || b.maxY < a.minY);
}

// Shoelace formula on the outer ring only (rings[0]) - a fast, good-enough
// area estimate; ignoring holes slightly overstates area for donut-shaped
// paths, which only makes downstream filtering more conservative (less
// likely to wrongly drop a real detail).
function ringArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

function ringPerimeter(ring) {
  let p = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    p += Math.hypot(x2 - x1, y2 - y1);
  }
  return p;
}

// area alone can't tell a thin elongated sliver apart from a small chunky
// detail (both can have similarly small area), and bounding-box aspect
// ratio is fooled by diagonal slivers. Effective width (2*area/perimeter)
// approximates a shape's average thickness regardless of its orientation or
// length: a hairline sliver has a small effective width no matter how long
// it is, while a small dot's effective width stays close to its actual size.
function shapeEffectiveWidth(rings) {
  if (!rings.length) return 0;
  const ring = rings[0];
  const area = ringArea(ring);
  const per = ringPerimeter(ring);
  return per > 0 ? (2 * area) / per : 0;
}

window.SvgGeometry = {
  shapeToRings,
  ringsBBox,
  bboxOverlap,
  shapeEffectiveWidth,
  FLATTEN_TOLERANCE,
};
