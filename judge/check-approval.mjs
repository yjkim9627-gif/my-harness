// 사람 승인 확인 — docs/gates.md "사람 승인". 이 스크립트는 파일을 쓰지 않는다.
// 승인한 뒤 S2 설계나 SW 와이어프레임이 바뀌면 승인이 무효가 되도록, approval.md의 해시를 현재 파일들과 대조한다.
//   node check-approval.mjs <화면>               승인 확인
//   node check-approval.mjs <화면> --print-hash  approval.md에 붙여 넣을 해시 줄 출력
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { loadRules, parseArgs, readIfExists } from './lib.mjs';

const printHash = process.argv.includes('--print-hash');
const args = parseArgs(process.argv.slice(2).filter((a) => a !== '--print-hash'));
const { required, hash } = loadRules().gates.approval;

// 승인 대상 파일들을 이름과 함께 이어 붙여 해시한다. 하나라도 없으면 null.
const missingFiles = hash.of.filter((f) => !fs.existsSync(path.join(args.run, f)));
const current = missingFiles.length ? null : (() => {
  const h = crypto.createHash('sha256');
  for (const f of hash.of) h.update(`${f}\n`).update(fs.readFileSync(path.join(args.run, f))).update('\n');
  return h.digest('hex');
})();

if (printHash) {
  if (!current) { console.error(`${missingFiles.join(', ')} 가 없음`); process.exit(2); }
  console.log(`${hash.key}: ${current}`);
  process.exit(0);
}

const md = readIfExists(path.join(args.run, 'approval.md'));
const missing = [];
if (md === null) missing.push('approval.md 없음');
else {
  for (const [k, val] of Object.entries(required)) {
    if (!new RegExp(`^\\s*${k}\\s*:\\s*${val}\\s*$`, 'mi').test(md)) missing.push(`${k}: ${val} 없음`);
  }
  const approvedHash = md.match(new RegExp(`^\\s*${hash.key}\\s*:\\s*([0-9a-f]{64})\\s*$`, 'mi'))?.[1];
  if (!approvedHash) missing.push(`${hash.key} 없음`);
  else if (!current) missing.push(`${missingFiles.join(', ')} 가 없음`);
  else if (approvedHash !== current) missing.push(`${hash.of.join(' / ')} 가 승인 뒤 바뀌었음 — 다시 승인 필요`);
}

console.log(JSON.stringify({ screen: args.screen, approved: missing.length === 0, missing }, null, 2));
process.exit(missing.length === 0 ? 0 : 1);
