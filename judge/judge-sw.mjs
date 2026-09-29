// SW 와이어프레임 판정 — docs/gates.md SW. 회색 박스 수준인지와 구조만 센다. 토큰·px·폰트는 세지 않는다.
import path from 'node:path';
import {
  loadRules, parseArgs, readIfExists, finish, fail, loadTokenValues, renderMeasure, parseHtml, visibleTexts,
} from './lib.mjs';
import { checkStructure, checkSkeleton, textHas } from './structure.mjs';

const args = parseArgs(process.argv.slice(2));
const rules = loadRules();
const g = rules.gates.SW;
const file = g.file;
const html = readIfExists(path.join(args.run, file));
if (html === null) fail('SW', args, 'SW-format', file, '파일이 없음');

const violations = [];
const v = (rule, line, detail) => violations.push({ rule, file, line, detail });
const { root } = parseHtml(html);

const measured = renderMeasure(rules, path.join(args.run, file));
if (measured.error) v('SW-render', null, measured.error);
const els = measured.elements || [];
const label = (e) => `<${e.tag}${e.comp ? ` data-component="${e.comp}"` : ''}> "${e.label}"`;

// SW-1 회색만 — 계산된 색의 R·G·B가 같아야 한다 (완전 투명은 제외)
const isGray = (c) => {
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return true;
  const [r, gg, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return Number(a) === 0 || (r === gg && gg === b);
};
for (const e of els) {
  for (const [what, c] of [['글자', e.color], ['배경', e.background], ...e.borders.map((b) => ['보더', b])]) {
    if (!isGray(c)) v('SW-1', null, `${label(e)} ${what} 색 ${c} — 회색이 아님`);
  }
}

// SW-2 이미지·그림자 없음
for (const e of els) {
  if (e.tag === 'img') v('SW-2', null, `${label(e)} 이미지`);
  if (e.bgImage && e.bgImage !== 'none') v('SW-2', null, `${label(e)} 배경 이미지 ${e.bgImage.slice(0, 60)}`);
  if (e.boxShadow && e.boxShadow !== 'none') v('SW-2', null, `${label(e)} 그림자`);
}

// SW-3 PRD 지표·기간·액션 이름이 화면 글자로 보여야 한다
const text = visibleTexts(root).join('\n');
const screen = rules.screens[args.screen];
for (const m of screen.metrics) if (!textHas(text, m)) v('SW-3', null, `지표 "${m.name}" 가 화면에 없음`);
for (const p of rules.period.options) if (!textHas(text, p)) v('SW-3', null, `기간 옵션 "${p.name}" 가 화면에 없음`);
for (const a of screen.actions) if (!textHas(text, a)) v('SW-3', null, `액션 "${a.name}" 가 화면에 없음`);

// SW-4 골격 — S3-12와 같은 코드
if (!measured.error) for (const d of checkSkeleton(rules, els, loadTokenValues(rules))) v('SW-4', null, d);

// ★ SW-5 구조 — S3-8 ~ S3-11과 같은 코드
for (const x of checkStructure(rules, root, args.screen)) v('SW-5', x.line, `[${x.id}] ${x.detail}`);

finish({ stage: 'SW', args, violations });
