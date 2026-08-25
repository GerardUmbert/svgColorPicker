// Self-contained 2D polygon flattening + boolean "difference" (subtraction),
// used to compute true non-overlapping layer geometry: for each color, the
// silhouette actually visible once every shape stacked above it is cut away.
//
// Approach: Greiner-Hormann polygon clipping for the difference (A - B) of
// two simple polygons (each an array of [x, y] points, may contain multiple
// closed contours in a nested array to represent holes). Curves (circle,
// ellipse, cubic/quadratic bezier paths, arcs) are flattened to line segments
// beforehand, fine enough to look smooth at normal zoom levels.

const FLATTEN_TOLERANCE = 0.75; // px; smaller = smoother curves, more points

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
  // convert to cubic
  const c1 = [p0[0] + 2 / 3 * (p1[0] - p0[0]), p0[1] + 2 / 3 * (p1[1] - p0[1])];
  const c2 = [p2[0] + 2 / 3 * (p1[0] - p2[0]), p2[1] + 2 / 3 * (p1[1] - p2[1])];
  flattenCubicBezier(p0, c1, c2, p2, out, tolerance);
}

function flattenArc(p0, rx, ry, xRot, largeArc, sweep, p1, out, tolerance) {
  // Standard SVG arc -> center parametrization, then sample.
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

// ---------- Shape -> polygon(s) ----------

function pathDataToPolygons(d, tolerance) {
  const polygons = [];
  let current = null;
  let cur = [0, 0];
  let start = [0, 0];
  let lastCtrl = null;
  let lastCmd = '';

  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g) || [];
  let i = 0;
  function nextNum() { return parseFloat(tokens[i++]); }

  function startNewSubpath(x, y) {
    if (current && current.length) polygons.push(current);
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
          polygons.push(current);
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
  if (current && current.length) polygons.push(current);
  return polygons;
}

function ellipsePolygon(cx, cy, rx, ry, tolerance) {
  const steps = Math.max(24, Math.ceil((2 * Math.PI * Math.max(rx, ry)) / Math.max(1, tolerance * 3)));
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const t = (2 * Math.PI * i) / steps;
    pts.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
  }
  pts.push(pts[0]);
  return [pts];
}

// Returns an array of polygons (each an array of [x,y], closed) for one
// shape element, in absolute document coordinates (transform applied).
function shapeToPolygons(el, root, tolerance) {
  const tag = el.tagName.toLowerCase();
  let polys = [];

  if (tag === 'rect') {
    const x = parseFloat(el.getAttribute('x')) || 0;
    const y = parseFloat(el.getAttribute('y')) || 0;
    const w = parseFloat(el.getAttribute('width')) || 0;
    const h = parseFloat(el.getAttribute('height')) || 0;
    let rx = el.hasAttribute('rx') ? parseFloat(el.getAttribute('rx')) : (el.hasAttribute('ry') ? parseFloat(el.getAttribute('ry')) : 0);
    if (!rx) {
      polys = [[[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]];
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
      polys = [pts];
    }
  } else if (tag === 'circle') {
    const cx = parseFloat(el.getAttribute('cx')) || 0;
    const cy = parseFloat(el.getAttribute('cy')) || 0;
    const r = parseFloat(el.getAttribute('r')) || 0;
    polys = ellipsePolygon(cx, cy, r, r, tolerance);
  } else if (tag === 'ellipse') {
    const cx = parseFloat(el.getAttribute('cx')) || 0;
    const cy = parseFloat(el.getAttribute('cy')) || 0;
    const rx = parseFloat(el.getAttribute('rx')) || 0;
    const ry = parseFloat(el.getAttribute('ry')) || 0;
    polys = ellipsePolygon(cx, cy, rx, ry, tolerance);
  } else if (tag === 'polygon' || tag === 'polyline') {
    const pointsAttr = el.getAttribute('points') || '';
    const nums = pointsAttr.trim().split(/[\s,]+/).map(Number);
    const pts = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
    if (pts.length) pts.push(pts[0]);
    polys = [pts];
  } else if (tag === 'path') {
    polys = pathDataToPolygons(el.getAttribute('d') || '', tolerance);
  } else if (tag === 'line' || tag === 'text' || tag === 'g') {
    return []; // not fillable-area shapes we can meaningfully clip
  }

  const m = getCumulativeTransform(el, root);
  return polys
    .filter(p => p.length >= 3)
    .map(p => p.map(([x, y]) => applyMatrix(m, x, y)));
}

// ---------- Polygon area / winding ----------

function signedArea(poly) {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

function ensureWinding(poly, clockwise) {
  const area = signedArea(poly);
  const isCW = area < 0;
  if (isCW !== clockwise) return poly.slice().reverse();
  return poly;
}

// ---------- Point-in-polygon ----------

function pointInPolygon(pt, poly) {
  let inside = false;
  const [x, y] = pt;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function polygonsIntersectBBox(a, b) {
  const boxA = bbox(a), boxB = bbox(b);
  return !(boxA.maxX < boxB.minX || boxB.maxX < boxA.minX || boxA.maxY < boxB.minY || boxB.maxY < boxA.minY);
}

function bbox(poly) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  poly.forEach(([x, y]) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });
  return { minX, minY, maxX, maxY };
}

// ---------- Greiner-Hormann clipping (difference: subject - clip) ----------
// Reference algorithm: Greiner & Hormann 1998, "Efficient clipping of
// arbitrary polygon". Handles simple (non-self-intersecting) polygons.
// Falls back gracefully (returns subject unchanged) on degenerate input.

function lineIntersection(p1, p2, p3, p4) {
  const d1x = p2[0] - p1[0], d1y = p2[1] - p1[1];
  const d2x = p4[0] - p3[0], d2y = p4[1] - p3[1];
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-12) return null;
  const t = ((p3[0] - p1[0]) * d2y - (p3[1] - p1[1]) * d2x) / denom;
  const u = ((p3[0] - p1[0]) * d1y - (p3[1] - p1[1]) * d1x) / denom;
  if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
  return { t, u, x: p1[0] + t * d1x, y: p1[1] + t * d1y };
}

function buildVertexList(poly) {
  return poly.slice(0, poly.length - 1).map(([x, y]) => ({
    x, y, next: null, prev: null,
    isIntersection: false, neighbor: null, entry: true, visited: false, alpha: 0,
  }));
}

function link(list) {
  for (let i = 0; i < list.length; i++) {
    list[i].next = list[(i + 1) % list.length];
    list[(i + 1) % list.length].prev = list[i];
  }
}

// Insert intersection points into both vertex lists (sorted by distance
// along each edge) and mark entry/exit flags.
function clipDifference(subjectPoly, clipPoly) {
  const EPS = 1e-9;
  if (!polygonsIntersectBBox(subjectPoly, clipPoly)) {
    return [subjectPoly]; // no overlap, subject unchanged
  }

  const subject = ensureWinding(subjectPoly.slice(0, -1).length >= 3 ? subjectPoly : subjectPoly, false);
  const clip = clipPoly;

  const S = buildVertexList(subject);
  const Cc = buildVertexList(clip);
  if (S.length < 3 || Cc.length < 3) return [subjectPoly];
  link(S);
  link(Cc);

  let anyIntersection = false;

  // find all intersections
  for (let i = 0; i < S.length; i++) {
    const s1 = S[i], s2 = S[i].next;
    const sIns = [];
    for (let j = 0; j < Cc.length; j++) {
      const c1 = Cc[j], c2 = Cc[j].next;
      const hit = lineIntersection([s1.x, s1.y], [s2.x, s2.y], [c1.x, c1.y], [c2.x, c2.y]);
      if (hit && hit.t > EPS && hit.t < 1 - EPS && hit.u > EPS && hit.u < 1 - EPS) {
        anyIntersection = true;
        const sVert = { x: hit.x, y: hit.y, isIntersection: true, neighbor: null, entry: false, visited: false, alpha: hit.t, edgeStart: s1 };
        const cVert = { x: hit.x, y: hit.y, isIntersection: true, neighbor: null, entry: false, visited: false, alpha: hit.u, edgeStart: c1 };
        sVert.neighbor = cVert;
        cVert.neighbor = sVert;
        sIns.push(sVert);
        cVert._insertEdgeStart = c1;
        c1._pendingIns = c1._pendingIns || [];
        c1._pendingIns.push(cVert);
      }
    }
    s1._pendingIns = sIns;
  }

  if (!anyIntersection) {
    // Either fully disjoint, fully contains, or fully contained.
    const clipContainsSubjectPt = pointInPolygon(subject[0], clip);
    if (clipContainsSubjectPt) return []; // subject fully covered -> nothing left
    const subjectContainsClipPt = pointInPolygon(clip[0], subject);
    if (subjectContainsClipPt) {
      // clip is a hole inside subject
      return [subjectPoly, ensureWinding(clipPoly, true)];
    }
    return [subjectPoly];
  }

  function insertSorted(startVert, pending) {
    pending.sort((a, b) => a.alpha - b.alpha);
    let cursor = startVert;
    pending.forEach(v => {
      v.next = cursor.next;
      v.prev = cursor;
      cursor.next.prev = v;
      cursor.next = v;
      cursor = v;
    });
  }

  S.forEach(v => { if (v._pendingIns && v._pendingIns.length) insertSorted(v, v._pendingIns); });
  Cc.forEach(v => { if (v._pendingIns && v._pendingIns.length) insertSorted(v, v._pendingIns); });

  // mark entry/exit for subject: alternate based on whether the first
  // subject vertex is inside clip.
  function markEntryExit(list, otherPoly) {
    let startInside = pointInPolygon([list[0].x, list[0].y], otherPoly);
    let status = !startInside;
    let node = list[0];
    const seen = new Set();
    do {
      if (node.isIntersection) {
        status = !status;
        node.entry = status;
      }
      node = node.next;
    } while (node !== list[0] && !seen.has(node) && seen.add(node));
  }

  markEntryExit(S, clip);
  markEntryExit(Cc, subject);

  // For difference (S - C): walk subject entry intersections forward,
  // clip exit intersections backward.
  const results = [];
  const allSubjectIntersections = [];
  let node = S[0];
  const guardSeen = new Set();
  do {
    if (node.isIntersection) allSubjectIntersections.push(node);
    node = node.next;
  } while (node !== S[0] && !guardSeen.has(node) && guardSeen.add(node));

  allSubjectIntersections.forEach(startNode => {
    if (startNode.visited) return;
    if (!startNode.entry) return; // difference starts at subject entry points
    const poly = [];
    let current = startNode;
    let onSubject = true;
    let iterations = 0;
    const maxIter = (S.length + Cc.length) * 4 + 20;
    do {
      current.visited = true;
      if (current.neighbor) current.neighbor.visited = true;
      poly.push([current.x, current.y]);
      if (onSubject) {
        current = current.entry ? current.next : current.prev;
      } else {
        current = current.entry ? current.prev : current.next;
      }
      if (current.isIntersection) {
        current.visited = true;
        if (current.neighbor) current.neighbor.visited = true;
        current = current.neighbor;
        onSubject = !onSubject;
      }
      iterations++;
    } while (current !== startNode && iterations < maxIter);
    poly.push([poly[0][0], poly[0][1]]);
    if (poly.length >= 4) results.push(poly);
  });

  if (!results.length) {
    // Couldn't trace (degenerate/tangential intersections) - be conservative
    // and keep the subject as-is rather than losing geometry.
    return [subjectPoly];
  }
  return results;
}

// Subtract every polygon in `cutters` (array of polygons) from every polygon
// in `base` (array of polygons), returning the resulting set of polygons.
function subtractAll(base, cutters) {
  let current = base.slice();
  for (const cutter of cutters) {
    const next = [];
    for (const poly of current) {
      const diffed = clipDifference(poly, cutter);
      diffed.forEach(p => next.push(p));
    }
    current = next;
    if (!current.length) break;
  }
  return current;
}

// ---------- Polygon(s) -> SVG path `d` ----------

function polygonsToPathD(polygons) {
  return polygons.map(poly => {
    if (poly.length < 3) return '';
    const pts = poly[poly.length - 1][0] === poly[0][0] && poly[poly.length - 1][1] === poly[0][1]
      ? poly.slice(0, -1) : poly;
    return 'M' + pts.map(([x, y]) => `${round(x)},${round(y)}`).join('L') + 'Z';
  }).filter(Boolean).join(' ');
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

window.SvgGeometry = {
  shapeToPolygons,
  subtractAll,
  polygonsToPathD,
  FLATTEN_TOLERANCE,
};
