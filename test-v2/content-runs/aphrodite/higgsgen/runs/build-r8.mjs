// runs/build-r6.mjs — template-r8.src.html → render-r8.html
// 폰트·이미지·스크롤 엔진을 전부 인라인한다. 렌더 시 외부 요청 0.
// 폴드 A(히어로)와 폴드 C(컨택트 시트)를 승계하고, 그 사이를 스크롤 페이지로 잇는다.
import sharp from '/Users/kwakseongjae/Desktop/projects/oh-my-design/test-v2/tools/node_modules/sharp/lib/index.js';
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = '/Users/kwakseongjae/Desktop/projects/oh-my-design/';
const RUN = ROOT + 'test-v2/content-runs/aphrodite/higgsgen/';
const A = RUN + 'assets/', F = RUN + 'fonts/';
const SET = JSON.parse(readFileSync(RUN + 'set.json', 'utf8'));
const META = Object.fromEntries(SET.items.map(i => [i.id, i]));

const cache = new Map();
async function img(id, w, q, cropLeft = 0) {
  const k = `${id}|${w}|${q}|${cropLeft}`;
  if (!cache.has(k)) {
    let pipe = sharp(A + id + '.png');
    if (cropLeft > 0) {
      const [W, H] = META[id].size.split('x').map(Number);
      pipe = pipe.extract({ left: Math.round(W * cropLeft), top: 0, width: Math.round(W * (1 - cropLeft)), height: H });
    }
    const b = await pipe.resize({ width: Number(w) }).webp({ quality: Number(q), effort: 6 }).toBuffer();
    cache.set(k, 'data:image/webp;base64,' + b.toString('base64'));
  }
  return cache.get(k);
}
const font = n => readFileSync(F + n + '.css', 'utf8').replace(/\/\*[\s\S]*?\*\//, '').trim();
const base = () => readFileSync(RUN + 'folds/src/_base.css', 'utf8');
const engine = () => readFileSync(ROOT + 'docs/design-excellence/fx-library/smooth-scrub-engine/snippet.js', 'utf8');

/* ── S2 시퀀스 ── 카피는 set.json 의 각 프레임 프롬프트에서 그대로 가져온다.
   순서: 각도(01→02→03) → 높이(07→08) → 시각(04→05→06). 방 은 고정, 한 번에 한 변수. */
const SEQ = [
  ['seq-01', 'anchor',   'eye level, straight on, 35mm · 09:00 hard side light from the window'],
  ['seq-02', 'angle',    'camera moved 45 degrees left along the bench · 09:00 light unchanged'],
  ['seq-03', 'angle',    'camera moved 90 degrees, looking down the bench end-on · 09:00 light unchanged'],
  ['seq-07', 'height',   'camera lowered to bench height, the vessel breaks the horizon · 09:00'],
  ['seq-08', 'height',   'camera raised to look down at 30 degrees onto the bench · 09:00'],
  ['seq-04', 'hour',     '13:00 · light high, short shadows, the window patch fallen to the floor'],
  ['seq-05', 'hour',     '17:00 · long warm light entering low, shadows stretched across the wall'],
  ['seq-06', 'hour',     'after dark · only the cord lamp lit, the window black'],
];

/* ── S4 전후 쌍 ── ba-*-a 는 스케치, -b 는 같은 각도의 사진. */
const PAIRS = [
  ['ba-01', 'Café counter',   'A loose grey ballpoint sketch of a café interior corner with a marble counter, two stools and a plant shelf, on cheap paper.',
                              'A café interior corner with a marble counter, two stools and a plant shelf, photographed in morning light at the angle of the sketch.'],
  ['ba-02', 'Stair core',     'A marker sketch of a concrete stair core with a steel handrail, drawn in flat strokes.',
                              'A concrete stair core with a steel handrail, photographed at the angle of the sketch.'],
  ['ba-03', 'Kitchen shelf',  'A pencil sketch of a kitchen shelf with stacked bowls and a hanging cloth.',
                              'A kitchen shelf with stacked bowls and a hanging cloth, photographed at the angle of the sketch.'],
  ['ba-04', 'Window seat',    'A ballpoint sketch of a window seat with a folded blanket and a low table.',
                              'A window seat with a folded blanket and a low table, photographed at the angle of the sketch.'],
];

/* ── S3 컨택트 시트 ── 확대되는 한 장(hero-05)을 뺀 60장. */
const BIG = 'hero-05';
const FEATURE = new Set(['hero-03','grid-04','arch-02','mat-03','abs-02','prod-02','seq-05','grid-09','fig-02','ba-02-b','amb-01','arch-04','grid-11','abs-05','mat-06','seq-02']);
async function sheet(thumbW, q) {
  const ids = SET.items.map(i => i.id).filter(i => i !== BIG);
  const out = [];
  for (const id of ids) {
    const [w, h] = META[id].size.split('x').map(Number);
    const portrait = h > w;
    let cls = portrait ? 'p' : (FEATURE.has(id) ? 'f' : '');
    const seq = /^seq-/.test(id);
    if (seq) cls += ' s';
    const uri = await img(id, portrait ? Math.round(thumbW * 0.9) : (cls.startsWith('f') ? thumbW * 2 : thumbW), q, seq ? 0.30 : 0);
    out.push(`<i class="c ${cls}"><img class="g" src="${uri}" alt="${esc(shortAlt(id))}"></i>`);
  }
  console.log(`[sheet] ${ids.length}장`);
  return out.join('');
}

/* ── S5 띠 ── grid 12장. */
async function band(w, q) {
  const ids = SET.items.map(i => i.id).filter(i => /^grid-/.test(i));
  const out = [];
  for (const id of ids) out.push(`<img class="g" src="${await img(id, w, q)}" alt="${esc(shortAlt(id))}">`);
  console.log(`[band] ${ids.length}장`);
  return out.join('');
}

/* ── S6 재질 ── mat 3장. */
const MATS = [
  ['mat-01', 'folded cloth, raking light'],
  ['mat-03', 'unglazed clay, thumb marks held'],
  ['mat-05', 'cut paper edge, fibre visible'],
];

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function shortAlt(id) {
  const p = (META[id].prompt || '').replace(/\s+/g, ' ');
  const first = p.split(/(?<=\.)\s/)[0] || p;
  return first.length > 150 ? first.slice(0, 147) + '…' : first;
}

let s = readFileSync(RUN + 'runs/template-r8.src.html', 'utf8');
s = s.split('{{FONT_SYNE}}').join(font('syne'))
     .split('{{FONT_GEIST}}').join(font('geist'))
     .split('{{FONT_MONO}}').join(font('geist-mono'))
     .split('{{BASE}}').join(base())
     .split('{{ENGINE}}').join(engine())
     .split('{{VIDEO}}').join('data:video/mp4;base64,' + readFileSync(RUN + 'video/flight-720.mp4').toString('base64'))
     .split('{{POSTER}}').join('data:image/jpeg;base64,' + readFileSync(RUN + 'video/poster.jpg').toString('base64'))

/* SEQ 이미지와 캡션 */
{
  const imgs = [];
  for (let i = 0; i < SEQ.length; i++) {
    const [id, , cap] = SEQ[i];
    imgs.push(`<img class="g${i === 0 ? ' on' : ''}" src="${await img(id, 1150, 56)}" alt="${esc(shortAlt(id))}">`);
  }
  s = s.split('{{SEQ}}').join(imgs.join(''));
  s = s.split('{{CAPS}}').join(JSON.stringify(SEQ.map(x => [x[1], x[2]])));
}

/* SHEET · BAND · MATS */
s = s.split('{{SHEET}}').join(await sheet(206, 48));
s = s.split('{{BAND}}').join(await band(560, 56));
{
  const out = [];
  for (const [id, cap] of MATS) {
    out.push(`<figure class="m${out.length + 1}"><img class="g" src="${await img(id, 760, 60)}" alt="${esc(shortAlt(id))}"><figcaption>${esc(cap)}</figcaption></figure>`);
  }
  s = s.split('{{MATS}}').join(out.join(''));
}

/* PAIRS — 첫 쌍은 마크업에 이미 있고, 나머지는 JS 가 교체한다 */
{
  const arr = [];
  for (const [base, label, altA, altB] of PAIRS) {
    arr.push({ label, a: await img(base + '-a', 980, 54), b: await img(base + '-b', 980, 54), altA, altB });
  }
  s = s.split('{{PAIRS}}').join(JSON.stringify(arr));
}

/* IMG 태그 */
for (const t of [...s.matchAll(/\{\{IMG ([\w-]+) (\d+) (\d+)\}\}/g)]) s = s.split(t[0]).join(await img(t[1], t[2], t[3]));

writeFileSync(RUN + 'render-r8.html', s);
console.log(`render-r8.html  ${(Buffer.byteLength(s) / 1024 / 1024).toFixed(2)}MB`);
