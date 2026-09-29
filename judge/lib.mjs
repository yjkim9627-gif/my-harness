// 판정 스크립트 공용 모듈. 규칙 값은 전부 rules.json에서 읽는다 (P2).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const HARNESS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = path.resolve(HARNESS, '../../../..');
export const SCREENS = ['production-status', 'content-overview', 'paid-performance'];

export function loadRules() {
  return JSON.parse(fs.readFileSync(path.join(HARNESS, 'rules.json'), 'utf8'));
}

// node judge-sN.mjs <screen> [--run <dir>] [--figma-json <file>] [--no-write]
export function parseArgs(argv) {
  const args = { screen: null, run: null, figmaJson: null, write: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--run') args.run = argv[++i];
    else if (a === '--figma-json') args.figmaJson = argv[++i];
    else if (a === '--no-write') args.write = false;
    else if (!args.screen) args.screen = a;
  }
  if (!SCREENS.includes(args.screen)) {
    console.error(`screen must be one of: ${SCREENS.join(', ')}`);
    process.exit(2);
  }
  args.run = path.resolve(args.run || path.join(HARNESS, 'runs', args.screen));
  return args;
}

export function readIfExists(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

export function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

// verdict: 통과/실패는 violations 개수로만 정한다 (P1).
export function finish({ stage, args, violations, warnings = [], extraFiles = {} }) {
  const verdict = {
    stage,
    screen: args.screen,
    pass: violations.length === 0,
    violationCount: violations.length,
    violations,
    warnings,
    checkedAt: new Date().toISOString(),
  };
  if (args.write) {
    fs.mkdirSync(args.run, { recursive: true });
    fs.writeFileSync(path.join(args.run, `verdict-${stage.toLowerCase()}.json`), JSON.stringify(verdict, null, 2) + '\n');
    for (const [rel, data] of Object.entries(extraFiles)) {
      const file = path.join(args.run, rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
    }
  }
  console.log(JSON.stringify(verdict, null, 2));
  process.exit(verdict.pass ? 0 : 1);
}

export function fail(stage, args, rule, file, detail) {
  finish({ stage, args, violations: [{ rule, file, line: null, detail }] });
}

// ---------- tokens ----------

export function loadTokenNames(rules) {
  const css = fs.readFileSync(path.join(REPO, rules.sources.tokens), 'utf8');
  return new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
}

// ---------- CSS ----------

// 선언 목록으로 펼친다: { selector, prop, value, line, source }
export function parseCss(text, source, lineOffset = 0) {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const decls = [];
  const stack = [];
  let start = 0;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (c === '{') {
      stack.push(clean.slice(start, i).trim());
      start = i + 1;
    } else if (c === ';' || c === '}') {
      const seg = clean.slice(start, i);
      const colon = seg.indexOf(':');
      const selector = [...stack].reverse().find((s) => !s.startsWith('@')) || '';
      if (colon > 0 && stack.length) {
        const lead = seg.length - seg.trimStart().length;
        decls.push({
          selector,
          prop: seg.slice(0, colon).trim().toLowerCase(),
          value: seg.slice(colon + 1).trim(),
          line: lineOffset + lineOf(clean, start + lead),
          source,
        });
      }
      if (c === '}') stack.pop();
      start = i + 1;
    }
  }
  return decls;
}

// ---------- HTML ----------

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

export function parseHtml(text) {
  const root = { tag: '#root', attrs: {}, children: [], parent: null, line: 1 };
  const styles = [];
  let cur = root;
  const re = /<!--[\s\S]*?-->|<!doctype[^>]*>|<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^'">])*?)(\/?)>|([^<]+)/gi;
  let m;
  while ((m = re.exec(text))) {
    const [all, close, tagRaw, attrText, selfClose, txt] = m;
    if (txt !== undefined) {
      cur.children.push({ text: txt, parent: cur, line: lineOf(text, m.index) });
      continue;
    }
    if (!tagRaw) continue;
    const tag = tagRaw.toLowerCase();
    if (close) {
      let n = cur;
      while (n !== root && n.tag !== tag) n = n.parent;
      if (n !== root) cur = n.parent;
      continue;
    }
    const node = { tag, attrs: parseAttrs(attrText), children: [], parent: cur, line: lineOf(text, m.index) };
    cur.children.push(node);
    if (tag === 'style' || tag === 'script') {
      const end = text.toLowerCase().indexOf(`</${tag}`, re.lastIndex);
      const body = text.slice(re.lastIndex, end < 0 ? text.length : end);
      if (tag === 'style') styles.push({ css: body, line: lineOf(text, re.lastIndex) - 1 });
      re.lastIndex = end < 0 ? text.length : end;
      continue;
    }
    if (!VOID.has(tag) && !selfClose) cur = node;
  }
  return { root, styles };
}

function parseAttrs(s) {
  const attrs = {};
  for (const m of s.matchAll(/([^\s=\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return attrs;
}

export function walk(node, fn) {
  for (const c of node.children || []) {
    fn(c);
    if (c.children) walk(c, fn);
  }
}

export function elements(root, pred = () => true) {
  const out = [];
  walk(root, (n) => n.tag && pred(n) && out.push(n));
  return out;
}

export function textContent(node) {
  if (node.text !== undefined) return node.text;
  if (node.tag === 'style' || node.tag === 'script') return '';
  return node.children.map(textContent).join('');
}

export function ancestors(node) {
  const out = [];
  for (let n = node.parent; n; n = n.parent) out.push(n);
  return out;
}

export function contains(a, b) {
  return ancestors(b).includes(a);
}

// 화면에 보이는 텍스트 조각 (head·script·style 제외), 공백 정리
export function visibleTexts(root) {
  const out = [];
  walk(root, (n) => {
    if (n.text === undefined) return;
    if (ancestors(n).some((a) => ['head', 'style', 'script', 'title'].includes(a.tag))) return;
    const t = n.text.replace(/\s+/g, ' ').trim();
    if (t) out.push(t);
  });
  return out;
}

// 멀티셋 차이: a에만 있는 것, b에만 있는 것
export function multisetDiff(a, b) {
  const count = new Map();
  for (const x of a) count.set(x, (count.get(x) || 0) + 1);
  for (const x of b) count.set(x, (count.get(x) || 0) - 1);
  const onlyA = [], onlyB = [];
  for (const [k, v] of count) {
    for (let i = 0; i < v; i++) onlyA.push(k);
    for (let i = 0; i < -v; i++) onlyB.push(k);
  }
  return { onlyA, onlyB };
}


// ---------- tokens: 값 ----------

// 이름 → 값. 값이 var()를 참조하면 한 단계 풀어준다.
export function loadTokenValues(rules) {
  const css = fs.readFileSync(path.join(REPO, rules.sources.tokens), 'utf8');
  const map = new Map([...css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  for (const [k, v] of map) {
    const ref = v.match(/^var\(\s*(--[\w-]+)\s*\)$/);
    if (ref && map.has(ref[1])) map.set(k, map.get(ref[1]));
  }
  return map;
}

export function tokenValuesByPrefix(values, prefix) {
  return [...values].filter(([k]) => k.startsWith(prefix)).map(([, v]) => v);
}

// CSS 색 이름 (CSS Color Module Level 4 named colors) — 언어 사실이라 rules.json이 아니라 여기 둔다.
export const CSS_NAMED_COLORS = 'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'.split(' ');

// ---------- 렌더 측정 (headless Chrome) ----------

// 실제 렌더된 계산값을 읽는다. 에이전트가 쓴 CSS가 어떤 단위·우회를 쓰든 결과 값으로 판정하기 위해서다.
export function renderMeasure(rules, htmlFile) {
  const r = rules.gates.S3.render;
  const html = fs.readFileSync(htmlFile, 'utf8');
  const baseHref = pathToFileURL(path.dirname(htmlFile) + path.sep).href;
  const tokensHref = pathToFileURL(path.join(REPO, rules.sources.tokens)).href;
  const probe = `<script>window.addEventListener('load',()=>{const out=[];const idx=new Map();
for(const e of document.body.querySelectorAll('*')){if(['SCRIPT','STYLE','LINK','TEMPLATE'].includes(e.tagName))continue;
const s=getComputedStyle(e);if(s.display==='none')continue;const b=e.getBoundingClientRect();idx.set(e,out.length);
const own=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
out.push({i:out.length,p:idx.has(e.parentElement)?idx.get(e.parentElement):-1,kind:e.getAttribute('data-kind'),
tag:e.tagName.toLowerCase(),comp:e.getAttribute('data-component'),type:(e.getAttribute('type')||'').toLowerCase(),
label:(e.getAttribute('aria-label')||e.textContent||'').trim().replace(/\\s+/g,' ').slice(0,40),own,
text:(e.textContent||'').trim(),
x:Math.round(b.left*100)/100,y:Math.round(b.top*100)/100,w:Math.round(b.width*100)/100,h:Math.round(b.height*100)/100,
columnGap:s.columnGap,rowGap:s.rowGap,
radius:[s.borderTopLeftRadius,s.borderTopRightRadius,s.borderBottomRightRadius,s.borderBottomLeftRadius],
fontSize:s.fontSize,fontWeight:s.fontWeight,fontFamily:s.fontFamily,
padding:[s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft]});}
document.documentElement.setAttribute('data-judge',btoa(unescape(encodeURIComponent(JSON.stringify(out)))));});</script>`;
  const doc = `<base href="${baseHref}"><link rel="stylesheet" href="${tokensHref}">` + html + probe;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-render-'));
  const file = path.join(tmp, 'render.html');
  fs.writeFileSync(file, doc);
  try {
    const res = spawnSync(r.chrome, [
      '--headless=new', '--disable-gpu', '--allow-file-access-from-files', '--hide-scrollbars',
      `--window-size=${r.viewport[0]},${r.viewport[1]}`, `--virtual-time-budget=${r.budgetMs}`,
      '--dump-dom', pathToFileURL(file).href,
    ], { encoding: 'utf8', timeout: r.timeoutMs });
    const m = (res.stdout || '').match(/data-judge="([^"]*)"/);
    if (!m) return { error: `렌더 실패: ${(res.stderr || res.error?.message || 'no output').trim().split('\n').pop()}` };
    return { elements: JSON.parse(Buffer.from(m[1], 'base64').toString('utf8')) };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
