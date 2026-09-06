/* ------------------------------------------------------------------
   scene.js - the 3D stage.

   The one idea the visual encodes: DEPTH MEANS MEMBERSHIP.
   Source rows sit on a back plane. When a pair satisfies ON, the
   combined row flies FORWARD onto the result plane. So "did this row
   make it into the result set" is literally how close it is to you.

   Cards are drawn as real table rows: every column has a fixed width,
   so cells line up down a column, and a header card names them.
------------------------------------------------------------------ */
import * as THREE from 'three';
import { CUSTOMERS, ORDERS } from './data.js';

/* ---------- palette: text is white-ish in every live state; the
     "dropped" look is carried by opacity, not by dimming the type ---- */
const PALETTE = {
  idle:   { fill: 0x1A222C, edge: 0x3B4A5A, text: 0xFFFFFF },
  active: { fill: 0x1E2D3D, edge: 0x58A6E8, text: 0xFFFFFF },
  keep:   { fill: 0x152C22, edge: 0x4FBF8B, text: 0xFFFFFF },
  drop:   { fill: 0x171C22, edge: 0x36404C, text: 0xDCE4EC },
  result: { fill: 0x17293B, edge: 0x58A6E8, text: 0xFFFFFF },
  ghost:  { fill: 0x161B21, edge: 0x47545F, text: 0xF0F5FA },
  header: { fill: 0x111820, edge: 0x35414F, text: 0xF2F7FC }
};

/* ---------- sizing ---------- */
const CARD_W = 3.2, CARD_H = 0.80, CARD_R = 0.10;
const HEAD_H = 1.16;
const STEP = 1.02;         /* row pitch */
const GAP = 0.16;          /* header-to-first-row gap */
/* FRONT_Z / COL_X are tuned together: perspective makes front-plane cards
   project wider, so the source columns must sit far enough out that the
   result column never covers them. Verified clear at aspects 1.17-3.0. */
const BACK_Z = -1.0, FRONT_Z = 2.2;
const COL_X = 4.35;
const TEX_W = 960;         /* texture width; height follows the card aspect */

/* Column widths in texture pixels. They sum to TEX_W - 2*PAD, so the
   same cell index always lands at the same x on every card. */
const PAD = 36;
const LAYOUT = {
  customer: { title: 'customers', cols: [380, 235, 273], head: ['customer_id', 'name', 'city'] },
  order:    { title: 'orders',    cols: [285, 390, 213], head: ['order_id', 'customer_id', 'amount'] },
  result:   { title: 'result',    cols: [444, 444],      head: ['name', 'amount'] },
  set:      { title: 'students',  cols: [888],           head: ['student'] }
};

/* ---------- geometry ---------- */
function roundedShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
const geoCache = new Map();
function geos(w, h) {
  const key = `${w}x${h}`;
  if (!geoCache.has(key)) {
    geoCache.set(key, {
      fill: new THREE.ShapeGeometry(roundedShape(w, h, CARD_R)),
      edge: new THREE.ShapeGeometry(roundedShape(w + 0.05, h + 0.05, CARD_R + 0.02)),
      plane: new THREE.PlaneGeometry(w, h)
    });
  }
  return geoCache.get(key);
}

const MONO = '"IBM Plex Mono", ui-monospace, monospace';
const SANS = '"Source Sans 3", system-ui, sans-serif';

/* Column rules + text, painted white so material.color can tint per state. */
function paintColumns(g, W, H, cols, drawCell) {
  const xs = [];
  let x = PAD;
  for (const w of cols) { xs.push(x); x += w; }

  /* faint vertical rules at every column boundary - this is what makes
     the stack read as a table rather than as a list of labels */
  g.strokeStyle = 'rgba(255,255,255,0.28)';
  g.lineWidth = 2;
  for (let i = 1; i < cols.length; i++) {
    const bx = xs[i] - 12;
    g.beginPath(); g.moveTo(bx, 10); g.lineTo(bx, H - 10); g.stroke();
  }
  cols.forEach((w, i) => drawCell(xs[i], w, i));
  return xs;
}

function rowTexture(cells, kind) {
  const L = LAYOUT[kind] || LAYOUT.result;
  const H = Math.round(TEX_W * CARD_H / CARD_W);
  const cv = document.createElement('canvas');
  cv.width = TEX_W; cv.height = H;
  const g = cv.getContext('2d');
  g.textBaseline = 'middle';
  const parts = cells.map(c => (typeof c === 'string' ? { t: c } : c));

  paintColumns(g, TEX_W, H, L.cols, (x, w, i) => {
    const p = parts[i];
    if (!p) return;
    g.font = `${p.dim ? 'italic ' : ''}500 70px ${MONO}`;
    g.fillStyle = `rgba(255,255,255,${p.dim ? 0.68 : 1})`;
    g.fillText(p.t, x, H / 2 + 2);
  });

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function headTexture(kind) {
  const L = LAYOUT[kind] || LAYOUT.result;
  const H = Math.round(TEX_W * HEAD_H / CARD_W);
  const cv = document.createElement('canvas');
  cv.width = TEX_W; cv.height = H;
  const g = cv.getContext('2d');
  g.textBaseline = 'middle';

  /* line 1: the table's name */
  g.font = `600 34px ${SANS}`;
  g.fillStyle = 'rgba(255,255,255,0.80)';
  g.letterSpacing = '4px';
  g.fillText((L.title || '').toUpperCase(), PAD, H * 0.24);
  g.letterSpacing = '0px';

  /* line 2: the column names, on the same grid as the data rows */
  const cols = L.cols;
  let x = PAD;
  const xs = cols.map(w => { const v = x; x += w; return v; });
  g.strokeStyle = 'rgba(255,255,255,0.26)';
  g.lineWidth = 2;
  for (let i = 1; i < cols.length; i++) {
    const bx = xs[i] - 12;
    g.beginPath(); g.moveTo(bx, H * 0.42); g.lineTo(bx, H - 12); g.stroke();
  }
  g.beginPath(); g.moveTo(PAD - 8, H * 0.42); g.lineTo(TEX_W - PAD + 8, H * 0.42); g.stroke();
  g.font = `500 54px ${MONO}`;
  g.fillStyle = 'rgba(255,255,255,1)';
  L.head.forEach((t, i) => g.fillText(t, xs[i], H * 0.72));

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* ---------- a card ---------- */
class Card {
  constructor(tex, h = CARD_H) {
    const G = geos(CARD_W, h);
    this.group = new THREE.Group();
    this.edge = new THREE.Mesh(G.edge, new THREE.MeshBasicMaterial({ transparent: true }));
    this.fill = new THREE.Mesh(G.fill, new THREE.MeshBasicMaterial({ transparent: true }));
    this.fill.position.z = 0.001;
    this.text = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false
    }));
    this.text.position.z = 0.002;
    this.group.add(this.edge, this.fill, this.text);
    this.h = h;

    this.pos = new THREE.Vector3(0, 0, BACK_Z);
    this.tPos = this.pos.clone();
    this.opacity = 0; this.tOpacity = 0;
    this.scale = 1; this.tScale = 1;
    this.cFill = new THREE.Color(PALETTE.idle.fill);
    this.cEdge = new THREE.Color(PALETTE.idle.edge);
    this.cText = new THREE.Color(PALETTE.idle.text);
    this.tFill = this.cFill.clone(); this.tEdge = this.cEdge.clone(); this.tText = this.cText.clone();
    this.apply();
  }
  setState(name) {
    const p = PALETTE[name] || PALETTE.idle;
    this.tFill.setHex(p.fill); this.tEdge.setHex(p.edge); this.tText.setHex(p.text);
  }
  moveTo(x, y, z) { this.tPos.set(x, y, z); }
  apply() {
    this.group.position.copy(this.pos);
    this.group.scale.setScalar(this.scale);
    this.edge.material.color.copy(this.cEdge);
    this.fill.material.color.copy(this.cFill);
    this.text.material.color.copy(this.cText);
    this.edge.material.opacity = this.opacity;
    this.fill.material.opacity = this.opacity;
    this.text.material.opacity = this.opacity;
    this.group.visible = this.opacity > 0.01;
  }
  tick(k) {
    this.pos.lerp(this.tPos, k);
    this.opacity += (this.tOpacity - this.opacity) * k;
    this.scale += (this.tScale - this.scale) * k;
    this.cFill.lerp(this.tFill, k);
    this.cEdge.lerp(this.tEdge, k);
    this.cText.lerp(this.tText, k);
    this.apply();
  }
}

/* ---------- the scene ---------- */
export function createScene(canvas) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 120);

  const starGeo = new THREE.BufferGeometry();
  const starN = 260, sp = new Float32Array(starN * 3);
  for (let i = 0; i < starN; i++) {
    sp[i * 3] = (Math.random() - 0.5) * 34;
    sp[i * 3 + 1] = (Math.random() - 0.5) * 20;
    sp[i * 3 + 2] = -6 - Math.random() * 20;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0x2A3947, size: 0.06, transparent: true, opacity: 0.85
  }));
  scene.add(stars);

  const headers = {
    left:   new Card(headTexture('customer'), HEAD_H),
    right:  new Card(headTexture('order'), HEAD_H),
    result: new Card(headTexture('result'), HEAD_H),
    sets:   new Card(headTexture('set'), HEAD_H)
  };
  const leftCards = new Map(CUSTOMERS.map(c => [c.id, new Card(rowTexture(c.cells, 'customer'))]));
  const rightCards = new Map(ORDERS.map(o => [o.id, new Card(rowTexture(o.cells, 'order'))]));
  const resultCards = new Map();
  const setCards = new Map();

  const all = () => [
    ...Object.values(headers), ...leftCards.values(), ...rightCards.values(),
    ...resultCards.values(), ...setCards.values()
  ];
  Object.values(headers).forEach(c => scene.add(c.group));
  leftCards.forEach(c => scene.add(c.group));
  rightCards.forEach(c => scene.add(c.group));

  const MAX_LINKS = 40;
  const linkPos = new Float32Array(MAX_LINKS * 6);
  const linkCol = new Float32Array(MAX_LINKS * 6);
  const linkGeo = new THREE.BufferGeometry();
  linkGeo.setAttribute('position', new THREE.BufferAttribute(linkPos, 3));
  linkGeo.setAttribute('color', new THREE.BufferAttribute(linkCol, 3));
  const links = new THREE.LineSegments(linkGeo, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.8
  }));
  links.frustumCulled = false;
  scene.add(links);
  let activeLinks = [];

  /* --- layout helpers --- */
  /* Each column (header + n rows) is centred on y = 0 independently, so a
     3-row table and a 5-row table both sit in the middle of the frame. */
  const colOffset = (n, step = STEP) => {
    const top = CARD_H / 2 + GAP + HEAD_H;           /* above row 0's centre */
    const bottom = -(n - 1) * step - CARD_H / 2;     /* below row 0's centre */
    return -(top + bottom) / 2;
  };
  const stackY = (i, n, step = STEP) => -i * step + colOffset(n, step);
  const headY = (n, step = STEP) => CARD_H / 2 + GAP + HEAD_H / 2 + colOffset(n, step);

  function resultCard(l, r) {
    const key = `${l ?? 'x'}-${r ?? 'x'}`;
    if (!resultCards.has(key)) {
      const cust = l == null ? null : CUSTOMERS.find(c => c.id === l);
      const ord = r == null ? null : ORDERS.find(o => o.id === r);
      const card = new Card(rowTexture([
        cust ? { t: cust.name } : { t: 'NULL', dim: true },
        ord ? { t: ord.amt } : { t: 'NULL', dim: true }
      ], 'result'));
      resultCards.set(key, card);
      scene.add(card.group);
    }
    return resultCards.get(key);
  }
  function setCard(side, name, label) {
    const key = `${side}:${name}`;
    if (!setCards.has(key)) {
      const card = new Card(rowTexture([{ t: label ?? name }], 'set'));
      setCards.set(key, card);
      scene.add(card.group);
    }
    return setCards.get(key);
  }

  function apply(state) {
    const s = state || {};
    const mode = s.mode || 'join';
    const show = s.show || {};
    const focus = s.focus || {};
    const dim = s.dim || {};
    const results = s.results || [];
    const grid = !!s.grid;
    const has = (arr, id) => Array.isArray(arr) && arr.includes(id);

    all().forEach(c => { c.tOpacity = 0; c.tScale = 1; });

    if (mode === 'join') {
      headers.left.setState('header');
      headers.left.moveTo(-COL_X, headY(CUSTOMERS.length), BACK_Z);
      headers.left.tOpacity = show.left === false ? 0 : 1;

      headers.right.setState('header');
      headers.right.moveTo(COL_X, headY(ORDERS.length), BACK_Z);
      headers.right.tOpacity = show.right === false ? 0 : 1;

      headers.result.setState('header');
      headers.result.moveTo(0, grid ? 1.75 : headY(results.length), FRONT_Z);
      headers.result.tOpacity = results.length ? 1 : 0;

      CUSTOMERS.forEach((c, i) => {
        const card = leftCards.get(c.id);
        card.moveTo(-COL_X, stackY(i, CUSTOMERS.length), BACK_Z);
        card.tOpacity = show.left === false ? 0 : (has(dim.l, c.id) ? 0.34 : 1);
        card.setState(has(dim.l, c.id) ? 'drop'
          : has(focus.l, c.id) ? (s.verdict === 'keep' ? 'keep' : 'active') : 'idle');
      });
      ORDERS.forEach((o, i) => {
        const card = rightCards.get(o.id);
        card.moveTo(COL_X, stackY(i, ORDERS.length), BACK_Z);
        card.tOpacity = show.right === false ? 0 : (has(dim.r, o.id) ? 0.34 : 1);
        card.setState(has(dim.r, o.id) ? 'drop'
          : has(focus.r, o.id) ? (s.verdict === 'keep' ? 'keep' : 'active') : 'idle');
      });

      results.forEach((pair, i) => {
        const card = resultCard(pair.l, pair.r);
        if (grid) {
          const cols = 3, cw = 2.1, ch = 0.66;
          const rows = Math.ceil(results.length / cols);
          card.moveTo((i % cols - (cols - 1) / 2) * cw,
                      ((rows - 1) / 2 - Math.floor(i / cols)) * ch + 0.1, FRONT_Z);
          card.tScale = 0.6;
        } else {
          card.moveTo(0, stackY(i, results.length), FRONT_Z);
          card.tScale = 1;
        }
        card.tOpacity = 1;
        card.setState(pair.l == null || pair.r == null ? 'ghost' : 'result');
      });

      activeLinks = (s.links || []).map(L => ({
        a: leftCards.get(L.l), b: rightCards.get(L.r),
        c: L.verdict === 'keep' ? 0x4FBF8B : L.verdict === 'drop' ? 0x50596A : 0x58A6E8
      })).filter(L => L.a && L.b);
    }

    if (mode === 'sets') {
      const sets = s.sets || {};
      const L = sets.left || [], R = sets.right || [], O = sets.out || [];
      headers.sets.setState('header');
      headers.sets.moveTo(-COL_X, headY(L.length), BACK_Z);
      headers.sets.tOpacity = 1;

      headers.right.setState('header');
      headers.right.moveTo(COL_X, headY(R.length), BACK_Z);
      headers.right.tOpacity = 0;   /* orders header is meaningless here */

      headers.result.setState('header');
      headers.result.moveTo(0, headY(O.length), FRONT_Z);
      headers.result.tOpacity = O.length ? 1 : 0;

      L.forEach((n, i) => {
        const card = setCard('l', n);
        card.moveTo(-COL_X, stackY(i, L.length), BACK_Z);
        card.tOpacity = (sets.dimL || []).includes(n) ? 0.32 : 1;
        card.setState((sets.dimL || []).includes(n) ? 'drop'
          : (sets.hotL || []).includes(n) ? 'active' : 'idle');
      });
      R.forEach((n, i) => {
        const card = setCard('r', n);
        card.moveTo(COL_X, stackY(i, R.length), BACK_Z);
        card.tOpacity = (sets.dimR || []).includes(n) ? 0.32 : 1;
        card.setState((sets.dimR || []).includes(n) ? 'drop'
          : (sets.hotR || []).includes(n) ? 'active' : 'idle');
      });
      O.forEach((row, i) => {
        const card = setCard('o', row.t + '#' + i, row.t);
        card.moveTo(0, stackY(i, O.length, 0.86), FRONT_Z);
        card.tOpacity = 1;
        card.setState(row.dupe ? 'ghost' : 'result');
      });
      activeLinks = [];
    }
  }

  /* --- framing: aim at the content's own centre so no height is wasted --- */
  /* every column is centred on 0, so the frame just has to hold the tallest */
  const MID = 0;
  const needH = (headY(5) + HEAD_H / 2 - (stackY(4, 5) - CARD_H / 2)) / 2 + 0.2;
  const needW = COL_X + CARD_W / 2 + 0.3;

  function resize() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const halfV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    camera.position.z = Math.max(needH / halfV, needW / (halfV * camera.aspect)) + 1.2;
    camera.updateProjectionMatrix();
  }

  let last = performance.now(), raf = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 7.5);

    all().forEach(c => c.tick(k));

    let n = 0;
    for (const L of activeLinks) {
      if (n >= MAX_LINKS) break;
      const a = L.a.group.position, b = L.b.group.position;
      const col = new THREE.Color(L.c), o = n * 6;
      linkPos[o] = a.x + CARD_W / 2; linkPos[o + 1] = a.y; linkPos[o + 2] = a.z;
      linkPos[o + 3] = b.x - CARD_W / 2; linkPos[o + 4] = b.y; linkPos[o + 5] = b.z;
      linkCol[o] = col.r; linkCol[o + 1] = col.g; linkCol[o + 2] = col.b;
      linkCol[o + 3] = col.r; linkCol[o + 4] = col.g; linkCol[o + 5] = col.b;
      n++;
    }
    linkGeo.attributes.position.needsUpdate = true;
    linkGeo.attributes.color.needsUpdate = true;
    linkGeo.setDrawRange(0, n * 2);
    links.visible = n > 0;

    if (!reduced) {
      stars.rotation.z += dt * 0.006;
      const t = now / 1000;
      camera.position.x = Math.sin(t * 0.18) * 0.3;
      camera.position.y = MID + Math.sin(t * 0.13) * 0.16;
    } else {
      camera.position.x = 0; camera.position.y = MID;
    }
    camera.lookAt(0, MID, 0.6);
    renderer.render(scene, camera);
  }

  camera.position.set(0, MID, 15);
  resize();
  raf = requestAnimationFrame(frame);
  addEventListener('resize', resize);
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  return {
    apply, resize,
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); removeEventListener('resize', resize); }
  };
}
