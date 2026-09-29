// S3와 SW(와이어프레임)가 같이 쓰는 구조 판정. 같은 규칙은 같은 코드로 센다.
import { elements, textContent, ancestors, contains } from './lib.mjs';

// ★ Forecast/Actual · Production/Content 분리 + 필요한 속성 존재 (HTML 정적 분석)
// 반환: [{ id, line, detail }] — id는 S3 규칙 번호 (S3-8 ~ S3-11)
export function checkStructure(rules, root, screen) {
  const g = rules.gates.S3;
  const out = [];
  const v = (id, line, detail) => out.push({ id, line, detail });

  const fa = g.forecastActual;
  const kindEls = (k) => elements(root, (n) => n.attrs[fa.attribute] === k);
  const forecast = kindEls('forecast');
  const actual = kindEls('actual');
  const sectionOf = (n) => ancestors(n).find((a) => a.tag === 'section' || 'data-section' in a.attrs) || null;
  const fSections = new Set(forecast.map(sectionOf));
  for (const a of actual) {
    if (fSections.has(sectionOf(a))) v('S3-8', a.line, 'actual 요소가 forecast 요소와 같은 섹션에 있음');
  }
  const classes = (n) => (n.attrs.class || '').split(/\s+/).filter(Boolean);
  const fClasses = new Set(forecast.flatMap(classes));
  for (const a of actual) {
    const shared = classes(a).filter((c) => fClasses.has(c));
    if (shared.length) v('S3-8', a.line, `forecast와 같은 클래스 사용: ${shared.join(', ')}`);
  }
  for (const [kind, label] of Object.entries(fa.values)) {
    for (const n of kindEls(kind)) {
      if (!new RegExp(`\\b${label}\\b`, 'i').test(textContent(n))) v('S3-9', n.line, `${fa.attribute}="${kind}" 요소에 "${label}" 라벨 없음`);
    }
  }

  const pc = g.productionContent;
  const secEls = (k) => elements(root, (n) => n.attrs[pc.attribute] === k);
  const [pName, cName] = pc.values;
  for (const p of secEls(pName)) {
    for (const c of secEls(cName)) {
      if (contains(p, c) || contains(c, p)) v('S3-10', Math.max(p.line, c.line), `${pName}와 ${cName} 섹션이 중첩됨`);
    }
  }

  const req = g.requiredOnScreens[screen] || {};
  for (const [attr, values] of Object.entries(req)) {
    for (const val of values) {
      if (!elements(root, (n) => n.attrs[attr] === val).length) v('S3-11', null, `${attr}="${val}" 요소가 없음`);
    }
  }
  return out;
}

// Figma 골격 (렌더 값) — 내비·TopBar·main 패딩·filter bar·카드 그리드
// 반환: [detail 문자열]
export function checkSkeleton(rules, els, values) {
  const out = [];
  const px = (s) => parseFloat(s);
  const label = (e) => `<${e.tag}${e.comp ? ` data-component="${e.comp}"` : ''}> "${e.label}"`;
  const L = rules.layout;

  const nav = els.filter((e) => e.comp === L.nav.component);
  if (!nav.length) out.push(`${L.nav.component} 가 없음`);
  for (const e of nav) if (e.w !== L.nav.width) out.push(`${label(e)} 폭 ${e.w} ≠ ${L.nav.width}`);
  const top = els.filter((e) => e.comp === L.topBar.component);
  if (!top.length) out.push(`${L.topBar.component} 가 없음`);
  for (const e of top) if (e.h !== L.topBar.height) out.push(`${label(e)} 높이 ${e.h} ≠ ${L.topBar.height}`);
  const pad = px(values.get(L.mainPadding));
  for (const e of els.filter((e) => e.tag === 'main')) {
    if (px(e.padding[0]) !== pad || px(e.padding[3]) !== pad) out.push(`<main> padding ${e.padding[0]} / ${e.padding[3]} ≠ ${L.mainPadding}(${pad}px)`);
  }

  // filter bar — Segmented Control(화면 전환)과 Filter / Select(기간)를 함께 담은 부모
  const seg = els.filter((e) => e.comp === L.screenSwitch);
  const sel = els.filter((e) => e.comp === rules.period.control);
  const bar = seg.map((e) => els[e.p]).find((b) => b && sel.some((f) => f.p === b.i));
  if (!bar) out.push(`filter bar 없음 — ${L.screenSwitch}와 ${rules.period.control}를 같은 부모에 둬야 함`);
  else {
    const fb = L.filterBar;
    if (bar.h !== fb.height) out.push(`filter bar 높이 ${bar.h} ≠ ${fb.height}`);
    const s0 = seg.find((e) => e.p === bar.i);
    const fs = sel.filter((e) => e.p === bar.i).sort((a, b) => a.x - b.x);
    const toFilter = px(values.get(fb.segmentedToFilter));
    const firstGap = fs[0].x - (s0.x + s0.w);
    if (firstGap !== toFilter) out.push(`Segmented Control → Filter 간격 ${firstGap} ≠ ${fb.segmentedToFilter}(${toFilter}px)`);
    const filterGap = px(values.get(fb.filterGap));
    for (let k = 1; k < fs.length; k++) {
      const gap = fs[k].x - (fs[k - 1].x + fs[k - 1].w);
      if (gap !== filterGap) out.push(`Filter 사이 간격 ${gap} ≠ ${fb.filterGap}(${filterGap}px)`);
    }
  }

  // 카드 그리드 — data-kind 카드를 2개 이상 담은 부모의 가로·세로 간격
  const cg = L.cardGrid;
  const colGap = px(values.get(cg.columnGap));
  const rowGap = px(values.get(cg.rowGap));
  const parents = new Map();
  for (const e of els.filter((e) => e.kind)) parents.set(e.p, (parents.get(e.p) || 0) + 1);
  for (const [pi, n] of parents) {
    if (n < 2 || pi < 0) continue;
    const g = els[pi];
    if (px(g.columnGap) !== colGap) out.push(`카드 그리드 ${label(g)} 가로 간격 ${g.columnGap} ≠ ${cg.columnGap}(${colGap}px)`);
    if (px(g.rowGap) !== rowGap) out.push(`카드 그리드 ${label(g)} 세로 간격 ${g.rowGap} ≠ ${cg.rowGap}(${rowGap}px)`);
  }
  return out;
}

// 구조 순서 — 섹션·카드 종류·가장 바깥 컴포넌트/플레이스홀더가 문서에 나오는 순서 (S3-16)
export function structureSequence(rules, root) {
  const comp = rules.gates.S3.componentNames.attribute;
  const ph = rules.gates.SW.placeholderAttribute;
  const sec = rules.gates.S3.productionContent.attribute;
  const kind = rules.gates.S3.forecastActual.attribute;
  const isBox = (n) => n.attrs && (comp in n.attrs || ph in n.attrs);
  const seq = [];
  for (const n of elements(root)) {
    if (sec in n.attrs) seq.push(`section:${n.attrs[sec]}`);
    if (kind in n.attrs) seq.push(`kind:${n.attrs[kind]}`);
    if (isBox(n) && !ancestors(n).some(isBox)) {
      seq.push(ph in n.attrs ? `placeholder:${n.attrs[ph]}` : `component:${n.attrs[comp]}`);
    }
  }
  return seq;
}

// 지표·기간·액션 이름이 글에 있는지 — 앞뒤가 글자·하이픈이 아닌 곳에서만 찾는다
export function textHas(text, item) {
  const lower = text.toLowerCase();
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [item.name, ...(item.aliases || [])]
    .some((n) => new RegExp(`(?<![\\w-])${esc(n.toLowerCase())}(?![\\w-])`).test(lower));
}
