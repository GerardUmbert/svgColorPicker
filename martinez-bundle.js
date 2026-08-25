var MartinezBundle = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // entry.js
  var entry_exports = {};
  __export(entry_exports, {
    martinez: () => martinez_exports
  });

  // node_modules/martinez-polygon-clipping/dist/martinez.js
  var martinez_exports = {};
  __export(martinez_exports, {
    diff: () => ft,
    intersection: () => ct,
    operations: () => pt,
    union: () => lt,
    xor: () => ht
  });

  // node_modules/splaytree/index.js
  function DEFAULT_COMPARE(a, b2) {
    return a > b2 ? 1 : a < b2 ? -1 : 0;
  }
  var SplayTree = class _SplayTree {
    constructor(compare = DEFAULT_COMPARE, noDuplicates = false) {
      this._compare = compare;
      this._root = null;
      this._size = 0;
      this._noDuplicates = !!noDuplicates;
    }
    rotateLeft(x2) {
      var y2 = x2.right;
      if (y2) {
        x2.right = y2.left;
        if (y2.left) y2.left.parent = x2;
        y2.parent = x2.parent;
      }
      if (!x2.parent) this._root = y2;
      else if (x2 === x2.parent.left) x2.parent.left = y2;
      else x2.parent.right = y2;
      if (y2) y2.left = x2;
      x2.parent = y2;
    }
    rotateRight(x2) {
      var y2 = x2.left;
      if (y2) {
        x2.left = y2.right;
        if (y2.right) y2.right.parent = x2;
        y2.parent = x2.parent;
      }
      if (!x2.parent) this._root = y2;
      else if (x2 === x2.parent.left) x2.parent.left = y2;
      else x2.parent.right = y2;
      if (y2) y2.right = x2;
      x2.parent = y2;
    }
    _splay(x2) {
      while (x2.parent) {
        var p = x2.parent;
        if (!p.parent) {
          if (p.left === x2) this.rotateRight(p);
          else this.rotateLeft(p);
        } else if (p.left === x2 && p.parent.left === p) {
          this.rotateRight(p.parent);
          this.rotateRight(p);
        } else if (p.right === x2 && p.parent.right === p) {
          this.rotateLeft(p.parent);
          this.rotateLeft(p);
        } else if (p.left === x2 && p.parent.right === p) {
          this.rotateRight(p);
          this.rotateLeft(p);
        } else {
          this.rotateLeft(p);
          this.rotateRight(p);
        }
      }
    }
    splay(x2) {
      var p, gp, ggp, l, r;
      while (x2.parent) {
        p = x2.parent;
        gp = p.parent;
        if (gp && gp.parent) {
          ggp = gp.parent;
          if (ggp.left === gp) ggp.left = x2;
          else ggp.right = x2;
          x2.parent = ggp;
        } else {
          x2.parent = null;
          this._root = x2;
        }
        l = x2.left;
        r = x2.right;
        if (x2 === p.left) {
          if (gp) {
            if (gp.left === p) {
              if (p.right) {
                gp.left = p.right;
                gp.left.parent = gp;
              } else gp.left = null;
              p.right = gp;
              gp.parent = p;
            } else {
              if (l) {
                gp.right = l;
                l.parent = gp;
              } else gp.right = null;
              x2.left = gp;
              gp.parent = x2;
            }
          }
          if (r) {
            p.left = r;
            r.parent = p;
          } else p.left = null;
          x2.right = p;
          p.parent = x2;
        } else {
          if (gp) {
            if (gp.right === p) {
              if (p.left) {
                gp.right = p.left;
                gp.right.parent = gp;
              } else gp.right = null;
              p.left = gp;
              gp.parent = p;
            } else {
              if (r) {
                gp.left = r;
                r.parent = gp;
              } else gp.left = null;
              x2.right = gp;
              gp.parent = x2;
            }
          }
          if (l) {
            p.right = l;
            l.parent = p;
          } else p.right = null;
          x2.left = p;
          p.parent = x2;
        }
      }
    }
    replace(u4, v3) {
      if (!u4.parent) this._root = v3;
      else if (u4 === u4.parent.left) u4.parent.left = v3;
      else u4.parent.right = v3;
      if (v3) v3.parent = u4.parent;
    }
    minNode(u4 = this._root) {
      if (u4) while (u4.left) u4 = u4.left;
      return u4;
    }
    maxNode(u4 = this._root) {
      if (u4) while (u4.right) u4 = u4.right;
      return u4;
    }
    insert(key, data) {
      var z2 = this._root;
      var p = null;
      var comp = this._compare;
      var cmp;
      if (this._noDuplicates) {
        while (z2) {
          p = z2;
          cmp = comp(z2.key, key);
          if (cmp === 0) return;
          else if (comp(z2.key, key) < 0) z2 = z2.right;
          else z2 = z2.left;
        }
      } else {
        while (z2) {
          p = z2;
          if (comp(z2.key, key) < 0) z2 = z2.right;
          else z2 = z2.left;
        }
      }
      z2 = { key, data, left: null, right: null, parent: p };
      if (!p) this._root = z2;
      else if (comp(p.key, z2.key) < 0) p.right = z2;
      else p.left = z2;
      this.splay(z2);
      this._size++;
      return z2;
    }
    find(key) {
      var z2 = this._root;
      var comp = this._compare;
      while (z2) {
        var cmp = comp(z2.key, key);
        if (cmp < 0) z2 = z2.right;
        else if (cmp > 0) z2 = z2.left;
        else return z2;
      }
      return null;
    }
    /**
     * Whether the tree contains a node with the given key
     * @param  {Key} key
     * @return {boolean} true/false
     */
    contains(key) {
      var node = this._root;
      var comparator = this._compare;
      while (node) {
        var cmp = comparator(key, node.key);
        if (cmp === 0) return true;
        else if (cmp < 0) node = node.left;
        else node = node.right;
      }
      return false;
    }
    remove(key) {
      var z2 = this.find(key);
      if (!z2) return false;
      this.splay(z2);
      if (!z2.left) this.replace(z2, z2.right);
      else if (!z2.right) this.replace(z2, z2.left);
      else {
        var y2 = this.minNode(z2.right);
        if (y2.parent !== z2) {
          this.replace(y2, y2.right);
          y2.right = z2.right;
          y2.right.parent = y2;
        }
        this.replace(z2, y2);
        y2.left = z2.left;
        y2.left.parent = y2;
      }
      this._size--;
      return true;
    }
    removeNode(z2) {
      if (!z2) return false;
      this.splay(z2);
      if (!z2.left) this.replace(z2, z2.right);
      else if (!z2.right) this.replace(z2, z2.left);
      else {
        var y2 = this.minNode(z2.right);
        if (y2.parent !== z2) {
          this.replace(y2, y2.right);
          y2.right = z2.right;
          y2.right.parent = y2;
        }
        this.replace(z2, y2);
        y2.left = z2.left;
        y2.left.parent = y2;
      }
      this._size--;
      return true;
    }
    erase(key) {
      var z2 = this.find(key);
      if (!z2) return;
      this.splay(z2);
      var s = z2.left;
      var t = z2.right;
      var sMax = null;
      if (s) {
        s.parent = null;
        sMax = this.maxNode(s);
        this.splay(sMax);
        this._root = sMax;
      }
      if (t) {
        if (s) sMax.right = t;
        else this._root = t;
        t.parent = sMax;
      }
      this._size--;
    }
    /**
     * Removes and returns the node with smallest key
     * @return {?Node}
     */
    pop() {
      var node = this._root, returnValue = null;
      if (node) {
        while (node.left) node = node.left;
        returnValue = { key: node.key, data: node.data };
        this.remove(node.key);
      }
      return returnValue;
    }
    /* eslint-disable class-methods-use-this */
    /**
     * Successor node
     * @param  {Node} node
     * @return {?Node}
     */
    next(node) {
      var successor = node;
      if (successor) {
        if (successor.right) {
          successor = successor.right;
          while (successor && successor.left) successor = successor.left;
        } else {
          successor = node.parent;
          while (successor && successor.right === node) {
            node = successor;
            successor = successor.parent;
          }
        }
      }
      return successor;
    }
    /**
     * Predecessor node
     * @param  {Node} node
     * @return {?Node}
     */
    prev(node) {
      var predecessor = node;
      if (predecessor) {
        if (predecessor.left) {
          predecessor = predecessor.left;
          while (predecessor && predecessor.right) predecessor = predecessor.right;
        } else {
          predecessor = node.parent;
          while (predecessor && predecessor.left === node) {
            node = predecessor;
            predecessor = predecessor.parent;
          }
        }
      }
      return predecessor;
    }
    /* eslint-enable class-methods-use-this */
    /**
     * @param  {forEachCallback} callback
     * @return {SplayTree}
     */
    forEach(callback) {
      var current = this._root;
      var s = [], done = false, i = 0;
      while (!done) {
        if (current) {
          s.push(current);
          current = current.left;
        } else {
          if (s.length > 0) {
            current = s.pop();
            callback(current, i++);
            current = current.right;
          } else done = true;
        }
      }
      return this;
    }
    /**
     * Walk key range from `low` to `high`. Stops if `fn` returns a value.
     * @param  {Key}      low
     * @param  {Key}      high
     * @param  {Function} fn
     * @param  {*?}       ctx
     * @return {SplayTree}
     */
    range(low, high, fn, ctx) {
      const Q2 = [];
      const compare = this._compare;
      let node = this._root, cmp;
      while (Q2.length !== 0 || node) {
        if (node) {
          Q2.push(node);
          node = node.left;
        } else {
          node = Q2.pop();
          cmp = compare(node.key, high);
          if (cmp > 0) {
            break;
          } else if (compare(node.key, low) >= 0) {
            if (fn.call(ctx, node)) return this;
          }
          node = node.right;
        }
      }
      return this;
    }
    /**
     * Returns all keys in order
     * @return {Array<Key>}
     */
    keys() {
      var current = this._root;
      var s = [], r = [], done = false;
      while (!done) {
        if (current) {
          s.push(current);
          current = current.left;
        } else {
          if (s.length > 0) {
            current = s.pop();
            r.push(current.key);
            current = current.right;
          } else done = true;
        }
      }
      return r;
    }
    /**
     * Returns `data` fields of all nodes in order.
     * @return {Array<Value>}
     */
    values() {
      var current = this._root;
      var s = [], r = [], done = false;
      while (!done) {
        if (current) {
          s.push(current);
          current = current.left;
        } else {
          if (s.length > 0) {
            current = s.pop();
            r.push(current.data);
            current = current.right;
          } else done = true;
        }
      }
      return r;
    }
    /**
     * Returns node at given index
     * @param  {number} index
     * @return {?Node}
     */
    at(index) {
      var current = this._root;
      var s = [], done = false, i = 0;
      while (!done) {
        if (current) {
          s.push(current);
          current = current.left;
        } else {
          if (s.length > 0) {
            current = s.pop();
            if (i === index) return current;
            i++;
            current = current.right;
          } else done = true;
        }
      }
      return null;
    }
    /**
     * Bulk-load items. Both array have to be same size
     * @param  {Array<Key>}    keys
     * @param  {Array<Value>}  [values]
     * @param  {Boolean}       [presort=false] Pre-sort keys and values, using
     *                                         tree's comparator. Sorting is done
     *                                         in-place
     * @return {AVLTree}
     */
    load(keys = [], values = [], presort = false) {
      if (this._size !== 0) throw new Error("bulk-load: tree is not empty");
      const size = keys.length;
      if (presort) sort(keys, values, 0, size - 1, this._compare);
      this._root = loadRecursive(null, keys, values, 0, size);
      this._size = size;
      return this;
    }
    min() {
      var node = this.minNode(this._root);
      if (node) return node.key;
      else return null;
    }
    max() {
      var node = this.maxNode(this._root);
      if (node) return node.key;
      else return null;
    }
    isEmpty() {
      return this._root === null;
    }
    get size() {
      return this._size;
    }
    /**
       * Create a tree and load it with items
       * @param  {Array<Key>}          keys
       * @param  {Array<Value>?}        [values]
    
       * @param  {Function?}            [comparator]
       * @param  {Boolean?}             [presort=false] Pre-sort keys and values, using
       *                                               tree's comparator. Sorting is done
       *                                               in-place
       * @param  {Boolean?}             [noDuplicates=false]   Allow duplicates
       * @return {SplayTree}
       */
    static createTree(keys, values, comparator, presort, noDuplicates) {
      return new _SplayTree(comparator, noDuplicates).load(keys, values, presort);
    }
  };
  function loadRecursive(parent, keys, values, start, end) {
    const size = end - start;
    if (size > 0) {
      const middle = start + Math.floor(size / 2);
      const key = keys[middle];
      const data = values[middle];
      const node = { key, data, parent };
      node.left = loadRecursive(node, keys, values, start, middle);
      node.right = loadRecursive(node, keys, values, middle + 1, end);
      return node;
    }
    return null;
  }
  function sort(keys, values, left, right, compare) {
    if (left >= right) return;
    const pivot = keys[left + right >> 1];
    let i = left - 1;
    let j2 = right + 1;
    while (true) {
      do
        i++;
      while (compare(keys[i], pivot) < 0);
      do
        j2--;
      while (compare(keys[j2], pivot) > 0);
      if (i >= j2) break;
      let tmp = keys[i];
      keys[i] = keys[j2];
      keys[j2] = tmp;
      tmp = values[i];
      values[i] = values[j2];
      values[j2] = tmp;
    }
    sort(keys, values, left, j2, compare);
    sort(keys, values, j2 + 1, right, compare);
  }

  // node_modules/robust-predicates/esm/util.js
  var epsilon = 11102230246251565e-32;
  var splitter = 134217729;
  var resulterrbound = (3 + 8 * epsilon) * epsilon;
  function sum(elen, e, flen, f, h) {
    let Q2, Qnew, hh, bvirt;
    let enow = e[0];
    let fnow = f[0];
    let eindex = 0;
    let findex = 0;
    if (fnow > enow === fnow > -enow) {
      Q2 = enow;
      enow = e[++eindex];
    } else {
      Q2 = fnow;
      fnow = f[++findex];
    }
    let hindex = 0;
    if (eindex < elen && findex < flen) {
      if (fnow > enow === fnow > -enow) {
        Qnew = enow + Q2;
        hh = Q2 - (Qnew - enow);
        enow = e[++eindex];
      } else {
        Qnew = fnow + Q2;
        hh = Q2 - (Qnew - fnow);
        fnow = f[++findex];
      }
      Q2 = Qnew;
      if (hh !== 0) {
        h[hindex++] = hh;
      }
      while (eindex < elen && findex < flen) {
        if (fnow > enow === fnow > -enow) {
          Qnew = Q2 + enow;
          bvirt = Qnew - Q2;
          hh = Q2 - (Qnew - bvirt) + (enow - bvirt);
          enow = e[++eindex];
        } else {
          Qnew = Q2 + fnow;
          bvirt = Qnew - Q2;
          hh = Q2 - (Qnew - bvirt) + (fnow - bvirt);
          fnow = f[++findex];
        }
        Q2 = Qnew;
        if (hh !== 0) {
          h[hindex++] = hh;
        }
      }
    }
    while (eindex < elen) {
      Qnew = Q2 + enow;
      bvirt = Qnew - Q2;
      hh = Q2 - (Qnew - bvirt) + (enow - bvirt);
      enow = e[++eindex];
      Q2 = Qnew;
      if (hh !== 0) {
        h[hindex++] = hh;
      }
    }
    while (findex < flen) {
      Qnew = Q2 + fnow;
      bvirt = Qnew - Q2;
      hh = Q2 - (Qnew - bvirt) + (fnow - bvirt);
      fnow = f[++findex];
      Q2 = Qnew;
      if (hh !== 0) {
        h[hindex++] = hh;
      }
    }
    if (Q2 !== 0 || hindex === 0) {
      h[hindex++] = Q2;
    }
    return hindex;
  }
  function estimate(elen, e) {
    let Q2 = e[0];
    for (let i = 1; i < elen; i++) Q2 += e[i];
    return Q2;
  }
  function vec(n) {
    return new Float64Array(n);
  }

  // node_modules/robust-predicates/esm/orient2d.js
  var ccwerrboundA = (3 + 16 * epsilon) * epsilon;
  var ccwerrboundB = (2 + 12 * epsilon) * epsilon;
  var ccwerrboundC = (9 + 64 * epsilon) * epsilon * epsilon;
  var B = vec(4);
  var C1 = vec(8);
  var C2 = vec(12);
  var D = vec(16);
  var u = vec(4);
  function orient2dadapt(ax, ay, bx, by, cx, cy, detsum) {
    let acxtail, acytail, bcxtail, bcytail;
    let bvirt, c, ahi, alo, bhi, blo, _i, _j, _0, s1, s0, t1, t0, u32;
    const acx = ax - cx;
    const bcx = bx - cx;
    const acy = ay - cy;
    const bcy = by - cy;
    s1 = acx * bcy;
    c = splitter * acx;
    ahi = c - (c - acx);
    alo = acx - ahi;
    c = splitter * bcy;
    bhi = c - (c - bcy);
    blo = bcy - bhi;
    s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
    t1 = acy * bcx;
    c = splitter * acy;
    ahi = c - (c - acy);
    alo = acy - ahi;
    c = splitter * bcx;
    bhi = c - (c - bcx);
    blo = bcx - bhi;
    t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
    _i = s0 - t0;
    bvirt = s0 - _i;
    B[0] = s0 - (_i + bvirt) + (bvirt - t0);
    _j = s1 + _i;
    bvirt = _j - s1;
    _0 = s1 - (_j - bvirt) + (_i - bvirt);
    _i = _0 - t1;
    bvirt = _0 - _i;
    B[1] = _0 - (_i + bvirt) + (bvirt - t1);
    u32 = _j + _i;
    bvirt = u32 - _j;
    B[2] = _j - (u32 - bvirt) + (_i - bvirt);
    B[3] = u32;
    let det = estimate(4, B);
    let errbound = ccwerrboundB * detsum;
    if (det >= errbound || -det >= errbound) {
      return det;
    }
    bvirt = ax - acx;
    acxtail = ax - (acx + bvirt) + (bvirt - cx);
    bvirt = bx - bcx;
    bcxtail = bx - (bcx + bvirt) + (bvirt - cx);
    bvirt = ay - acy;
    acytail = ay - (acy + bvirt) + (bvirt - cy);
    bvirt = by - bcy;
    bcytail = by - (bcy + bvirt) + (bvirt - cy);
    if (acxtail === 0 && acytail === 0 && bcxtail === 0 && bcytail === 0) {
      return det;
    }
    errbound = ccwerrboundC * detsum + resulterrbound * Math.abs(det);
    det += acx * bcytail + bcy * acxtail - (acy * bcxtail + bcx * acytail);
    if (det >= errbound || -det >= errbound) return det;
    s1 = acxtail * bcy;
    c = splitter * acxtail;
    ahi = c - (c - acxtail);
    alo = acxtail - ahi;
    c = splitter * bcy;
    bhi = c - (c - bcy);
    blo = bcy - bhi;
    s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
    t1 = acytail * bcx;
    c = splitter * acytail;
    ahi = c - (c - acytail);
    alo = acytail - ahi;
    c = splitter * bcx;
    bhi = c - (c - bcx);
    blo = bcx - bhi;
    t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
    _i = s0 - t0;
    bvirt = s0 - _i;
    u[0] = s0 - (_i + bvirt) + (bvirt - t0);
    _j = s1 + _i;
    bvirt = _j - s1;
    _0 = s1 - (_j - bvirt) + (_i - bvirt);
    _i = _0 - t1;
    bvirt = _0 - _i;
    u[1] = _0 - (_i + bvirt) + (bvirt - t1);
    u32 = _j + _i;
    bvirt = u32 - _j;
    u[2] = _j - (u32 - bvirt) + (_i - bvirt);
    u[3] = u32;
    const C1len = sum(4, B, 4, u, C1);
    s1 = acx * bcytail;
    c = splitter * acx;
    ahi = c - (c - acx);
    alo = acx - ahi;
    c = splitter * bcytail;
    bhi = c - (c - bcytail);
    blo = bcytail - bhi;
    s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
    t1 = acy * bcxtail;
    c = splitter * acy;
    ahi = c - (c - acy);
    alo = acy - ahi;
    c = splitter * bcxtail;
    bhi = c - (c - bcxtail);
    blo = bcxtail - bhi;
    t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
    _i = s0 - t0;
    bvirt = s0 - _i;
    u[0] = s0 - (_i + bvirt) + (bvirt - t0);
    _j = s1 + _i;
    bvirt = _j - s1;
    _0 = s1 - (_j - bvirt) + (_i - bvirt);
    _i = _0 - t1;
    bvirt = _0 - _i;
    u[1] = _0 - (_i + bvirt) + (bvirt - t1);
    u32 = _j + _i;
    bvirt = u32 - _j;
    u[2] = _j - (u32 - bvirt) + (_i - bvirt);
    u[3] = u32;
    const C2len = sum(C1len, C1, 4, u, C2);
    s1 = acxtail * bcytail;
    c = splitter * acxtail;
    ahi = c - (c - acxtail);
    alo = acxtail - ahi;
    c = splitter * bcytail;
    bhi = c - (c - bcytail);
    blo = bcytail - bhi;
    s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
    t1 = acytail * bcxtail;
    c = splitter * acytail;
    ahi = c - (c - acytail);
    alo = acytail - ahi;
    c = splitter * bcxtail;
    bhi = c - (c - bcxtail);
    blo = bcxtail - bhi;
    t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
    _i = s0 - t0;
    bvirt = s0 - _i;
    u[0] = s0 - (_i + bvirt) + (bvirt - t0);
    _j = s1 + _i;
    bvirt = _j - s1;
    _0 = s1 - (_j - bvirt) + (_i - bvirt);
    _i = _0 - t1;
    bvirt = _0 - _i;
    u[1] = _0 - (_i + bvirt) + (bvirt - t1);
    u32 = _j + _i;
    bvirt = u32 - _j;
    u[2] = _j - (u32 - bvirt) + (_i - bvirt);
    u[3] = u32;
    const Dlen = sum(C2len, C2, 4, u, D);
    return D[Dlen - 1];
  }
  function orient2d(ax, ay, bx, by, cx, cy) {
    const detleft = (ay - cy) * (bx - cx);
    const detright = (ax - cx) * (by - cy);
    const det = detleft - detright;
    if (detleft === 0 || detright === 0 || detleft > 0 !== detright > 0) return det;
    const detsum = Math.abs(detleft + detright);
    if (Math.abs(det) >= ccwerrboundA * detsum) return det;
    return -orient2dadapt(ax, ay, bx, by, cx, cy, detsum);
  }

  // node_modules/robust-predicates/esm/orient3d.js
  var o3derrboundA = (7 + 56 * epsilon) * epsilon;
  var o3derrboundB = (3 + 28 * epsilon) * epsilon;
  var o3derrboundC = (26 + 288 * epsilon) * epsilon * epsilon;
  var bc = vec(4);
  var ca = vec(4);
  var ab = vec(4);
  var at_b = vec(4);
  var at_c = vec(4);
  var bt_c = vec(4);
  var bt_a = vec(4);
  var ct_a = vec(4);
  var ct_b = vec(4);
  var bct = vec(8);
  var cat = vec(8);
  var abt = vec(8);
  var u2 = vec(4);
  var _8 = vec(8);
  var _8b = vec(8);
  var _16 = vec(8);
  var _12 = vec(12);
  var fin = vec(192);
  var fin2 = vec(192);

  // node_modules/robust-predicates/esm/incircle.js
  var iccerrboundA = (10 + 96 * epsilon) * epsilon;
  var iccerrboundB = (4 + 48 * epsilon) * epsilon;
  var iccerrboundC = (44 + 576 * epsilon) * epsilon * epsilon;
  var bc2 = vec(4);
  var ca2 = vec(4);
  var ab2 = vec(4);
  var aa = vec(4);
  var bb = vec(4);
  var cc = vec(4);
  var u3 = vec(4);
  var v = vec(4);
  var axtbc = vec(8);
  var aytbc = vec(8);
  var bxtca = vec(8);
  var bytca = vec(8);
  var cxtab = vec(8);
  var cytab = vec(8);
  var abt2 = vec(8);
  var bct2 = vec(8);
  var cat2 = vec(8);
  var abtt = vec(4);
  var bctt = vec(4);
  var catt = vec(4);
  var _82 = vec(8);
  var _162 = vec(16);
  var _16b = vec(16);
  var _16c = vec(16);
  var _32 = vec(32);
  var _32b = vec(32);
  var _48 = vec(48);
  var _64 = vec(64);
  var fin3 = vec(1152);
  var fin22 = vec(1152);

  // node_modules/robust-predicates/esm/insphere.js
  var isperrboundA = (16 + 224 * epsilon) * epsilon;
  var isperrboundB = (5 + 72 * epsilon) * epsilon;
  var isperrboundC = (71 + 1408 * epsilon) * epsilon * epsilon;
  var ab3 = vec(4);
  var bc3 = vec(4);
  var cd = vec(4);
  var de = vec(4);
  var ea = vec(4);
  var ac = vec(4);
  var bd = vec(4);
  var ce = vec(4);
  var da = vec(4);
  var eb = vec(4);
  var abc = vec(24);
  var bcd = vec(24);
  var cde = vec(24);
  var dea = vec(24);
  var eab = vec(24);
  var abd = vec(24);
  var bce = vec(24);
  var cda = vec(24);
  var deb = vec(24);
  var eac = vec(24);
  var adet = vec(1152);
  var bdet = vec(1152);
  var cdet = vec(1152);
  var ddet = vec(1152);
  var edet = vec(1152);
  var abdet = vec(2304);
  var cddet = vec(2304);
  var cdedet = vec(3456);
  var deter = vec(5760);
  var _83 = vec(8);
  var _8b2 = vec(8);
  var _8c = vec(8);
  var _163 = vec(16);
  var _24 = vec(24);
  var _482 = vec(48);
  var _48b = vec(48);
  var _96 = vec(96);
  var _192 = vec(192);
  var _384x = vec(384);
  var _384y = vec(384);
  var _384z = vec(384);
  var _768 = vec(768);
  var xdet = vec(96);
  var ydet = vec(96);
  var zdet = vec(96);
  var fin4 = vec(1152);

  // node_modules/tinyqueue/index.js
  var TinyQueue = class {
    constructor(data = [], compare = (a, b2) => a < b2 ? -1 : a > b2 ? 1 : 0) {
      this.data = data;
      this.length = this.data.length;
      this.compare = compare;
      if (this.length > 0) {
        for (let i = (this.length >> 1) - 1; i >= 0; i--) this._down(i);
      }
    }
    push(item) {
      this.data.push(item);
      this._up(this.length++);
    }
    pop() {
      if (this.length === 0) return void 0;
      const top = this.data[0];
      const bottom = this.data.pop();
      if (--this.length > 0) {
        this.data[0] = bottom;
        this._down(0);
      }
      return top;
    }
    peek() {
      return this.data[0];
    }
    _up(pos) {
      const { data, compare } = this;
      const item = data[pos];
      while (pos > 0) {
        const parent = pos - 1 >> 1;
        const current = data[parent];
        if (compare(item, current) >= 0) break;
        data[pos] = current;
        pos = parent;
      }
      data[pos] = item;
    }
    _down(pos) {
      const { data, compare } = this;
      const halfLength = this.length >> 1;
      const item = data[pos];
      while (pos < halfLength) {
        let bestChild = (pos << 1) + 1;
        const right = bestChild + 1;
        if (right < this.length && compare(data[right], data[bestChild]) < 0) {
          bestChild = right;
        }
        if (compare(data[bestChild], item) >= 0) break;
        data[pos] = data[bestChild];
        pos = bestChild;
      }
      data[pos] = item;
    }
  };

  // node_modules/martinez-polygon-clipping/dist/martinez.js
  var U = 0;
  var _ = 1;
  var z = 2;
  var G = 3;
  var R = 0;
  var y = 1;
  var g = 2;
  var T = 3;
  function P(n, t, e) {
    t === null ? (n.inOut = false, n.otherInOut = true) : (n.isSubject === t.isSubject ? (n.inOut = !t.inOut, n.otherInOut = t.otherInOut) : (n.inOut = !t.otherInOut, n.otherInOut = t.isVertical() ? !t.inOut : t.inOut), t && (n.prevInResult = !F(t, e) || t.isVertical() ? t.prevInResult : t)), F(n, e) ? n.resultTransition = J(n, e) : n.resultTransition = 0;
  }
  function F(n, t) {
    switch (n.type) {
      case U:
        switch (t) {
          case R:
            return !n.otherInOut;
          case y:
            return n.otherInOut;
          case g:
            return n.isSubject && n.otherInOut || !n.isSubject && !n.otherInOut;
          case T:
            return true;
        }
        break;
      case z:
        return t === R || t === y;
      case G:
        return t === g;
      case _:
        return false;
    }
    return false;
  }
  function J(n, t) {
    let e = !n.inOut, i = !n.otherInOut, o;
    switch (t) {
      case R:
        o = e && i;
        break;
      case y:
        o = e || i;
        break;
      case T:
        o = e !== i;
        break;
      case g:
        n.isSubject ? o = e && !i : o = i && !e;
        break;
    }
    return o ? 1 : -1;
  }
  var S = class _S {
    /**
     * Sweepline event
     *
     * @class {SweepEvent}
     * @param {Position}        point
     * @param {boolean}         left
     * @param {SweepEvent=}     otherEvent
     * @param {boolean}         isSubject
     * @param {EdgeType}        edgeType
     */
    constructor(t, e, i, o, r) {
      this.left = e, this.point = t, this.otherEvent = i, this.isSubject = o ?? false, this.type = r || U, this.inOut = false, this.otherInOut = false, this.prevInResult = null, this.resultTransition = 0, this.otherPos = -1, this.outputContourId = -1, this.isExteriorRing = true;
    }
    /**
     * @param  {Position}  p
     * @return {boolean}
     */
    isBelow(t) {
      const e = this.point, i = this.otherEvent.point;
      return this.left ? (e[0] - t[0]) * (i[1] - t[1]) - (i[0] - t[0]) * (e[1] - t[1]) > 0 : (i[0] - t[0]) * (e[1] - t[1]) - (e[0] - t[0]) * (i[1] - t[1]) > 0;
    }
    /**
     * @param  {Position}  p
     * @return {boolean}
     */
    isAbove(t) {
      return !this.isBelow(t);
    }
    /**
     * @return {boolean}
     */
    isVertical() {
      return this.point[0] === this.otherEvent.point[0];
    }
    /**
     * Does event belong to result?
     * @return {boolean}
     */
    get inResult() {
      return this.resultTransition !== 0;
    }
    clone() {
      const t = new _S(
        this.point,
        this.left,
        this.otherEvent,
        this.isSubject,
        this.type
      );
      return t.contourId = this.contourId, t.resultTransition = this.resultTransition, t.prevInResult = this.prevInResult, t.isExteriorRing = this.isExteriorRing, t.inOut = this.inOut, t.otherInOut = this.otherInOut, t;
    }
  };
  function v2(n, t) {
    return n[0] === t[0] ? n[1] === t[1] : false;
  }
  function A(n, t, e) {
    const i = orient2d(n[0], n[1], t[0], t[1], e[0], e[1]);
    return i > 0 ? -1 : i < 0 ? 1 : 0;
  }
  function w(n, t) {
    const e = n.point, i = t.point;
    return e[0] > i[0] ? 1 : e[0] < i[0] ? -1 : e[1] !== i[1] ? e[1] > i[1] ? 1 : -1 : W(n, t, e);
  }
  function W(n, t, e, i) {
    return n.left !== t.left ? n.left ? 1 : -1 : A(e, n.otherEvent.point, t.otherEvent.point) !== 0 ? n.isBelow(t.otherEvent.point) ? -1 : 1 : !n.isSubject && t.isSubject ? 1 : -1;
  }
  function m(n, t, e) {
    const i = new S(t, false, n, n.isSubject), o = new S(t, true, n.otherEvent, n.isSubject);
    return v2(n.point, n.otherEvent.point) && console.warn("what is that, a collapsed segment?", n), i.contourId = o.contourId = n.contourId, w(o, n.otherEvent) > 0 && (n.otherEvent.left = true, o.left = false), n.otherEvent.otherEvent = o, n.otherEvent = i, e.push(o), e.push(i), e;
  }
  function k(n, t) {
    return n[0] * t[1] - n[1] * t[0];
  }
  function M(n, t) {
    return n[0] * t[0] + n[1] * t[1];
  }
  function Z(n, t, e, i, o) {
    const r = [t[0] - n[0], t[1] - n[1]], s = [i[0] - e[0], i[1] - e[1]];
    function l(d, O, B2) {
      return [
        d[0] + O * B2[0],
        d[1] + O * B2[1]
      ];
    }
    const c = [e[0] - n[0], e[1] - n[1]];
    let u4 = k(r, s), f = u4 * u4;
    const p = M(r, r);
    if (f > 0) {
      const d = k(c, s) / u4;
      if (d < 0 || d > 1)
        return null;
      const O = k(c, r) / u4;
      return O < 0 || O > 1 ? null : d === 0 || d === 1 ? [l(n, d, r)] : O === 0 || O === 1 ? [l(e, O, s)] : [l(n, d, r)];
    }
    if (u4 = k(c, r), f = u4 * u4, f > 0)
      return null;
    const h = M(r, c) / p, E = h + M(r, s) / p, a = Math.min(h, E), I = Math.max(h, E);
    return a <= 1 && I >= 0 ? a === 1 ? [l(n, a > 0 ? a : 0, r)] : I === 0 ? [l(n, I < 1 ? I : 1, r)] : [
      l(n, a > 0 ? a : 0, r),
      l(n, I < 1 ? I : 1, r)
    ] : null;
  }
  function x(n, t, e) {
    const i = Z(
      n.point,
      n.otherEvent.point,
      t.point,
      t.otherEvent.point
    ), o = i ? i.length : 0;
    if (o === 0 || o === 1 && (v2(n.point, t.point) || v2(n.otherEvent.point, t.otherEvent.point)) || o === 2 && n.isSubject === t.isSubject)
      return 0;
    if (o === 1)
      return !v2(n.point, i[0]) && !v2(n.otherEvent.point, i[0]) && m(n, i[0], e), !v2(t.point, i[0]) && !v2(t.otherEvent.point, i[0]) && m(t, i[0], e), 1;
    const r = [];
    let s = false, l = false;
    return v2(n.point, t.point) ? s = true : w(n, t) === 1 ? r.push(t, n) : r.push(n, t), v2(n.otherEvent.point, t.otherEvent.point) ? l = true : w(n.otherEvent, t.otherEvent) === 1 ? r.push(t.otherEvent, n.otherEvent) : r.push(n.otherEvent, t.otherEvent), s && l || s ? (t.type = _, n.type = t.inOut === n.inOut ? z : G, s && !l && m(r[1].otherEvent, r[0].point, e), 2) : l ? (m(r[0], r[1].point, e), 3) : r[0] !== r[3].otherEvent ? (m(r[0], r[1].point, e), m(r[1], r[2].point, e), 3) : (m(r[0], r[1].point, e), m(r[3].otherEvent, r[2].point, e), 3);
  }
  function $(n, t) {
    if (n === t) return 0;
    if (A(n.point, n.otherEvent.point, t.point) !== 0 || A(n.point, n.otherEvent.point, t.otherEvent.point) !== 0)
      return v2(n.point, t.point) ? n.isBelow(t.otherEvent.point) ? -1 : 1 : n.point[0] === t.point[0] ? n.point[1] < t.point[1] ? -1 : 1 : w(n, t) === 1 ? t.isAbove(n.point) ? -1 : 1 : n.isBelow(t.point) ? -1 : 1;
    if (n.isSubject === t.isSubject) {
      let e = n.point, i = t.point;
      if (e[0] === i[0] && e[1] === i[1])
        return e = n.otherEvent.point, i = t.otherEvent.point, e[0] === i[0] && e[1] === i[1] ? 0 : (n.contourId ?? 0) > (t.contourId ?? 0) ? 1 : -1;
    } else
      return n.isSubject ? -1 : 1;
    return w(n, t) === 1 ? 1 : -1;
  }
  function Q(n, t, e, i, o, r) {
    const s = new SplayTree($), l = [], c = Math.min(i[2], o[2]);
    let u4, f, p;
    for (; n.length !== 0; ) {
      let h = n.pop();
      if (l.push(h), r === R && h.point[0] > c || r === g && h.point[0] > i[2])
        break;
      if (h.left) {
        f = u4 = s.insert(h), p = s.minNode(), u4 !== p ? u4 = s.prev(u4) : u4 = null, f = s.next(f);
        const E = u4 ? u4.key : null;
        let a;
        if (P(h, E, r), f && x(h, f.key, n) === 2 && (P(h, E, r), P(f.key, h, r)), u4 && x(u4.key, h, n) === 2) {
          let I = u4;
          I !== p ? I = s.prev(I) : I = null, a = I ? I.key : null, P(E, a, r), P(h, E, r);
        }
      } else
        h = h.otherEvent, f = u4 = s.find(h), u4 && f && (u4 !== p ? u4 = s.prev(u4) : u4 = null, f = s.next(f), s.remove(h), f && u4 && x(u4.key, f.key, n));
    }
    return l;
  }
  var H = class {
    /**
     * Contour
     *
     * @class {Contour}
     */
    constructor() {
      this.points = [], this.holeIds = [], this.holeOf = null, this.depth = null;
    }
    isExterior() {
      return this.holeOf == null;
    }
  };
  function b(n) {
    let t, e, i, o, r;
    const s = [];
    for (e = 0, i = n.length; e < i; e++)
      t = n[e], (t.left && t.inResult || !t.left && t.otherEvent.inResult) && s.push(t);
    let l = false;
    for (; !l; )
      for (l = true, e = 0, i = s.length; e < i; e++)
        e + 1 < i && w(s[e], s[e + 1]) === 1 && (o = s[e], s[e] = s[e + 1], s[e + 1] = o, l = false);
    for (e = 0, i = s.length; e < i; e++)
      t = s[e], t.otherPos = e;
    for (e = 0, i = s.length; e < i; e++)
      t = s[e], t.left || (r = t.otherPos, t.otherPos = t.otherEvent.otherPos, t.otherEvent.otherPos = r);
    return s;
  }
  function q(n, t, e, i) {
    let o = n + 1, r = t[n].point, s;
    const l = t.length;
    for (o < l && (s = t[o].point); o < l && s[0] === r[0] && s[1] === r[1]; ) {
      if (e[o])
        o++;
      else
        return o;
      o < l && (s = t[o].point);
    }
    for (o = n - 1; e[o] && o > i; )
      o--;
    return o;
  }
  function tt(n, t, e) {
    const i = new H();
    if (n.prevInResult != null) {
      const o = n.prevInResult, r = o.outputContourId;
      if (o.resultTransition > 0) {
        const l = t[r];
        if (l.holeOf != null) {
          const c = l.holeOf;
          t[c].holeIds.push(e), i.holeOf = c, i.depth = t[r].depth;
        } else
          t[r].holeIds.push(e), i.holeOf = r, i.depth = t[r].depth + 1;
      } else
        i.holeOf = null, i.depth = t[r].depth;
    } else
      i.holeOf = null, i.depth = 0;
    return i;
  }
  function nt(n) {
    let t, e;
    const i = b(n), o = {}, r = [];
    for (t = 0, e = i.length; t < e; t++) {
      if (o[t])
        continue;
      const s = r.length, l = tt(i[t], r, s), c = (h) => {
        o[h] = true, h < i.length && i[h] && (i[h].outputContourId = s);
      };
      let u4 = t, f = t;
      const p = i[t].point;
      for (l.points.push(p); c(u4), u4 = i[u4].otherPos, c(u4), l.points.push(i[u4].point), u4 = q(u4, i, o, f), !(u4 == f || u4 >= i.length || !i[u4]); )
        ;
      r.push(l);
    }
    return r;
  }
  var L = Math.max;
  var V = Math.min;
  var N = 0;
  function D2(n, t, e, i, o, r) {
    let s, l, c, u4, f, p;
    for (s = 0, l = n.length - 1; s < l; s++) {
      if (c = n[s], u4 = n[s + 1], f = new S(c, false, void 0, t), p = new S(u4, false, f, t), f.otherEvent = p, c[0] === u4[0] && c[1] === u4[1])
        continue;
      f.contourId = p.contourId = e, r || (f.isExteriorRing = false, p.isExteriorRing = false), w(f, p) > 0 ? p.left = true : f.left = true;
      const h = c[0], E = c[1];
      o[0] = V(o[0], h), o[1] = V(o[1], E), o[2] = L(o[2], h), o[3] = L(o[3], E), i.push(f), i.push(p);
    }
  }
  function et(n, t, e, i, o) {
    const r = new TinyQueue(void 0, w);
    let s, l, c, u4, f, p;
    for (c = 0, u4 = n.length; c < u4; c++)
      for (s = n[c], f = 0, p = s.length; f < p; f++)
        l = f === 0, l && N++, D2(
          s[f],
          true,
          N,
          r,
          e,
          l
        );
    for (c = 0, u4 = t.length; c < u4; c++)
      for (s = t[c], f = 0, p = s.length; f < p; f++)
        l = f === 0, o === g && (l = false), l && N++, D2(
          s[f],
          false,
          N,
          r,
          i,
          l
        );
    return r;
  }
  var C = [];
  function it(n, t, e) {
    let i = null;
    return n.length * t.length === 0 && (e === R ? i = C : e === g ? i = n : (e === y || e === T) && (i = n.length === 0 ? t : n)), i;
  }
  function rt(n, t, e, i, o) {
    let r = null;
    return (e[0] > i[2] || i[0] > e[2] || e[1] > i[3] || i[1] > e[3]) && (o === R ? r = C : o === g ? r = n : (o === y || o === T) && (r = n.concat(t))), r;
  }
  function j(n, t, e) {
    let i = n, o = t;
    typeof n[0][0][0] == "number" && (i = [n]), typeof t[0][0][0] == "number" && (o = [t]);
    let r = it(i, o, e);
    if (r)
      return r === C ? null : r;
    const s = [1 / 0, 1 / 0, -1 / 0, -1 / 0], l = [1 / 0, 1 / 0, -1 / 0, -1 / 0], c = et(i, o, s, l, e);
    if (r = rt(i, o, s, l, e), r)
      return r === C ? null : r;
    const u4 = Q(
      c,
      i,
      o,
      s,
      l,
      e
    ), f = nt(u4), p = [];
    for (let h = 0; h < f.length; h++) {
      let E = f[h];
      if (E.isExterior()) {
        let a = [E.points];
        for (let I = 0; I < E.holeIds.length; I++) {
          let d = E.holeIds[I];
          a.push(f[d].points);
        }
        p.push(a);
      }
    }
    return p;
  }
  function lt(n, t) {
    return j(n, t, y);
  }
  function ft(n, t) {
    return j(n, t, g);
  }
  function ht(n, t) {
    return j(n, t, T);
  }
  function ct(n, t) {
    return j(n, t, R);
  }
  var pt = { UNION: y, DIFFERENCE: g, INTERSECTION: R, XOR: T };
  return __toCommonJS(entry_exports);
})();
