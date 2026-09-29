// 단계 실행기 — 판정 실행, 시도 횟수, 한도, state.json 갱신을 스크립트가 맡는다 (P1, P8).
// 오케스트레이터는 이 스크립트의 exit code만 보고 다음 행동을 정한다.
//   node run-stage.mjs <화면> <S1|S2|S3|S4> [--run <dir>] [--figma-json <file>]
// exit: 0 통과 · 1 실패(재시도 가능) · 3 한도 초과(멈추고 사람에게) · 4 선행 조건 미충족(이전 단계·승인) · 2 오류
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadRules, parseArgs } from './lib.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ORDER = ['S1', 'S2', 'S3', 'S4'];
const raw = process.argv.slice(2);
const stage = raw.find((a) => ORDER.includes(a));
if (!stage) { console.error(`stage must be one of: ${ORDER.join(', ')}`); process.exit(2); }
const args = parseArgs(raw.filter((a) => a !== stage));
const rules = loadRules();
const stateFile = path.join(args.run, 'state.json');

const state = fs.existsSync(stateFile)
  ? JSON.parse(fs.readFileSync(stateFile, 'utf8'))
  : { screen: args.screen, stage: 'S1', passed: [], attempts: {}, lastVerdict: null, halted: null };

function save() {
  fs.mkdirSync(args.run, { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n');
}
function exit(code, message) {
  console.log(JSON.stringify({ screen: args.screen, stage, code, message, state }, null, 2));
  process.exit(code);
}

// 선행 조건: 앞 단계가 모두 통과
const idx = ORDER.indexOf(stage);
const missing = ORDER.slice(0, idx).filter((s) => !state.passed.includes(s));
if (missing.length) exit(4, `이전 단계 미통과: ${missing.join(', ')}`);

// S3부터는 사람 승인이 있어야 한다
if (idx >= 2) {
  const r = spawnSync(process.execPath, [path.join(DIR, 'check-approval.mjs'), args.screen, '--run', args.run], { encoding: 'utf8' });
  if (r.status !== 0) exit(4, `승인 대기: ${JSON.parse(r.stdout || '{}').missing?.join(', ') ?? r.stderr}`);
}

// 한도
const limit = rules.retry[stage] ?? null;
const used = state.attempts[stage] || 0;
if (limit !== null && used >= limit) {
  state.halted = { stage, reason: `${stage} 시도 ${used}/${limit}회 — 한도 초과` };
  save();
  exit(3, state.halted.reason);
}

// 판정 실행
const judgeArgs = [path.join(DIR, `judge-${stage.toLowerCase()}.mjs`), args.screen, '--run', args.run];
if (args.figmaJson) judgeArgs.push('--figma-json', args.figmaJson);
const r = spawnSync(process.execPath, judgeArgs, { encoding: 'utf8' });
if (r.status !== 0 && r.status !== 1) exit(2, `판정 스크립트 오류: ${r.stderr.trim()}`);

// 다시 도는 단계면 그 단계와 뒤 단계의 통과 기록을 지운다
state.passed = state.passed.filter((s) => ORDER.indexOf(s) < idx);
state.attempts[stage] = used + 1;
state.lastVerdict = `verdict-${stage.toLowerCase()}.json`;
state.halted = null;

if (r.status === 0) {
  state.passed.push(stage);
  state.stage = ORDER[idx + 1] ?? 'done';
  save();
  exit(0, `${stage} 통과`);
}

state.stage = stage;
if (limit !== null && state.attempts[stage] >= limit) {
  state.halted = { stage, reason: `${stage} 시도 ${state.attempts[stage]}/${limit}회 — 한도 초과` };
  save();
  exit(3, state.halted.reason);
}
save();
exit(1, `${stage} 실패 (${state.attempts[stage]}/${limit ?? '∞'})`);
