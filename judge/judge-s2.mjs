// S2 Spec 판정 — docs/gates.md S2
import path from 'node:path';
import { loadRules, parseArgs, readIfExists, finish, fail } from './lib.mjs';
import { textHas } from './structure.mjs';

const args = parseArgs(process.argv.slice(2));
const rules = loadRules();
const file = rules.gates.S2.file;
const md = readIfExists(path.join(args.run, file));
if (md === null) fail('S2', args, 'S2-format', file, '파일이 없음');

const found = (item) => textHas(md, item);

const violations = [];
const v = (rule, detail) => violations.push({ rule, file, line: null, detail });
const screen = rules.screens[args.screen];

for (const m of screen.metrics) if (!found(m)) v('S2-1', `지표 "${m.name}" 없음`);
for (const p of rules.period.options) if (!found(p)) v('S2-2', `기간 옵션 "${p.name}" 없음`);
for (const a of screen.actions) if (!found(a)) v('S2-3', `액션 "${a.name}" 없음`);

finish({ stage: 'S2', args, violations });
