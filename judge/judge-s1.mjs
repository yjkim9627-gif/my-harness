// S1 Reference 판정 — docs/gates.md S1
import path from 'node:path';
import { loadRules, parseArgs, readIfExists, finish, fail } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const rules = loadRules();
const g = rules.gates.S1;
const file = g.format.file;
const md = readIfExists(path.join(args.run, file));
if (md === null) fail('S1', args, 'S1-format', file, '파일이 없음');

const block = md.match(/```json\s*([\s\S]*?)```/);
let data;
try {
  data = JSON.parse(block?.[1] ?? '');
} catch (e) {
  fail('S1', args, 'S1-format', file, `json 코드블록을 읽을 수 없음: ${e.message}`);
}

const refs = Array.isArray(data.references) ? data.references : [];
const violations = [];
const v = (rule, detail) => violations.push({ rule, file, line: null, detail });

const { min, max } = g.referenceCount;
if (refs.length < min || refs.length > max) v('S1-1', `레퍼런스 ${refs.length}개 (허용 ${min}~${max})`);

refs.forEach((r, i) => {
  for (const f of g.requiredFields) {
    if (!r[f] || String(r[f]).trim() === '') v('S1-2', `references[${i}].${f} 없음`);
  }
  if (r.screen && r.screen !== args.screen) v('S1-2', `references[${i}].screen="${r.screen}" ≠ ${args.screen}`);
});

const forbidden = new Set(g.forbiddenPatterns.map((p) => p.id));
refs.forEach((r, i) => {
  (r.adopt || []).forEach((a, j) => {
    for (const p of a.patterns || []) {
      if (forbidden.has(p)) v('S1-3', `references[${i}].adopt[${j}] "${a.what}" 에 금지 패턴 ${p}`);
    }
  });
});

finish({ stage: 'S1', args, violations });
