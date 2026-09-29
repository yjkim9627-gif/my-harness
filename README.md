# Analytics 하네스

AI Social Media 제품의 Analytics 화면을 **S1 레퍼런스 → S2 설계 → ✋ 사람 승인 → S3 HTML → S4 Figma** 순서로 만드는 Claude Code 하네스.
통과/실패는 에이전트가 아니라 판정 스크립트가 정한다.

| 경로 | 역할 |
|---|---|
| [CLAUDE.md](CLAUDE.md) | 오케스트레이터 지시 |
| [docs/](docs/README.md) | 기준 문서 (PRD, 유저스토리, 작업 흐름, R2~R8 결정) |
| [rules.json](rules.json) | 규칙 SSOT — 판정 스크립트가 읽는 유일한 규칙 파일 (사람만 수정) |
| [judge/](judge/selftest.mjs) | `run-stage.mjs`(단계 실행기), `judge-s1~s4.mjs`, `check-approval.mjs`, `selftest.mjs` + fixtures |
| [hooks/guard.mjs](hooks/guard.mjs) | 쓰기 권한 hook |
| [claude/](claude/settings.json) | 에이전트 5개·hook 설정·루트 CLAUDE.md 안내의 **템플릿** — `setup.sh`가 설치 |
| [vendor/](vendor/design.md) | `tokens.css`, `design.md` 스냅샷 — 원본이 없는 컴퓨터에서 사용 |
| [setup.sh](setup.sh) | 설치 스크립트 |
| [reference/](reference/figma-reference.md) | Figma 골격 |
| `runs/<화면>/` | 실행 산출물 (git에 올리지 않음) |

## 설치

```bash
git clone https://github.com/yjkim9627-gif/my-harness.git
cd my-harness
bash setup.sh
```

design-prototype 안에서 쓰려면 폴더 이름까지 맞춰 clone한다: `git clone https://github.com/yjkim9627-gif/my-harness.git design-prototype/prototypes/ai-social-media/analytics/harness`

`setup.sh`가 위치를 보고 두 가지 방식 중 하나로 설치한다.

| 어디에 clone했나 | 방식 | Claude 세션을 여는 곳 | tokens·design.md |
|---|---|---|---|
| `design-prototype/prototypes/ai-social-media/analytics/harness` | repo | `design-prototype` 루트 | 원본 |
| 그 밖의 아무 곳 | standalone | 이 폴더 | `vendor/` 사본 |

하는 일: Node·Chrome 확인 → `claude/` 템플릿을 경로에 맞게 채워 `.claude/`(에이전트 5개 + hook)에 설치 → (repo 방식) 루트 `CLAUDE.md`에 안내 추가 → selftest.
여러 번 실행해도 hook·안내가 중복으로 들어가지 않는다.

**사람이 직접 해야 하는 것** — setup.sh 마지막에 다시 알려준다.
- `export FIGMA_TOKEN="…"` (S4 Figma 재조회)
- Claude 앱에서 uibowl · Figma 연결(MCP) 켜기
- Chrome 경로가 기본값과 다르면 `export HARNESS_CHROME="…"`

`claude/`는 템플릿이고 `.claude/`는 설치 결과다. 에이전트를 고칠 때는 `claude/`를 고치고 `setup.sh`를 다시 실행한다.

`vendor/tokens.css`, `vendor/design.md`는 design-prototype 원본의 스냅샷이다. 원본이 있으면 원본으로 판정하고, 둘이 다르면 판정 결과에 경고가 뜬다. 그때 사본을 다시 복사한다.

## 검증

```bash
node judge/selftest.mjs
```

통과하지 않으면 하네스를 쓰지 않는다 (docs/verification.md).

## rules.json 고치기

hook이 Claude의 `rules.json` 편집을 막는다. 사람이 `.rules-unlock` 파일을 만들면 풀리고, 지우면 다시 잠긴다.
