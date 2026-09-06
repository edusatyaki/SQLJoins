/* ------------------------------------------------------------------
   main.js - deck state machine + DOM rendering.

   The deck is a flat list of (slide, step) positions. Left/right move
   one step; up/down jump a whole slide. Position lives in the URL hash
   so any step is linkable.
------------------------------------------------------------------ */
import { slides } from './slides.js';

const $ = id => document.getElementById(id);
const el = {
  crumb: $('crumb'), kicker: $('kicker'), title: $('title'), say: $('say'),
  sqlWrap: $('sqlWrap'), sql: $('sql'), resWrap: $('resWrap'), res: $('res'), resTag: $('resTag'),
  venn: $('venn'), vennWrap: $('vennWrap'), vennCap: $('vennCap'),
  stage: $('stage'), legend: $('legend'), progress: $('progress'), stepcount: $('stepcount'),
  prev: $('prevBtn'), next: $('nextBtn'), help: $('help'),
  fsBtn: $('fsBtn'), fsLabel: $('fsLabel'), fsPath: $('fsPath'),
  fallback: $('fallback')
};

/* flatten every step so navigation is a single index */
const flat = [];
slides.forEach((s, si) => s.steps.forEach((_, ki) => flat.push([si, ki])));
let cursor = 0;

/* ---------- 3D stage, loaded defensively ---------- */
let scene = null;
(async () => {
  try {
    const mod = await import('./scene.js');
    scene = mod.createScene($('gl'));
    render();
  } catch (err) {
    console.warn('3D stage unavailable, continuing in text-only mode:', err);
    el.stage.classList.add('no3d');
    el.fallback.hidden = false;
  }
})();

/* ---------- progress segments ---------- */
slides.forEach((s, i) => {
  const b = document.createElement('button');
  b.className = 'seg';
  b.type = 'button';
  b.title = s.title.replace(/&mdash;/g, '—').replace(/<[^>]+>/g, '');
  b.setAttribute('aria-label', `Slide ${i + 1}: ${b.title}`);
  b.appendChild(document.createElement('i'));
  b.addEventListener('click', () => {
    cursor = flat.findIndex(([si]) => si === i);
    render();
  });
  el.progress.appendChild(b);
});

/* ---------- rendering ---------- */
let lastSlide = -1, lastRowCount = 0;

function render() {
  const [si, ki] = flat[cursor];
  const slide = slides[si];
  const step = slide.steps[ki];

  el.kicker.innerHTML = slide.kicker || '&nbsp;';
  el.title.innerHTML = slide.title;
  el.say.innerHTML = step.say || '';
  el.crumb.innerHTML = `slide ${si + 1} / ${slides.length}`;
  el.stepcount.textContent = `${ki + 1}/${slide.steps.length}`;
  el.legend.innerHTML = slide.legend || '';

  /* Venn: the keep-rule as sets, next to the rows on the stage */
  const venn = step.venn ?? slide.venn;
  if (venn) {
    el.venn.innerHTML = vennSvg(venn.on, slide.vennLabels || ['customers', 'orders']);
    el.vennCap.textContent = venn.cap || '';
    el.vennWrap.hidden = false;
  } else {
    el.vennWrap.hidden = true;
  }

  /* SQL, with the clause being executed lit up */
  const sqlLines = step.sql || slide.sql;
  if (sqlLines && sqlLines.length) {
    const hi = step.hi;
    el.sql.innerHTML = sqlLines.map((line, i) => {
      const cls = !hi ? '' : hi.includes(i) ? ' on' : ' off';
      return `<span class="ln${cls}">${highlightSql(line) || ' '}</span>`;
    }).join('');
    el.sqlWrap.hidden = false;
  } else {
    el.sqlWrap.hidden = true;
  }

  /* result table, rows animating in as they are produced */
  const res = step.res;
  if (res) {
    el.resTag.textContent = res.tag || 'result';
    const head = `<thead><tr>${res.cols.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>`;
    const body = res.rows.length
      ? res.rows.map((r, i) => {
          const fresh = slide === slides[lastSlide] && i >= lastRowCount ? ' class="fresh"' : '';
          return `<tr${fresh}>${r.map(v =>
            `<td${v === 'NULL' ? ' class="null"' : ''}>${escapeHtml(String(v))}</td>`).join('')}</tr>`;
        }).join('')
      : `<tr><td colspan="${res.cols.length}" class="null">0 rows</td></tr>`;
    el.res.innerHTML = head + `<tbody>${body}</tbody>`;
    el.resWrap.hidden = false;
    lastRowCount = res.rows.length;
  } else {
    el.resWrap.hidden = true;
    lastRowCount = 0;
  }
  lastSlide = si;

  /* progress fill: whole slides done, current slide partially */
  [...el.progress.children].forEach((seg, i) => {
    const bar = seg.firstElementChild;
    const pct = i < si ? 1 : i > si ? 0 : (ki + 1) / slide.steps.length;
    bar.style.transform = `scaleX(${pct})`;
  });

  el.prev.disabled = cursor === 0;
  el.next.disabled = cursor === flat.length - 1;

  if (scene) scene.apply(step.scene || { mode: 'join' });

  const hash = `#${slide.id}/${ki + 1}`;
  if (location.hash !== hash) history.replaceState(null, '', hash);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

/* ---------- Venn diagram ----------
   Regions are masked from the two circles rather than drawn by hand, so
   any combination of left / mid / right shades correctly from one spec. */
let vennSeq = 0;
function vennSvg(on, labels) {
  const set = new Set(String(on || '').split(/\s+/).filter(Boolean));
  const u = 'v' + (++vennSeq);
  const CX1 = 80, CX2 = 140, CY = 58, R = 46, W = 220, H = 132;
  const box = `x="0" y="0" width="${W}" height="${H}"`;
  const region = (cond, body) => (cond ? body : '');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Venn diagram: ${escapeHtml([...set].join(' and ') || 'nothing')} shaded">
    <defs>
      <clipPath id="a${u}"><circle cx="${CX1}" cy="${CY}" r="${R}"/></clipPath>
      <clipPath id="b${u}"><circle cx="${CX2}" cy="${CY}" r="${R}"/></clipPath>
      <mask id="nb${u}"><rect ${box} fill="#fff"/><circle cx="${CX2}" cy="${CY}" r="${R}" fill="#000"/></mask>
      <mask id="na${u}"><rect ${box} fill="#fff"/><circle cx="${CX1}" cy="${CY}" r="${R}" fill="#000"/></mask>
    </defs>
    ${region(set.has('left'), `<g clip-path="url(#a${u})"><rect ${box} fill="var(--accent)" opacity=".42" mask="url(#nb${u})"/></g>`)}
    ${region(set.has('right'), `<g clip-path="url(#b${u})"><rect ${box} fill="var(--accent)" opacity=".42" mask="url(#na${u})"/></g>`)}
    ${region(set.has('mid'), `<g clip-path="url(#a${u})"><circle cx="${CX2}" cy="${CY}" r="${R}" fill="var(--accent)" opacity=".8"/></g>`)}
    <circle class="ring" cx="${CX1}" cy="${CY}" r="${R}"/>
    <circle class="ring" cx="${CX2}" cy="${CY}" r="${R}"/>
    <text class="vl" x="${CX1 - 20}" y="126">${escapeHtml(labels[0])}</text>
    <text class="vl" x="${CX2 + 20}" y="126">${escapeHtml(labels[1])}</text>
  </svg>`;
}

/* ---------- SQL syntax colouring ----------
   Small hand-rolled tokeniser: the deck only ever shows a handful of
   statements, so a library would be far more weight than the job needs. */
const SQL_KEYWORDS = new Set(['SELECT','FROM','JOIN','INNER','LEFT','RIGHT','FULL','OUTER','CROSS',
  'ON','USING','NATURAL','WHERE','AND','OR','NOT','IS','NULL','GROUP','BY','HAVING','ORDER','ASC',
  'DESC','LIMIT','AS','UNION','ALL','INTERSECT','EXCEPT','MINUS','DISTINCT','CASE','WHEN','THEN',
  'ELSE','END','IN','EXISTS','CREATE','TABLE','DROP','INSERT','INTO','VALUES','PRIMARY','KEY',
  'FOREIGN','REFERENCES','IF','CASCADE','OVER','PARTITION']);
const SQL_FUNCS = new Set(['COUNT','SUM','AVG','MIN','MAX','COALESCE','ROW_NUMBER','RANK','NULLIF']);

function highlightSql(line) {
  const re = /(--[^\n]*)|('(?:[^']|'')*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|([^\sA-Za-z0-9_]+)/g;
  let out = '', m;
  while ((m = re.exec(line)) !== null) {
    const [tok, comment, str, num, word, ws] = m;
    const e = escapeHtml(tok);
    if (comment) out += `<span class="c">${e}</span>`;
    else if (str) out += `<span class="s">${e}</span>`;
    else if (num) out += `<span class="n">${e}</span>`;
    else if (word) {
      const up = word.toUpperCase();
      /* a short name immediately followed by "." is a table alias */
      if (word.length <= 2 && line[re.lastIndex] === '.') out += `<span class="a">${e}</span>`;
      else if (SQL_KEYWORDS.has(up)) out += `<span class="k">${e}</span>`;
      else if (SQL_FUNCS.has(up)) out += `<span class="f">${e}</span>`;
      else out += `<span class="v">${e}</span>`;
    }
    else if (ws) out += e;
    else out += `<span class="p">${e}</span>`;
  }
  return out;
}

/* ---------- navigation ---------- */
const go = n => { cursor = Math.min(flat.length - 1, Math.max(0, n)); render(); };
const nextSlide = dir => {
  const [si] = flat[cursor];
  const target = Math.min(slides.length - 1, Math.max(0, si + dir));
  go(flat.findIndex(([s]) => s === target));
};

el.prev.addEventListener('click', () => go(cursor - 1));
el.next.addEventListener('click', () => go(cursor + 1));

addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (el.help.open && e.key !== 'Escape') { if (e.key === '?') closeHelp(); return; }
  switch (e.key) {
    case 'ArrowRight': case ' ': case 'PageDown': case 'Enter': go(cursor + 1); break;
    case 'ArrowLeft': case 'PageUp': case 'Backspace': go(cursor - 1); break;
    case 'ArrowDown': nextSlide(1); break;
    case 'ArrowUp': nextSlide(-1); break;
    case 'Home': go(0); break;
    case 'End': go(flat.length - 1); break;
    case 'f': case 'F': toggleFullscreen(); return;
    case '?': el.help.showModal(); return;
    default: return;
  }
  e.preventDefault();
});

/* touch: swipe left/right */
let tx = 0, ty = 0;
addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
  if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6) go(cursor + (dx < 0 ? 1 : -1));
}, { passive: true });

/* ---------- fullscreen ----------
   Safari still needs the webkit-prefixed calls, and the state has to be read
   back from the document: the viewer can leave fullscreen with Esc or the
   system chrome without ever touching our button. */
const ICON_EXPAND = 'M1 6V1h5M15 10v5h-5M15 6V1h-5M1 10v5h5';
const ICON_COLLAPSE = 'M6 1v5H1M10 15v-5h5M10 1v5h5M6 15v-5H1';
const fsRoot = document.documentElement;
const fsActive = () => document.fullscreenElement || document.webkitFullscreenElement || null;
const fsSupported = !!(fsRoot.requestFullscreen || fsRoot.webkitRequestFullscreen);

function toggleFullscreen() {
  if (!fsSupported) return;
  if (fsActive()) {
    (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  } else {
    const req = fsRoot.requestFullscreen || fsRoot.webkitRequestFullscreen;
    const r = req.call(fsRoot);
    if (r && r.catch) r.catch(() => {});   /* denied, e.g. no user gesture */
  }
}

function syncFullscreen() {
  const on = !!fsActive();
  el.fsBtn.setAttribute('aria-pressed', String(on));
  el.fsLabel.textContent = on ? 'Exit' : 'Full';
  el.fsPath.setAttribute('d', on ? ICON_COLLAPSE : ICON_EXPAND);
  el.fsBtn.title = on ? 'Exit fullscreen (F)' : 'Fullscreen (F)';
  if (scene) scene.resize();
}

if (fsSupported) {
  el.fsBtn.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', syncFullscreen);
  document.addEventListener('webkitfullscreenchange', syncFullscreen);
  syncFullscreen();
} else {
  el.fsBtn.hidden = true;
}

/* ---------- help dialog ---------- */
const closeHelp = () => el.help.close();
$('helpBtn').addEventListener('click', () => el.help.showModal());
$('helpClose').addEventListener('click', closeHelp);
el.help.addEventListener('click', e => { if (e.target === el.help) closeHelp(); });

/* ---------- open at the step named in the URL ---------- */
(function restore() {
  const m = /^#([\w-]+)(?:\/(\d+))?$/.exec(location.hash || '');
  if (!m) return;
  const si = slides.findIndex(s => s.id === m[1]);
  if (si < 0) return;
  const ki = Math.max(0, Math.min(slides[si].steps.length - 1, (parseInt(m[2], 10) || 1) - 1));
  cursor = flat.findIndex(([a, b]) => a === si && b === ki);
})();

render();
