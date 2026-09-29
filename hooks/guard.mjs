// PreToolUse hook — docs/roles.md 쓰기 권한을 강제한다 (P5, P6).
// 막을 때는 exit 2 + stderr 메시지. 그 외에는 exit 0.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const HARNESS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UNLOCK = path.join(HARNESS, '.rules-unlock'); // 사람이 직접 만들면 rules.json 편집 허용

const AGENT_FOLDERS = {
  's1-reference': /^runs\/[\w-]+\/s1\//,
  's2-spec': /^runs\/[\w-]+\/s2\//,
  's3-html': /^runs\/[\w-]+\/s3\//,
  's4-figma': /^runs\/[\w-]+\/s4\/s4-figma\.json$/,
  judge: null, // 파일을 쓰지 않는다. verdict는 스크립트가 쓴다.
};
const PROTECTED = [
  { re: /^rules\.json$/, who: '사람', unlockable: true },
  { re: /^\.rules-unlock$/, who: '사람' },
  { re: /^runs\/[\w-]+\/approval\.md$/, who: '사람' },
  { re: /^runs\/[\w-]+\/verdict-s\d\.json$/, who: '판정 스크립트' },
  { re: /^runs\/[\w-]+\/s4\/s4-compare\.json$/, who: '판정 스크립트' },
  { re: /^runs\/[\w-]+\/state\.json$/, who: 'judge/run-stage.mjs' },
];

const input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
const tool = input.tool_name;
const ti = input.tool_input || {};
const agent = input.agent_type ?? input.agent_name ?? input.subagent_type ?? null;
const isHarnessAgent = agent !== null && agent in AGENT_FOLDERS;

function block(msg) {
  process.stderr.write(`[harness guard] ${msg}\n`);
  process.exit(2);
}

function checkPath(file) {
  const abs = path.resolve(input.cwd || process.cwd(), file);
  const rel = path.relative(HARNESS, abs).split(path.sep).join('/');
  const inside = !rel.startsWith('..') && !path.isAbsolute(rel);

  if (isHarnessAgent && !inside) block(`${agent} 는 하네스 밖(${file})에 쓸 수 없다.`);
  if (!inside) return;

  for (const p of PROTECTED) {
    if (!p.re.test(rel)) continue;
    if (p.unlockable && fs.existsSync(UNLOCK)) return;
    block(`${rel} 은 ${p.who}만 쓴다 (docs/roles.md 2절).`);
  }
  if (isHarnessAgent) {
    const allowed = AGENT_FOLDERS[agent];
    if (!allowed || !allowed.test(rel)) block(`${agent} 는 ${rel} 에 쓸 수 없다 (docs/roles.md 1절).`);
  }
}

if (['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
  checkPath(ti.file_path || ti.notebook_path || '');
}

if (tool === 'Bash') {
  const cmd = String(ti.command || '');
  const isJudgeRun = /^\s*node\s+\S*judge\/(judge-s\d|check-approval|run-stage|selftest)\.mjs(\s|$)/.test(cmd) && !/[;&|`$><]/.test(cmd);
  if (agent === 'judge' && !isJudgeRun) block('judge 는 node judge/*.mjs 실행만 할 수 있다.');
  if (!isJudgeRun && /(rules\.json|\.rules-unlock|approval\.md|verdict-s\d\.json|s4-compare\.json|state\.json)/.test(cmd) &&
      /(>|\btee\b|\bcp\b|\bmv\b|\brm\b|\bsed\s+-i|\btouch\b|writeFile|open\([^)]*['"]w)/.test(cmd)) {
    block('보호 파일(rules.json, approval.md, verdict, s4-compare, state)을 셸로 바꿀 수 없다.');
  }
}

process.exit(0);
