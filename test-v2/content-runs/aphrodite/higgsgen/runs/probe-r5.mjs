/**
 * probe-r5.mjs — r5 전용 자체 검사 (팀리드 요구 항목).
 *   섹션별 주 미디어 점유율 · 호버 관문 · 폴드 의미 단위 · 자율 모션(입력 없이 1.2초 간격 표본, 섹션별 주기·진폭)
 *   · 페이지 vh · 전 구간 스크롤 콘솔 에러(1440×900 · 390×844) · 핀별 정착 K/홀드(--e 직독) · 스크린샷.
 *   node test-v2/content-runs/aphrodite/higgsgen/runs/probe-r5.mjs [--shots]
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const D = join(HERE, "..");
const require_ = createRequire(join(HERE, "..", "..", "..", "..", "..", "test-v2/tools/package.json"));
const { chromium } = require_("playwright-core");
const URL_ = "file://" + join(D, "render-r5.html");
const SHOTS = process.argv.includes("--shots");
const SHOTDIR = join(D, "reviews", "screenshots");

const IDLE = {   // 섹션마다 "스스로 움직이는" 대상 (스토리보드 자율 모션 열)
  s1: ".s1main img", s2: ".s2inner", s3: ".bandtrack", s4: ".cmp .seam",
  s5: ".sp1 img", s6: ".s6view img.on", s7: ".mats img", s8: ".s8bleed",
};
const SEC = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"];

const num = (t) => { if (!t || t === "none") return [0, 0, 1]; const v = (t.match(/-?[\d.e+]+/g) || []).map(Number);
  if (t.startsWith("matrix3d") && v.length >= 16) return [v[12], v[13], Math.hypot(v[0], v[1], v[2])];
  if (v.length >= 6) return [v[4], v[5], Math.hypot(v[0], v[1])]; return [0, 0, 1]; };

const out = { url: URL_, viewports: {} };
const browser = await chromium.launch({ headless: true });

for (const VP of [{ w: 1440, h: 900 }, { w: 390, h: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: VP.w, height: VP.h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 140)); });
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 140)));
  await page.goto(URL_, { waitUntil: "load" });
  await page.waitForTimeout(700);
  const V = { vp: `${VP.w}x${VP.h}` };

  V.pageVh = await page.evaluate(() => +(Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) / innerHeight).toFixed(2));
  V.sectionVh = await page.evaluate(() => [...document.querySelectorAll("section")].map((s) => ({ id: s.id, vh: +(s.getBoundingClientRect().height / innerHeight).toFixed(2) })));

  /* 폴드 의미 단위 + 첫 뷰포트 액센트 개체 */
  V.fold = await page.evaluate(() => {
    const vh = innerHeight, seen = new Set(), u = [];
    const vis = (e) => { const c = getComputedStyle(e); return c.display !== "none" && c.visibility !== "hidden" && +c.opacity > .02; };
    const inF = (e) => { const r = e.getBoundingClientRect(); return r.top < vh && r.bottom > 0 && r.width >= 8 && r.height >= 8; };
    const add = (e, k, l) => { if (seen.has(e)) return; u.push(k + ":" + l); seen.add(e); e.querySelectorAll("*").forEach((d) => seen.add(d)); };
    document.querySelectorAll("nav,header,[role=navigation]").forEach((e) => { if (vis(e) && inF(e)) add(e, "nav", e.tagName.toLowerCase()); });
    document.querySelectorAll("a,button,[role=button]").forEach((e) => { if (vis(e) && inF(e) && e.textContent.trim().length > 1) add(e, "cta", e.textContent.trim().slice(0, 18)); });
    for (const e of document.querySelectorAll("body *")) { if (seen.has(e) || !vis(e) || !inF(e)) continue;
      const t = [...e.childNodes].filter((c) => c.nodeType === 3).map((c) => c.nodeValue.trim()).join(" ").trim();
      if (t.length >= 8) add(e, "text", t.slice(0, 18)); }
    for (const e of document.querySelectorAll("img,video,canvas,svg,picture")) { if (seen.has(e) || !vis(e) || !inF(e)) continue;
      const r = e.getBoundingClientRect(); if (r.width < 64 || r.height < 64) continue; add(e, "media", e.tagName.toLowerCase()); }
    const acc = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    let accN = 0; for (const e of document.querySelectorAll("body *")) { if (!vis(e) || !inF(e)) continue; const c = getComputedStyle(e);
      if (c.backgroundColor === "rgb(169, 129, 47)" || c.borderTopColor === "rgb(169, 129, 47)" || c.color === "rgb(169, 129, 47)") accN++; }
    return { units: u, count: u.length, accentToken: acc, accentObjects: accN };
  });

  /* 호버 관문: 감춰진 콘텐츠를 여는 :hover 규칙 + 상한(12px/0.04/2°)을 넘는 호버 변형 */
  V.hoverGates = await page.evaluate(() => {
    const P = ["opacity", "visibility", "clip-path", "max-height", "display", "transform"];
    let rules = 0, gates = 0, motion = 0;
    for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch { continue; }
      const walk = (l) => { for (const r of l) { if (r.cssRules) { walk(r.cssRules); continue; }
        if (!r.selectorText || !/:hover/.test(r.selectorText) || !r.style) continue;
        const set = {}; let any = false; for (const p of P) { const v = r.style.getPropertyValue(p); if (v) { set[p] = v.trim(); any = true; } }
        if (!any) continue; rules++;
        if (set.transform !== undefined || set.opacity !== undefined) motion++;
        for (const b of r.selectorText.split(",").map((x) => x.replace(/:hover/g, "").trim())) {
          let els = []; try { els = [...document.querySelectorAll(b)]; } catch { continue; }
          for (const el of els) { const c = getComputedStyle(el);
            const hid = c.display === "none" || c.visibility === "hidden" || +c.opacity < .05;
            if (hid && el.textContent.trim().length > 3) gates++; } } } };
      walk(rs); }
    return { hoverRulesTouchingLayout: rules, gatedNodes: gates, hoverMotionRules: motion };
  });

  /* 섹션별 주 미디어 점유율 — 그 섹션이 가장 잘 보이는 위치에서 */
  V.mediaShare = [];
  for (const id of SEC) {
    const box = await page.evaluate((i) => { const s = document.getElementById(i); const r = s.getBoundingClientRect();
      return { top: r.top + scrollY, h: r.height }; }, id);
    const maxY = await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - innerHeight);
    await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), Math.max(0, Math.min(box.top + box.h / 2 - VP.h / 2, maxY)));
    await page.waitForTimeout(650);
    const sh = await page.evaluate((i) => { const s = document.getElementById(i); const vw = innerWidth, vh = innerHeight; let best = 0, name = "";
      for (const m of s.querySelectorAll("img,video,canvas,svg")) { const c = getComputedStyle(m); if (c.display === "none" || +c.opacity < .05) continue;
        const r = m.getBoundingClientRect();
        const a = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
        if (a > best) { best = a; name = (m.className || m.tagName).toString().split(" ")[0]; } }
      return { share: +(best / (vw * vh)).toFixed(3), el: name }; }, id);
    V.mediaShare.push({ id, ...sh });
  }

  /* 자율 모션: 입력 없이 9초간 100ms 표본 → 진폭(요소 크기 대비 %)·주기(왕복)·1.2초 변화량 */
  V.autonomous = [];
  for (const id of SEC) {
    const box = await page.evaluate((i) => { const s = document.getElementById(i); const r = s.getBoundingClientRect(); return { top: r.top + scrollY, h: r.height }; }, id);
    const maxY = await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - innerHeight);
    await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), Math.max(0, Math.min(box.top + box.h / 2 - VP.h / 2, maxY)));
    await page.waitForTimeout(900);   // 스크럽 보간이 멎은 뒤에 잰다 — 남은 움직임은 전부 자율 모션이다
    const sel = IDLE[id];
    const rows = await page.evaluate(async ({ sel }) => {
      const el = document.querySelector(sel); if (!el) return null;
      const r0 = el.getBoundingClientRect();
      const pr = el.parentElement ? el.parentElement.getBoundingClientRect() : r0;
      /* 기준 상자: 2px 짜리 시임을 자기 폭으로 재면 1000% 가 나온다 — 얇으면 부모, 뷰포트보다 크면 뷰포트로 잰다 */
      const refW = Math.min(innerWidth, Math.max(24, r0.width < 24 ? pr.width : r0.width));
      const refH = Math.min(innerHeight, Math.max(24, r0.height < 24 ? pr.height : r0.height));
      const cs0 = getComputedStyle(el);
      const durS = (cs0.animationDuration || "0s").split(",")[0].trim();
      const dirS = (cs0.animationDirection || "normal").split(",")[0].trim();
      const s = [];
      for (let k = 0; k < 92; k++) {
        const cs = getComputedStyle(el);
        s.push({ t: performance.now(), tr: cs.transform, op: +cs.opacity, txt: (el.textContent || "").trim().slice(0, 24) });
        await new Promise((r) => setTimeout(r, 100));
      }
      return { w: refW, h: refH, cssPeriodS: parseFloat(durS) * (/alternate/.test(dirS) ? 2 : 1), cssDurS: parseFloat(durS), dir: dirS, s };
    }, { sel });
    if (!rows) { V.autonomous.push({ id, sel, note: "요소 없음" }); continue; }
    const dec = rows.s.map((x) => num(x.tr));
    const sx = dec.map((d) => d[0]), sy = dec.map((d) => d[1]), sc = dec.map((d) => d[2]);
    const span = (a) => Math.max(...a) - Math.min(...a);
    const ampPct = Math.max(
      (span(sx) / Math.max(1, rows.w)) * 100,
      (span(sy) / Math.max(1, rows.h)) * 100,
      span(sc) * 100);
    /* 어느 축이 움직였는지 고르고 극값 사이 간격으로 왕복 주기를 낸다 */
    const pick = [[sx, span(sx) / Math.max(1, rows.w)], [sy, span(sy) / Math.max(1, rows.h)], [sc, span(sc)]].sort((a, b) => b[1] - a[1])[0][0];
    const ext = []; for (let i = 1; i < pick.length - 1; i++) {
      if ((pick[i] - pick[i - 1]) * (pick[i + 1] - pick[i]) < 0) ext.push(rows.s[i].t); }
    const gaps = []; for (let i = 1; i < ext.length; i++) gaps.push(ext[i] - ext[i - 1]);
    const halfMs = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;
    /* 1.2초 창에서의 변화량(요소 크기 대비 %) — "가만히 있으면 죽는가" 시험 */
    let d12 = 0;
    for (let i = 12; i < dec.length; i++) {
      const a = dec[i - 12], b = dec[i];
      d12 = Math.max(d12, Math.abs(b[0] - a[0]) / Math.max(1, rows.w) * 100, Math.abs(b[1] - a[1]) / Math.max(1, rows.h) * 100, Math.abs(b[2] - a[2]) * 100);
    }
    const opSpan = span(rows.s.map((x) => x.op));
    const textChanged = new Set(rows.s.map((x) => x.txt)).size > 1;
    V.autonomous.push({ id, sel, cssDurS: rows.cssDurS, cssPeriodS: rows.cssPeriodS, dir: rows.dir, ampPct: +ampPct.toFixed(2), roundTripS: halfMs ? +((halfMs * 2) / 1000).toFixed(1) : null,
      per1_2sPct: +d12.toFixed(2), opacitySpan: +opSpan.toFixed(2), textChanged, extrema: ext.length });
  }

  /* 핀 정착: --e 를 직독하며 스크롤 → 정착 지점과 홀드 길이 */
  V.pins = [];
  for (const id of ["s2", "s5"]) {
    const g = await page.evaluate((i) => { const s = document.getElementById(i); const r = s.getBoundingClientRect();
      return { top: Math.round(r.top + scrollY), h: Math.round(r.height), k: +s.dataset.scK }; }, id);
    const travel = g.h - VP.h;
    const samples = [];
    for (let f = 0; f <= 25; f++) {
      const y = g.top + Math.round((travel * f) / 25);
      await page.evaluate((yy) => scrollTo({ top: yy, behavior: "instant" }), y);
      await page.waitForTimeout(200);   // 상시 rAF 가 목표에 걸어간 뒤에 읽는다
      const e = await page.evaluate((i) => +(getComputedStyle(document.getElementById(i)).getPropertyValue("--e") || 0), id);
      samples.push({ p: +(f / 25).toFixed(3), y, e: +e.toFixed(4) });
    }
    const first99 = samples.find((s) => s.e >= 0.99);
    const settleP = first99 ? first99.p : null;
    V.pins.push({ id, trackVh: +(g.h / VP.h).toFixed(2), declaredK: g.k,
      settleAtProgress: settleP, settleScrollVh: settleP === null ? null : +((travel * settleP) / VP.h).toFixed(2),
      holdVh: settleP === null ? null : +((travel * (1 - settleP)) / VP.h).toFixed(2),
      settlePctOfSection: settleP === null ? null : +(((VP.h + travel * settleP) / (g.h + VP.h)) * 100).toFixed(1),
      eAtStart: samples[0].e, eAtEnd: samples[samples.length - 1].e });
  }

  /* 전 구간 스크롤 — 콘솔 에러 */
  const maxY = await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - innerHeight);
  for (let y = 0; y <= maxY; y += Math.round(VP.h * 0.5)) {
    await page.evaluate((yy) => scrollTo({ top: yy, behavior: "instant" }), y);
    await page.waitForTimeout(90);
  }
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(300);
  V.consoleErrors = errors;

  /* petrol 지면 텍스트 대비(도구는 폴드만 본다) */
  V.petrolContrast = await page.evaluate(() => {
    const lum = (c) => { const m = c.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => { const x = v / 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); });
      return .2126 * m[0] + .7152 * m[1] + .0722 * m[2]; };
    const out = [];
    for (const id of ["s5", "s6", "s7", "s8"]) { const s = document.getElementById(id);
      for (const el of s.querySelectorAll("h2,p,span,label,button,input")) {
        const t = (el.textContent || "").trim(); if (!t) continue;
        const cs = getComputedStyle(el); let bg = null, cur = el;
        while (cur) { const b = getComputedStyle(cur).backgroundColor; if (b && !/rgba\(0, 0, 0, 0\)/.test(b)) { bg = b; break; } cur = cur.parentElement; }
        if (!bg) continue;
        const L1 = lum(cs.color), L2 = lum(bg);
        const cr = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
        out.push({ sec: id, el: el.tagName.toLowerCase() + "." + (String(el.className).split(" ")[0] || ""), px: Math.round(parseFloat(cs.fontSize)), ratio: +cr.toFixed(2), t: t.slice(0, 26) });
      } }
    return out.sort((a, b) => a.ratio - b.ratio).slice(0, 8);
  });

  if (SHOTS) {
    mkdirSync(SHOTDIR, { recursive: true });
    for (const id of SEC) {
      const box = await page.evaluate((i) => { const s = document.getElementById(i); const r = s.getBoundingClientRect(); return { top: r.top + scrollY, h: r.height }; }, id);
      const y = Math.max(0, Math.min(box.top + (["s2", "s5"].includes(id) ? box.h * 0.62 : box.h / 2) - VP.h / 2, maxY));
      await page.evaluate((yy) => scrollTo({ top: yy, behavior: "instant" }), y);
      await page.waitForTimeout(700);
      await page.screenshot({ path: join(SHOTDIR, `r5-${VP.w}-${id}.jpg`), type: "jpeg", quality: VP.w === 1440 ? 58 : 66 });
    }
  }
  out.viewports[V.vp] = V;
  await ctx.close();
}
await browser.close();
mkdirSync(join(D, "reviews"), { recursive: true });
writeFileSync(join(D, "reviews", "probe-r5.json"), JSON.stringify(out, null, 1));
for (const [vp, V] of Object.entries(out.viewports)) {
  console.log(`\n=== ${vp} · page ${V.pageVh}vh · console errors ${V.consoleErrors.length} ===`);
  console.log("  sections vh: " + V.sectionVh.map((s) => `${s.id} ${s.vh}`).join(" · "));
  console.log("  media share: " + V.mediaShare.map((s) => `${s.id} ${s.share}`).join(" · ") +
    ` → median ${[...V.mediaShare.map((s) => s.share)].sort((a, b) => a - b)[4]}`);
  console.log(`  fold units ${V.fold.count} [${V.fold.units.join(", ")}] · accent objects in fold ${V.fold.accentObjects}`);
  console.log(`  hover: gated nodes ${V.hoverGates.gatedNodes} · hover rules touching layout ${V.hoverGates.hoverRulesTouchingLayout} · motion rules ${V.hoverGates.hoverMotionRules}`);
  for (const a of V.autonomous) console.log(`  idle ${a.id.padEnd(3)} ${String(a.sel).padEnd(16)} css ${a.cssDurS}s(${a.dir}) cycle ${a.cssPeriodS}s · amp ${String(a.ampPct).padStart(5)}% · measured round-trip ${a.roundTripS}s · per-1.2s ${a.per1_2sPct}% · opacity span ${a.opacitySpan}`);
  for (const p of V.pins) console.log(`  pin ${p.id} track ${p.trackVh}vh k=${p.declaredK} → settle at p=${p.settleAtProgress} (${p.settlePctOfSection}% of section) · hold ${p.holdVh}vh · e ${p.eAtStart}→${p.eAtEnd}`);
  console.log("  petrol worst contrast: " + V.petrolContrast.slice(0, 4).map((c) => `${c.el} ${c.px}px ${c.ratio}:1`).join(" · "));
  if (V.consoleErrors.length) console.log("  ERRORS: " + V.consoleErrors.join(" | "));
}
console.log("\nPROBE_R5_DONE");
