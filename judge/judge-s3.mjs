// S3 HTML 판정 — docs/gates.md S3. 모든 항목이 0건이면 통과.
import path from 'node:path';
import {
  REPO, loadRules, parseArgs, readIfExists, finish, fail, loadTokenNames,
  loadTokenValues, tokenValuesByPrefix, CSS_NAMED_COLORS, renderMeasure,
  parseCss, parseHtml, elements, textContent, ancestors, contains,
} from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const rules = loadRules();
const g = rules.gates.S3;
const htmlFile = g.files.html;
const cssFile = g.files.css;
const html = readIfExists(path.join(args.run, htmlFile));
if (html === null) fail('S3', args, 'S3-format', htmlFile, '파일이 없음');
const css = readIfExists(path.join(args.run, cssFile)) ?? '';

const tokens = loadTokenNames(rules);
const { root, styles } = parseHtml(html);

// 검사 대상 CSS: 외부 css + <style> + style="" 속성
const decls = [
  ...parseCss(css, cssFile),
  ...styles.flatMap((s) => parseCss(s.css, htmlFile, s.line)),
  ...elements(root, (n) => n.attrs.style).flatMap((n) =>
    parseCss(`x{${n.attrs.style}}`, htmlFile, n.line - 1).map((d) => ({ ...d, selector: `<${n.tag} style>` }))),
];

const violations = [];
const v = (rule, file, line, detail) => violations.push({ rule, file, line, detail });
const at = (d) => [d.source, d.line];
// 토큰 이름만 지운다. var()의 fallback 값은 남겨서 검사한다.
const stripVars = (s) => s.replace(/--[\w-]+/g, '');

// S3-1 raw 색
const colorRes = g.rawColor.patterns.map((p) => new RegExp(p, 'g'));
for (const d of decls) {
  for (const re of colorRes) for (const m of stripVars(d.value).matchAll(re)) v('S3-1', ...at(d), `${d.selector} { ${d.prop}: ${d.value} } — raw 색 ${m[0]}`);
}
// 색 이름 (white, red …) — 색을 받는 속성에서만 센다
const named = g.rawColor.namedColors;
const namedRe = new RegExp(`(?<![\\w-])(${CSS_NAMED_COLORS.join('|')})(?![\\w-])`, 'gi');
for (const d of decls.filter((d) => named.props.some((p) => d.prop === p || d.prop.startsWith(`${p}-`)))) {
  for (const m of stripVars(d.value).matchAll(namedRe)) v('S3-1', ...at(d), `${d.selector} { ${d.prop}: ${d.value} } — 색 이름 ${m[0]}`);
}

// S3-2 var() 없이 쓴 길이 값 — px뿐 아니라 rem·em·vw 등 모든 길이 단위
const onePxProps = new Set(g.rawPx.onePxOnlyForProps);
const dim = g.rawPx.dimensionPx;
const dimProps = new Set(dim.props);
const dimValues = new Set(dim.allowedValues);
const lengthRe = new RegExp(`(?<![\\w.#-])(-?\\d*\\.?\\d+)(${g.rawPx.units.join('|')})(?![\\w-])`, 'gi');
for (const d of decls) {
  if (d.prop.startsWith('--')) continue; // 커스텀 속성 선언은 S3-3에서 막는다
  for (const m of stripVars(d.value).matchAll(lengthRe)) {
    const n = parseFloat(m[1]);
    const unit = m[2].toLowerCase();
    if (n === 0) continue;
    if (unit === 'px' && n === 1 && onePxProps.has(d.prop)) continue;
    if (unit === 'px' && dimProps.has(d.prop) && dimValues.has(n)) continue; // Figma 골격 치수
    v('S3-2', ...at(d), `${d.selector} { ${d.prop}: ${d.value} } — ${m[0]}`);
  }
}

// S3-3 tokens.css에 없는 var / 로컬 커스텀 속성 선언
for (const d of decls) {
  for (const m of d.value.matchAll(/var\(\s*(--[\w-]+)/g)) {
    if (!tokens.has(m[1])) v('S3-3', ...at(d), `${d.selector} { ${d.prop} } — ${m[1]} 는 tokens.css에 없음`);
  }
  if (d.prop.startsWith('--') && !tokens.has(d.prop)) v('S3-3', ...at(d), `${d.selector} — 로컬 커스텀 속성 ${d.prop} 선언`);
}

// S3-4 box-shadow
const shadowOk = new Set(g.boxShadow.allowed);
for (const d of decls.filter((d) => d.prop === 'box-shadow')) {
  const parts = d.value.split(/,(?![^(]*\))/).map((s) => s.trim());
  const ok = d.value.trim() === 'none' || parts.every((p) => {
    const m = p.match(/^var\(\s*(--[\w-]+)\s*\)$/);
    return m && shadowOk.has(m[1]);
  });
  if (!ok) v('S3-4', ...at(d), `${d.selector} { box-shadow: ${d.value} }`);
}
// box-shadow 말고 다른 속성으로 그리는 그림자
for (const d of decls) {
  const f = g.boxShadow.alsoForbid.find((x) => x.prop === d.prop && (x.contains ? d.value.includes(x.contains) : d.value.trim() !== 'none'));
  if (f) v('S3-4', ...at(d), `${d.selector} { ${d.prop}: ${d.value} } — box-shadow 토큰 외 그림자`);
}

// 셀렉터가 허용 목록 중 하나를 포함하는지 (쉼표로 나뉜 셀렉터는 각각 검사)
function selectorAllowed(selector, allowed) {
  const pats = allowed.map((a) => a.endsWith('-*')
    ? new RegExp(`${a.slice(0, -1).replace(/[.[\]]/g, '\\$&')}[\\w-]+`)
    : a);
  return selector.split(',').every((part) => {
    const s = part.replace(/["']/g, '');
    return pats.some((p) => (typeof p === 'string' ? s.includes(p) : p.test(s)));
  });
}

// S3-5 brand-primary 사용 위치
for (const d of decls) {
  if (!d.value.includes(`var(${g.brandPrimary.tokenPrefix}`)) continue;
  if (!selectorAllowed(d.selector, g.brandPrimary.allowedSelectors)) v('S3-5', ...at(d), `${d.selector} { ${d.prop}: ${d.value} }`);
}

// S3-6 dashed 보더 위치
for (const d of decls) {
  if (!/^(border|outline)(-(top|right|bottom|left))?(-style)?$/.test(d.prop) || !/\bdashed\b/.test(d.value)) continue;
  if (!selectorAllowed(d.selector, g.dashedBorder.allowedSelectors)) v('S3-6', ...at(d), `${d.selector} { ${d.prop}: ${d.value} }`);
}

// S3-7 컴포넌트 이름
const compAttr = g.componentNames.attribute;
const compOk = new Set(g.componentNames.allowed);
for (const n of elements(root, (n) => compAttr in n.attrs)) {
  if (!compOk.has(n.attrs[compAttr])) v('S3-7', htmlFile, n.line, `${compAttr}="${n.attrs[compAttr]}" 는 허용 목록에 없음`);
}

// ★ S3-8 / S3-9 forecast·actual 분리
const fa = g.forecastActual;
const kindEls = (k) => elements(root, (n) => n.attrs[fa.attribute] === k);
const forecast = kindEls('forecast');
const actual = kindEls('actual');
const sectionOf = (n) => ancestors(n).find((a) => a.tag === 'section' || 'data-section' in a.attrs) || null;
const fSections = new Set(forecast.map(sectionOf));
for (const a of actual) {
  if (fSections.has(sectionOf(a))) v('S3-8', htmlFile, a.line, 'actual 요소가 forecast 요소와 같은 섹션에 있음');
}
const classes = (n) => (n.attrs.class || '').split(/\s+/).filter(Boolean);
const fClasses = new Set(forecast.flatMap(classes));
for (const a of actual) {
  const shared = classes(a).filter((c) => fClasses.has(c));
  if (shared.length) v('S3-8', htmlFile, a.line, `forecast와 같은 클래스 사용: ${shared.join(', ')}`);
}
for (const [kind, label] of Object.entries(fa.values)) {
  for (const n of kindEls(kind)) {
    if (!new RegExp(`\\b${label}\\b`, 'i').test(textContent(n))) v('S3-9', htmlFile, n.line, `${fa.attribute}="${kind}" 요소에 "${label}" 라벨 없음`);
  }
}

// ★ S3-10 production·content 분리
const pc = g.productionContent;
const secEls = (k) => elements(root, (n) => n.attrs[pc.attribute] === k);
const [pName, cName] = pc.values;
for (const p of secEls(pName)) {
  for (const c of secEls(cName)) {
    if (contains(p, c) || contains(c, p)) v('S3-10', htmlFile, Math.max(p.line, c.line), `${pName}와 ${cName} 섹션이 중첩됨`);
  }
}

// S3-11 ★ 조건에 필요한 속성이 화면에 있는지 (requiredOnScreens)
const req = g.requiredOnScreens[args.screen] || {};
for (const [attr, values] of Object.entries(req)) {
  for (const val of values) {
    if (!elements(root, (n) => n.attrs[attr] === val).length) v('S3-11', htmlFile, null, `${attr}="${val}" 요소가 없음`);
  }
}

// ---------- 렌더 값 판정 (S3-12 ~ S3-15) ----------
const values = loadTokenValues(rules);
const px = (s) => parseFloat(s);
const measured = renderMeasure(rules, path.join(args.run, htmlFile));
if (measured.error) v('S3-render', htmlFile, null, measured.error);
const els = measured.elements || [];
const label = (e) => `<${e.tag}${e.comp ? ` data-component="${e.comp}"` : ''}> "${e.label}"`;

// S3-12 Figma 골격 치수
const L = rules.layout;
if (!measured.error) {
  const nav = els.filter((e) => e.comp === L.nav.component);
  if (!nav.length) v('S3-12', htmlFile, null, `${L.nav.component} 가 없음`);
  for (const e of nav) if (e.w !== L.nav.width) v('S3-12', htmlFile, null, `${label(e)} 폭 ${e.w} ≠ ${L.nav.width}`);
  const top = els.filter((e) => e.comp === L.topBar.component);
  if (!top.length) v('S3-12', htmlFile, null, `${L.topBar.component} 가 없음`);
  for (const e of top) if (e.h !== L.topBar.height) v('S3-12', htmlFile, null, `${label(e)} 높이 ${e.h} ≠ ${L.topBar.height}`);
  const pad = px(values.get(L.mainPadding));
  for (const e of els.filter((e) => e.tag === 'main')) {
    if (px(e.padding[0]) !== pad || px(e.padding[3]) !== pad) v('S3-12', htmlFile, null, `<main> padding ${e.padding[0]} / ${e.padding[3]} ≠ ${L.mainPadding}(${pad}px)`);
  }
}

// S3-12 filter bar — Segmented Control(화면 전환)과 Filter / Select(기간)를 함께 담은 부모
if (!measured.error) {
  const seg = els.filter((e) => e.comp === L.screenSwitch);
  const sel = els.filter((e) => e.comp === rules.period.control);
  const bar = seg.map((e) => els[e.p]).find((b) => b && sel.some((f) => f.p === b.i));
  if (!bar) v('S3-12', htmlFile, null, `filter bar 없음 — ${L.screenSwitch}와 ${rules.period.control}를 같은 부모에 둬야 함`);
  else {
    const fb = L.filterBar;
    if (bar.h !== fb.height) v('S3-12', htmlFile, null, `filter bar 높이 ${bar.h} ≠ ${fb.height}`);
    const s0 = seg.find((e) => e.p === bar.i);
    const fs = sel.filter((e) => e.p === bar.i).sort((a, b) => a.x - b.x);
    const toFilter = px(values.get(fb.segmentedToFilter));
    const firstGap = fs[0].x - (s0.x + s0.w);
    if (firstGap !== toFilter) v('S3-12', htmlFile, null, `Segmented Control → Filter 간격 ${firstGap} ≠ ${fb.segmentedToFilter}(${toFilter}px)`);
    const filterGap = px(values.get(fb.filterGap));
    for (let k = 1; k < fs.length; k++) {
      const gap = fs[k].x - (fs[k - 1].x + fs[k - 1].w);
      if (gap !== filterGap) v('S3-12', htmlFile, null, `Filter 사이 간격 ${gap} ≠ ${fb.filterGap}(${filterGap}px)`);
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
    if (px(g.columnGap) !== colGap) v('S3-12', htmlFile, null, `카드 그리드 ${label(g)} 가로 간격 ${g.columnGap} ≠ ${cg.columnGap}(${colGap}px)`);
    if (px(g.rowGap) !== rowGap) v('S3-12', htmlFile, null, `카드 그리드 ${label(g)} 세로 간격 ${g.rowGap} ≠ ${cg.rowGap}(${rowGap}px)`);
  }
}

// S3-13 radius는 토큰 값만
const radiusOk = new Set(tokenValuesByPrefix(values, g.radius.tokenPrefix).map(px));
for (const e of els) {
  const bad = [...new Set(e.radius)].filter((r) => !(r.endsWith('px') && radiusOk.has(px(r))));
  if (bad.length) v('S3-13', htmlFile, null, `${label(e)} border-radius ${bad.join(' ')} 는 radius 토큰 값이 아님`);
}

// S3-14 타이포그래피 — 글자를 직접 가진 요소만
const T = g.typography;
const sizeOk = new Set(tokenValuesByPrefix(values, T.sizeTokenPrefix).map(px));
const familyOk = new Set(tokenValuesByPrefix(values, T.familyTokenPrefix).map((f) => f.split(',')[0].replace(/["']/g, '').trim()));
for (const e of els.filter((e) => e.own)) {
  if (!sizeOk.has(px(e.fontSize))) v('S3-14', htmlFile, null, `${label(e)} font-size ${e.fontSize} 는 토큰 값이 아님`);
  if (!T.fontWeights.includes(Number(e.fontWeight))) v('S3-14', htmlFile, null, `${label(e)} font-weight ${e.fontWeight}`);
  const fam = e.fontFamily.split(',')[0].replace(/["']/g, '').trim();
  if (!familyOk.has(fam)) v('S3-14', htmlFile, null, `${label(e)} font-family ${fam}`);
}

// S3-15 컨트롤 크기
const C = g.controls;
const iconRadius = px(values.get(C.iconButton.radius));
for (const e of els.filter((e) => e.tag === 'button' && e.text === '')) { // 글자 없는 버튼 = 아이콘 전용
  if (e.w !== C.iconButton.size || e.h !== C.iconButton.size) v('S3-15', htmlFile, null, `아이콘 버튼 ${label(e)} ${e.w}×${e.h} ≠ ${C.iconButton.size}×${C.iconButton.size}`);
  if (e.radius.some((r) => px(r) !== iconRadius)) v('S3-15', htmlFile, null, `아이콘 버튼 ${label(e)} radius ${e.radius[0]} ≠ ${C.iconButton.radius}`);
}
for (const e of els.filter((e) => (e.tag === 'input' && !C.inputExcludeTypes.includes(e.type)) || e.tag === 'select')) {
  if (!C.inputHeights.includes(e.h)) v('S3-15', htmlFile, null, `${label(e)} 높이 ${e.h} (허용 ${C.inputHeights.join('/')})`);
}

// design.md 사본 드리프트 — 경고만
const warnings = [];
const orig = readIfExists(path.join(REPO, rules.sources.design));
const copy = readIfExists(path.join(REPO, g.designCopyDrift.copy));
if (copy !== null && orig !== copy) warnings.push(`${g.designCopyDrift.copy} 가 원본 ${rules.sources.design} 과 다름`);

finish({ stage: 'S3', args, violations, warnings });
