// 판정 스크립트 자체 검증 — docs/verification.md ①
// 1부: 규칙을 전부 지킨 base 예제는 통과하고, 규칙마다 일부러 어긴 예제는 정확히 그 규칙으로만 실패해야 한다.
// 2부: 승인 해시와 단계 실행기(run-stage)의 한도·선행 조건이 기계적으로 지켜지는지 확인한다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.join(DIR, 'fixtures', 'base');
const FIGMA = path.join(BASE, 'figma-node.json');

const HTML = 's3/s3-screen.html';
const CSS = 's3/s3-screen.css';
const S1 = 's1/s1-reference.md';
const S2 = 's2/s2-spec.md';
const doc = (j) => j.nodes['10:1'].document;
const body = (j) => doc(j).children.find((c) => c.id === '10:5');
const CO = 'content-overview';

// [이름, 단계, 화면, 기대 실패 규칙, 변형]
const cases = [
  ['S1 base', 'S1', CO, [], {}],
  ['S1-1 개수', 'S1', CO, ['S1-1'], { [S1]: [[/,\n\s*\{ "ui_url": "https:\/\/uibowl.io\/c"[^\n]*/, '']] }],
  ['S1-2 ui_url 없음', 'S1', CO, ['S1-2'], { [S1]: [['"ui_url": "https://uibowl.io/a"', '"ui_url": ""']] }],
  ['S1-3 금지 패턴 채택', 'S1', CO, ['S1-3'], { [S1]: [['"what": "KPI row", "patterns": []', '"what": "KPI row", "patterns": ["brand-primary-filled-button"]']] }],

  ['S2 base', 'S2', 'production-status', [], {}],
  ['S2-1 지표 누락', 'S2', 'production-status', ['S2-1'], { [S2]: [['- Compute spend', '- 비용']] }],
  ['S2-2 기간 누락', 'S2', 'production-status', ['S2-2'], { [S2]: [[' / Custom', '']] }],
  ['S2-3 액션 누락', 'S2', 'production-status', ['S2-3'], { [S2]: [['Retry, ', '']] }],

  ['S3 base', 'S3', CO, [], {}],
  ['S3-1 raw hex', 'S3', CO, ['S3-1'], { [CSS]: [['.main { padding: var(--spacing-2xl); background: var(--color-neutral-0); }', '.main { padding: var(--spacing-2xl); background: #ffffff; }']] }],
  ['S3-1 var fallback hex', 'S3', CO, ['S3-1'], { [CSS]: [['background: var(--color-neutral-100)', 'background: var(--color-neutral-100, #fff)']] }],
  ['S3-1 inline rgb', 'S3', CO, ['S3-1'], { [HTML]: [['<div class="popover">', '<div class="popover" style="color: rgb(0,0,0)">']] }],
  ['S3-1 hsl', 'S3', CO, ['S3-1'], { [CSS]: [['.popover {', '.popover { color: hsl(0 0% 0%);']] }],
  ['S3-1 색 이름', 'S3', CO, ['S3-1'], { [CSS]: [['.popover {', '.popover { color: white;']] }],
  ['S3-2 raw px', 'S3', CO, ['S3-2'], { [CSS]: [['.section { border-top', '.section { padding: 24px; border-top']] }],
  ['S3-2 rem 우회', 'S3', CO, ['S3-2'], { [CSS]: [['.section { border-top', '.section { padding: 1.5rem; border-top']] }],
  ['S3-2 vw 우회', 'S3', CO, ['S3-2'], { [CSS]: [['.section { border-top', '.section { margin-left: 2vw; border-top']] }],
  ['S3-2 1px padding', 'S3', CO, ['S3-2'], { [CSS]: [['.section { border-top', '.section { padding: 1px; border-top']] }],
  ['S3-3 없는 토큰', 'S3', CO, ['S3-3'], { [CSS]: [['margin-top: var(--spacing-3xl)', 'margin-top: var(--spacing-huge)']] }],
  ['S3-3 로컬 커스텀 속성', 'S3', CO, ['S3-3'], { [CSS]: [['.popover {', '.popover { --gap: var(--spacing-sm);']] }],
  ['S3-4 허용 안 된 그림자', 'S3', CO, ['S3-4'], { [CSS]: [['var(--shadow-popover)', 'var(--shadow-md)']] }],
  ['S3-4 drop-shadow 우회', 'S3', CO, ['S3-4'], { [CSS]: [['.popover {', '.popover { filter: drop-shadow(var(--shadow-md));']] }],
  ['S3-4 text-shadow', 'S3', CO, ['S3-4'], { [CSS]: [['.popover {', '.popover { text-shadow: var(--shadow-md);']] }],
  ['S3-5 brand-primary 위치', 'S3', CO, ['S3-5'], { [CSS]: [['.cta-link {', '.link {']] }],
  ['S3-6 dashed 위치', 'S3', CO, ['S3-6'], { [CSS]: [['.empty-slot {', '.card-slot {']] }],
  ['S3-7 컴포넌트 이름', 'S3', CO, ['S3-7', 'S3-12'], { [HTML]: [['"Nav / Navigation"', '"Nav / Sidebar"']] }],
  ['★S3-8 같은 섹션', 'S3', CO, ['S3-8', 'S3-12'], // 그리드 없이 카드 2개 → 카드 간격도 걸림
    { [HTML]: [['<h2>Top forecast performers</h2>', '<h2>Top forecast performers</h2><article class="actual-card-2" data-kind="actual"><span>Actual</span> Reel C</article>']] }],
  ['★S3-8 같은 카드 클래스', 'S3', CO, ['S3-8'], { [HTML]: [['class="actual-card"', 'class="card actual-card"'], ['class="forecast-card"', 'class="card forecast-card"']] }],
  ['★S3-9 라벨 없음', 'S3', CO, ['S3-9'], { [HTML]: [['<span class="badge">Forecast</span>', '<span class="badge">Predicted</span>']] }],
  ['★S3-10 섹션 중첩', 'S3', CO, ['S3-10'], { [HTML]: [['<h2>Top performers</h2>', '<h2>Top performers</h2><div data-section="production">Queue</div>']] }],
  ['S3-11 forecast 없음', 'S3', CO, ['S3-11'], { [HTML]: [[' data-kind="forecast"', '']] }],
  ['S3-12 내비 없음', 'S3', CO, ['S3-12'], { [HTML]: [[' data-component="Nav / Navigation"', '']] }],
  ['S3-12 TopBar 높이', 'S3', CO, ['S3-12'], { [CSS]: [['.topbar { height: 56px; }', '.topbar { height: 64px; }']] }],
  ['S3-12 main 패딩', 'S3', CO, ['S3-12'], { [CSS]: [['padding: var(--spacing-2xl)', 'padding: var(--spacing-3xl)']] }],
  ['S3-12+2 내비 폭 263', 'S3', CO, ['S3-2', 'S3-12'], { [CSS]: [['.nav { width: 262px; }', '.nav { width: 263px; }']] }],
  ['S3-12 filter bar 없음', 'S3', CO, ['S3-12'], { [HTML]: [[' data-component="Controls / Filter / Select"', '']] }],
  ['S3-12 filter bar 높이', 'S3', CO, ['S3-12'], { [CSS]: [['height: 64px;', 'height: 56px;']] }],
  ['S3-12 세그먼트→필터 간격', 'S3', CO, ['S3-12'], { [CSS]: [['gap: var(--spacing-sm); }', 'gap: var(--spacing-md); }']] }],
  ['S3-12 필터 사이 간격', 'S3', CO, ['S3-12'], { [HTML]: [['>30일</div>', '>30일</div><div class="filter" data-component="Controls / Filter / Select">Instagram</div>']] }],
  ['필터 2개 간격 12 통과', 'S3', CO, [], { [HTML]: [['>30일</div>', '>30일</div><div class="filter" data-component="Controls / Filter / Select">Instagram</div>']], [CSS]: [['.main {', '.filter + .filter { margin-left: var(--spacing-xs); }\n.main {']] }],
  ['S3-12 카드 그리드 간격', 'S3', CO, ['S3-12'], { [HTML]: [['<article class="actual-card" data-kind="actual"><span class="label">Actual</span> Reel A</article>', '<div class="grid"><article class="actual-card" data-kind="actual"><span class="label">Actual</span> Reel A</article><article class="actual-card" data-kind="actual"><span class="label">Actual</span> Reel C</article></div>']], [CSS]: [['.main {', '.grid { display: grid; grid-template-columns: 304px 304px; gap: var(--spacing-sm); }\n.main {']] }],
  ['카드 그리드 16/24 통과', 'S3', CO, [], { [HTML]: [['<article class="actual-card" data-kind="actual"><span class="label">Actual</span> Reel A</article>', '<div class="grid"><article class="actual-card" data-kind="actual"><span class="label">Actual</span> Reel A</article><article class="actual-card" data-kind="actual"><span class="label">Actual</span> Reel C</article></div>']], [CSS]: [['.main {', '.grid { display: grid; grid-template-columns: 304px 304px; gap: var(--spacing-2xl) var(--spacing-lg); }\n.main {']] }],
  ['S3-13 radius 50%', 'S3', CO, ['S3-13'], { [CSS]: [['.forecast-card { background: var(--color-neutral-100); border-radius: var(--radius-lg); }', '.forecast-card { background: var(--color-neutral-100); border-radius: 50%; }']] }],
  ['S3-14 font-size', 'S3', CO, ['S3-14'], { [CSS]: [['h2 { font-size: var(--font-size-text-xl);', 'h2 { font-size: larger;']] }],
  ['S3-14 font-weight', 'S3', CO, ['S3-14'], { [CSS]: [['font-weight: var(--font-weight-semibold)', 'font-weight: 800']] }],
  ['S3-14 font-family', 'S3', CO, ['S3-14'], { [CSS]: [['h2 {', 'h2 { font-family: serif;']] }],
  ['S3-15 아이콘 버튼', 'S3', CO, ['S3-15'], { [HTML]: [['<div class="popover">', '<button class="icon-btn" aria-label="More"></button><div class="popover">']] }],
  ['S3-15 인풋 높이', 'S3', CO, ['S3-15'], { [HTML]: [['<div class="popover">', '<input class="field" type="text"><div class="popover">']] }],

  ['S4 base', 'S4', CO, [], {}],
  ['S4-1 직접 그린 도형', 'S4', CO, ['S4-1'], { figma: (j) => body(j).children.push({ id: '10:99', name: 'divider', type: 'RECTANGLE', fills: [{ type: 'SOLID', color: {} }], boundVariables: { fills: [{ id: 'v' }] } }) }],
  ['S4-1 로컬 컴포넌트', 'S4', CO, ['S4-1'], { figma: (j) => { j.nodes['10:1'].components.c1.remote = false; } }],
  ['S4-2 변수 미연결', 'S4', CO, ['S4-2'], { figma: (j) => { delete body(j).children.find((c) => c.id === '10:10').boundVariables; } }],
  ['S4-3 텍스트 스타일 없음', 'S4', CO, ['S4-3'], { figma: (j) => { delete body(j).children.find((c) => c.id === '10:6').styles; } }],
  ['S4-4 컴포넌트 불일치', 'S4', CO, ['S4-4'], { figma: (j) => { j.nodes['10:1'].components.c1.name = 'Nav / Sidebar'; } }],
  ['S4-5 텍스트 불일치', 'S4', CO, ['S4-5'], { figma: (j) => { body(j).children.find((c) => c.id === '10:14').characters = 'Reel X'; } }],
];

function prepare(edits = {}) {
  const run = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-selftest-'));
  fs.cpSync(BASE, run, { recursive: true });
  for (const [file, reps] of Object.entries(edits)) {
    if (file === 'figma') continue;
    const p = path.join(run, file);
    let s = fs.readFileSync(p, 'utf8');
    for (const [find, rep] of reps) {
      const next = s.replace(find, rep);
      if (next === s) throw new Error(`fixture 변형 실패: ${file} 에서 ${find} 를 찾지 못함`);
      s = next;
    }
    fs.writeFileSync(p, s);
  }
  const figma = JSON.parse(fs.readFileSync(FIGMA, 'utf8'));
  if (edits.figma) edits.figma(figma);
  const figmaPath = path.join(run, 'figma-node.json');
  fs.writeFileSync(figmaPath, JSON.stringify(figma));
  return { run, figmaPath };
}

function runNode(argv) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, argv);
    let stdout = '', stderr = '';
    p.stdout.on('data', (d) => (stdout += d));
    p.stderr.on('data', (d) => (stderr += d));
    p.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

async function runCase([name, stage, screen, expect, edits]) {
  const { run, figmaPath } = prepare(edits);
  const argv = [path.join(DIR, `judge-${stage.toLowerCase()}.mjs`), screen, '--run', run, '--no-write'];
  if (stage === 'S4') argv.push('--figma-json', figmaPath);
  const r = await runNode(argv);
  fs.rmSync(run, { recursive: true, force: true });
  let got;
  try {
    got = [...new Set(JSON.parse(r.stdout).violations.map((x) => x.rule))].sort();
  } catch {
    got = [`crash: ${r.stderr.trim().split('\n')[0]}`];
  }
  const want = [...expect].sort();
  return { name, want, got, ok: JSON.stringify(got) === JSON.stringify(want) };
}

// 렌더(Chrome)가 느려서 병렬로 돌린다
const results = [];
const queue = [...cases];
await Promise.all(Array.from({ length: 6 }, async () => {
  while (queue.length) results.push(await runCase(queue.shift()));
}));
const order = new Map(cases.map((c, i) => [c[0], i]));
results.sort((a, b) => order.get(a.name) - order.get(b.name));

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'ok  ' : 'FAIL'}  ${r.name.padEnd(24)} want [${r.want}]  got [${r.got}]`);
}

// ---------- 2부: 승인 해시 · 단계 실행기 ----------
const flow = [];
const check = (name, cond, detail) => flow.push({ name, ok: !!cond, detail });
const node = (script, ...a) => spawnSync(process.execPath, [path.join(DIR, script), ...a], { encoding: 'utf8' });
{
  const { run, figmaPath } = prepare();
  fs.rmSync(path.join(run, 'state.json'), { force: true });
  const stage = (s, screen = CO) => node('run-stage.mjs', screen, s, '--run', run, '--figma-json', figmaPath).status;
  const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(run, S2))).digest('hex');

  check('approval 없음 → 미승인', node('check-approval.mjs', CO, '--run', run).status === 1);
  fs.writeFileSync(path.join(run, 'approval.md'), `approved: yes\nstage: S2\ns2-sha256: ${hash}\n`);
  check('approval + 해시 일치 → 승인', node('check-approval.mjs', CO, '--run', run).status === 0);
  check('--print-hash 출력이 실제 해시와 같음', node('check-approval.mjs', CO, '--run', run, '--print-hash').stdout.trim() === `s2-sha256: ${hash}`);
  fs.appendFileSync(path.join(run, S2), '\n- 승인 뒤 추가된 줄\n');
  check('승인 뒤 S2 변경 → 미승인', node('check-approval.mjs', CO, '--run', run).status === 1);
  fs.writeFileSync(path.join(run, S2), fs.readFileSync(path.join(BASE, S2)));

  check('S1 없이 S2 → 4 (선행 조건)', stage('S2') === 4);
  check('S1 통과 → 0', stage('S1') === 0);
  // S2 fixture는 production-status용이라 content-overview에서는 실패한다 — 한도 확인에 쓴다
  check('S2 실패 1회 → 1', stage('S2') === 1);
  check('S2 실패 2회(한도 2) → 3', stage('S2') === 3);
  check('한도 뒤 재실행 → 3, 판정 안 돌림', stage('S2') === 3);
  const st = JSON.parse(fs.readFileSync(path.join(run, 'state.json'), 'utf8'));
  check('state.json 시도 횟수 = 2', st.attempts.S2 === 2 && st.halted?.stage === 'S2');
  fs.rmSync(run, { recursive: true, force: true });
}
{
  const { run, figmaPath } = prepare();
  const stage = (s) => node('run-stage.mjs', 'production-status', s, '--run', run, '--figma-json', figmaPath).status;
  // S1 fixture는 content-overview용 → production-status에서는 screen 불일치로 실패. state를 직접 만들 수 없으니 S2 선행만 본다.
  check('S3는 승인 없으면 4', (() => {
    fs.writeFileSync(path.join(run, 'state.json'), JSON.stringify({ screen: 'production-status', stage: 'S3', passed: ['S1', 'S2'], attempts: {}, lastVerdict: null, halted: null }));
    return stage('S3') === 4;
  })());
  fs.rmSync(run, { recursive: true, force: true });
}
for (const f of flow) {
  if (!f.ok) failed++;
  console.log(`${f.ok ? 'ok  ' : 'FAIL'}  ${f.name}`);
}

const total = results.length + flow.length;
console.log(`\n${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
