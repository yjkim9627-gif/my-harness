#!/usr/bin/env bash
# Analytics 하네스 설치 — 다른 컴퓨터에서 clone한 뒤 한 번 실행한다.
#   bash setup.sh
#
# 두 가지 배치를 알아서 구분한다.
#   repo       : design-prototype/prototypes/ai-social-media/analytics/harness 에 있을 때
#                → design-prototype 루트에 .claude/ 설치, 루트 CLAUDE.md에 안내 추가, 원본 tokens·design.md 사용
#   standalone : 그 밖의 위치 (my-harness만 clone)
#                → 이 폴더에 .claude/ 설치, vendor/ 사본 사용. Claude 세션은 이 폴더에서 연다.
set -euo pipefail

HARNESS="$(cd "$(dirname "$0")" && pwd)"
REPO_PREFIX="prototypes/ai-social-media/analytics/harness"
CAND="$(cd "$HARNESS/../../../.." 2>/dev/null && pwd || true)"

if [[ -n "$CAND" && "$HARNESS" == "$CAND/$REPO_PREFIX" && -f "$CAND/tokens/tokens.css" && -f "$CAND/components/ai-social-media/design.md" ]]; then
  MODE=repo; ROOT="$CAND"; PREFIX="$REPO_PREFIX"
  TOKENS="tokens/tokens.css"; DESIGN="components/ai-social-media/design.md"
  TOKENS_HREF="../../../../../../../tokens/tokens.css"
else
  MODE=standalone; ROOT="$HARNESS"; PREFIX="."
  TOKENS="vendor/tokens.css"; DESIGN="vendor/design.md"
  TOKENS_HREF="../../../vendor/tokens.css"
fi

ok()   { printf '  ✅ %s\n' "$1"; }
warn() { printf '  ⚠️  %s\n' "$1"; }
todo=()

echo "하네스 설치 — $MODE 모드"
echo "  하네스: $HARNESS"
echo "  세션 루트: $ROOT"
echo

# 1. Node
echo "1. Node.js"
if command -v node >/dev/null 2>&1 && [[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ]]; then
  ok "node $(node -v)"
else
  warn "Node.js 20 이상이 필요함 — https://nodejs.org 에서 설치 후 다시 실행"
  exit 1
fi

# 2. Chrome (S3 렌더 판정)
echo "2. Chrome"
CHROME="${HARNESS_CHROME:-}"
if [[ -z "$CHROME" ]]; then
  for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
           "$(command -v google-chrome 2>/dev/null || true)" \
           "$(command -v chromium 2>/dev/null || true)" \
           "$(command -v chromium-browser 2>/dev/null || true)"; do
    [[ -n "$c" && -x "$c" ]] && CHROME="$c" && break
  done
fi
DEFAULT_CHROME="$(node -p "require('$HARNESS/rules.json').gates.S3.render.chrome")"
if [[ -z "$CHROME" ]]; then
  warn "Chrome을 찾지 못함 — S3 판정이 실패함"
  todo+=("Chrome 설치 후 경로가 기본값과 다르면: export HARNESS_CHROME=\"<chrome 실행 파일 경로>\"")
elif [[ "$CHROME" != "$DEFAULT_CHROME" ]]; then
  ok "$CHROME"
  export HARNESS_CHROME="$CHROME"
  todo+=("셸 설정(~/.zshrc 등)에 추가: export HARNESS_CHROME=\"$CHROME\"")
else
  ok "$CHROME"
fi

# 3. 에이전트·hook 설치 (claude/ 템플릿의 경로를 이 배치에 맞게 채운다)
echo "3. .claude/ 설치 → $ROOT/.claude"
fill() {
  sed -e "s#{{HARNESS}}#$PREFIX#g" -e "s#{{TOKENS}}#$TOKENS#g" -e "s#{{DESIGN}}#$DESIGN#g" -e "s#{{TOKENS_HREF}}#$TOKENS_HREF#g" "$1"
}
mkdir -p "$ROOT/.claude/agents"
for f in "$HARNESS"/claude/agents/*.md; do
  fill "$f" > "$ROOT/.claude/agents/$(basename "$f")"
done
ok "에이전트 $(ls "$HARNESS"/claude/agents/*.md | wc -l | tr -d ' ')개"

# settings.json: 이미 있으면 hook 항목만 합친다 (중복 추가 안 함)
fill "$HARNESS/claude/settings.json" > "$HARNESS/.settings.generated.json"
node - "$ROOT/.claude/settings.json" "$HARNESS/.settings.generated.json" <<'NODE'
const fs = require('fs');
const [target, generated] = process.argv.slice(2);
const add = JSON.parse(fs.readFileSync(generated, 'utf8'));
const cur = fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, 'utf8')) : {};
cur.hooks ??= {};
cur.hooks.PreToolUse ??= [];
for (const entry of add.hooks.PreToolUse) {
  const cmd = entry.hooks[0].command;
  if (!cur.hooks.PreToolUse.some((e) => (e.hooks || []).some((h) => h.command === cmd))) cur.hooks.PreToolUse.push(entry);
}
fs.writeFileSync(target, JSON.stringify(cur, null, 2) + '\n');
NODE
rm -f "$HARNESS/.settings.generated.json"
ok "hook (settings.json)"

# 4. 루트 CLAUDE.md 안내 (repo 모드만 — standalone은 하네스 CLAUDE.md가 곧 루트)
echo "4. 루트 CLAUDE.md"
if [[ "$MODE" == repo ]]; then
  if grep -q "$PREFIX/CLAUDE.md" "$ROOT/CLAUDE.md" 2>/dev/null; then
    ok "안내가 이미 있음"
  else
    fill "$HARNESS/claude/CLAUDE.root.md" >> "$ROOT/CLAUDE.md"
    ok "안내 추가"
  fi
else
  ok "standalone — 하네스 CLAUDE.md를 그대로 씀"
fi

# 5. 기준 파일
echo "5. 기준 파일"
ok "tokens: $TOKENS"
ok "design: $DESIGN"

# 6. selftest
echo "6. selftest"
if node "$HARNESS/judge/selftest.mjs" > "$HARNESS/.selftest.log" 2>&1; then
  ok "$(tail -1 "$HARNESS/.selftest.log")"
  rm -f "$HARNESS/.selftest.log"
else
  warn "selftest 실패 — $HARNESS/.selftest.log 확인"
  todo+=("selftest 실패 원인 해결 (대부분 Chrome 경로)")
fi

# 사람이 해야 하는 것
todo+=("S4용 Figma 토큰: export FIGMA_TOKEN=\"<Figma 개인 액세스 토큰>\"")
todo+=("Claude 앱에서 uibowl · Figma 연결(MCP) 켜기")
todo+=("Claude Code 세션을 여기서 열기: $ROOT")
echo
echo "직접 해야 할 것"
for t in "${todo[@]}"; do echo "  - $t"; done
