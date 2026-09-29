// S4 Figma 판정 — docs/gates.md S4.
// 에이전트 보고가 아니라 Figma REST API로 다시 읽은 결과로만 판정한다 (P7).
// 테스트용: --figma-json <file> 로 REST 응답을 파일에서 읽는다.
import fs from 'node:fs';
import path from 'node:path';
import {
  loadRules, parseArgs, readIfExists, finish, fail,
  parseHtml, elements, ancestors, visibleTexts, multisetDiff,
} from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const rules = loadRules();
const g = rules.gates.S4;
const s3 = rules.gates.S3;

const metaRaw = readIfExists(path.join(args.run, g.files.figma));
if (metaRaw === null) fail('S4', args, 'S4-format', g.files.figma, '파일이 없음');
const meta = JSON.parse(metaRaw);
if (!meta.fileKey || !meta.nodeId) fail('S4', args, 'S4-format', g.files.figma, 'fileKey / nodeId 없음');

const html = readIfExists(path.join(args.run, s3.files.html));
if (html === null) fail('S4', args, 'S4-format', s3.files.html, 'S3 HTML이 없음');

async function fetchNode() {
  if (args.figmaJson) return JSON.parse(fs.readFileSync(args.figmaJson, 'utf8'));
  const token = process.env[g.api.tokenEnv];
  if (!token) fail('S4', args, 'S4-env', null, `${g.api.tokenEnv} 환경변수가 없음`);
  const url = `${g.api.base}/files/${meta.fileKey}/nodes?ids=${encodeURIComponent(meta.nodeId)}`;
  const res = await fetch(url, { headers: { 'X-Figma-Token': token } });
  if (!res.ok) fail('S4', args, 'S4-env', null, `Figma API ${res.status} ${await res.text()}`);
  return res.json();
}

const api = await fetchNode();
const entry = api.nodes?.[meta.nodeId];
if (!entry?.document) fail('S4', args, 'S4-env', null, `노드 ${meta.nodeId} 를 찾을 수 없음`);
const frame = entry.document;
const components = entry.components || {};
const componentSets = entry.componentSets || {};

// 트리 펼치기: 인스턴스 안쪽인지 함께 기록
const nodes = [];
(function visit(n, insideInstance) {
  nodes.push({ n, insideInstance });
  const inner = insideInstance || n.type === 'INSTANCE';
  for (const c of n.children || []) visit(c, inner);
})(frame, false);

const visible = (paints) => (paints || []).filter((p) => p.visible !== false && (p.opacity ?? 1) > 0);
const violations = [];
const v = (rule, node, detail) => violations.push({ rule, file: `figma:${meta.fileKey}`, line: null, node: node.id, detail: `${node.name} — ${detail}` });

for (const { n, insideInstance } of nodes) {
  if (insideInstance) continue; // 라이브러리 컴포넌트 내부는 판정하지 않는다
  const isRoot = n === frame;

  // S4-1 로컬 컴포넌트 / 분리된 컴포넌트 (레이아웃용 빈 프레임 제외)
  if (n.type === 'COMPONENT' || n.type === 'COMPONENT_SET') v('S4-1', n, '프레임 안의 로컬 컴포넌트');
  else if (n.type === 'INSTANCE' && components[n.componentId]?.remote === false) v('S4-1', n, '로컬 컴포넌트의 인스턴스');
  else if (!isRoot && n.type !== 'INSTANCE' && n.type !== 'TEXT' &&
    (visible(n.fills).length || visible(n.strokes).length || (n.effects || []).some((e) => e.visible !== false))) {
    v('S4-1', n, `${n.type} 에 직접 그린 fill/stroke/effect — 컴포넌트가 아님`);
  }

  // S4-2 변수에 연결되지 않은 fill·stroke
  for (const key of ['fills', 'strokes']) {
    const bound = n.boundVariables?.[key] || [];
    visible(n[key]).forEach((p, i) => {
      if (p.type === 'SOLID' && !bound[i] && !p.boundVariables?.color) v('S4-2', n, `${key}[${i}] 가 변수에 연결되지 않음`);
    });
  }

  // S4-3 텍스트 스타일 없는 텍스트
  if (n.type === 'TEXT' && !n.styles?.text) v('S4-3', n, '텍스트 스타일 없음');
}

// S4-4 컴포넌트 목록 대조 (가장 바깥 인스턴스 ↔ 가장 바깥 data-component)
const { root } = parseHtml(html);
const attr = s3.componentNames.attribute;
const htmlComps = elements(root, (n) => attr in n.attrs && !ancestors(n).some((a) => a.attrs && attr in a.attrs))
  .map((n) => n.attrs[attr]);
const compName = (n) => {
  const c = components[n.componentId];
  if (!c) return n.name;
  return c.componentSetId && componentSets[c.componentSetId] ? componentSets[c.componentSetId].name : c.name;
};
const figmaComps = nodes.filter(({ n, insideInstance }) => n.type === 'INSTANCE' && !insideInstance).map(({ n }) => compName(n));
const compDiff = multisetDiff(htmlComps, figmaComps);
for (const name of compDiff.onlyA) violations.push({ rule: 'S4-4', file: s3.files.html, line: null, detail: `HTML에만 있는 컴포넌트: ${name}` });
for (const name of compDiff.onlyB) violations.push({ rule: 'S4-4', file: `figma:${meta.fileKey}`, line: null, detail: `Figma에만 있는 컴포넌트: ${name}` });

// S4-5 텍스트 대조
const htmlTexts = visibleTexts(root);
const figmaTexts = nodes.filter(({ n }) => n.type === 'TEXT').map(({ n }) => (n.characters || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
const textDiff = multisetDiff(htmlTexts, figmaTexts);
for (const t of textDiff.onlyA) violations.push({ rule: 'S4-5', file: s3.files.html, line: null, detail: `HTML에만 있는 텍스트: "${t}"` });
for (const t of textDiff.onlyB) violations.push({ rule: 'S4-5', file: `figma:${meta.fileKey}`, line: null, detail: `Figma에만 있는 텍스트: "${t}"` });

const compare = {
  fileKey: meta.fileKey,
  nodeId: meta.nodeId,
  components: { html: htmlComps, figma: figmaComps, onlyHtml: compDiff.onlyA, onlyFigma: compDiff.onlyB },
  texts: { onlyHtml: textDiff.onlyA, onlyFigma: textDiff.onlyB },
};

finish({ stage: 'S4', args, violations, extraFiles: { [g.files.compare]: compare } });
