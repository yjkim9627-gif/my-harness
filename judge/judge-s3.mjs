// S3 HTML 판정 — docs/gates.md S3. 모든 항목이 0건이면 통과.
import path from 'node:path';
import {
  loadRules, parseArgs, readIfExists, finish, fail, loadTokenNames, sourceWarnings,
  loadTokenValues, tokenValuesByPrefix, CSS_NAMED_COLORS, renderMeasure,
  parseCss, parseHtml, elements,
} from './lib.mjs';
import { checkStructure, checkSkeleton, structureSequence } from './structure.mjs';

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

// ★ S3-8 ~ S3-11 구조 (Forecast/Actual, Production/Content) — SW와 같은 코드
for (const x of checkStructure(rules, root, args.screen)) v(x.id, htmlFile, x.line, x.detail);

// ---------- 렌더 값 판정 (S3-12 ~ S3-15) ----------
const values = loadTokenValues(rules);
const px = (s) => parseFloat(s);
const measured = renderMeasure(rules, path.join(args.run, htmlFile));
if (measured.error) v('S3-render', htmlFile, null, measured.error);
const els = measured.elements || [];
const label = (e) => `<${e.tag}${e.comp ? ` data-component="${e.comp}"` : ''}> "${e.label}"`;

// S3-12 Figma 골격 치수 — SW와 같은 코드
if (!measured.error) for (const d of checkSkeleton(rules, els, values)) v('S3-12', htmlFile, null, d);

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

// S3-16 승인된 와이어프레임과 구조 순서가 같은지 — 와이어프레임의 placeholder 자리는 어떤 컴포넌트든 허용
const swHtml = readIfExists(path.join(args.run, rules.gates.SW.file));
if (swHtml === null) v('S3-16', rules.gates.SW.file, null, '와이어프레임이 없음');
else {
  const want = structureSequence(rules, parseHtml(swHtml).root);
  const got = structureSequence(rules, root);
  const same = (w, g2) => w === g2 || (w.startsWith('placeholder:') && g2.startsWith('component:'));
  const n = Math.max(want.length, got.length);
  for (let k = 0; k < n; k++) {
    if (!want[k] || !got[k] || !same(want[k], got[k])) {
      v('S3-16', htmlFile, null, `구조 ${k + 1}번째: 와이어프레임 ${want[k] ?? '(없음)'} ↔ HTML ${got[k] ?? '(없음)'}`);
      break; // 첫 차이만 보고한다 — 뒤는 밀려서 전부 달라진다
    }
  }
}

// 원본과 vendor 사본 드리프트 — 경고만
const warnings = sourceWarnings(rules);

finish({ stage: 'S3', args, violations, warnings });
