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
| [claude/](claude/settings.json) | 에이전트 5개와 hook 설정의 **배포용 사본** (아래 설치 참고) |
| [reference/](reference/figma-reference.md) | Figma 골격, design.md 사본 |
| `runs/<화면>/` | 실행 산출물 (git에 올리지 않음) |

## 설치

이 하네스는 `design-prototype` 저장소의 `prototypes/ai-social-media/analytics/harness/` 위치에 있다고 가정한다.
판정 스크립트는 저장소 루트의 `tokens/tokens.css`와 `components/ai-social-media/design.md`를 읽는다 (이 저장소에는 없음).

Claude Code는 저장소 루트의 `.claude/`만 읽으므로, `claude/`의 사본을 루트로 복사한다.

```bash
cp -R claude/agents/. ../../../../.claude/agents/
cp claude/settings.json ../../../../.claude/settings.json
```

루트 `CLAUDE.md`에 아래 안내를 추가한다.

```markdown
## 하네스

- Analytics 화면 작업("<화면> 만들어줘 / 판정해줘 / 승인했어", "하네스 상태 알려줘")은
  `prototypes/ai-social-media/analytics/harness/CLAUDE.md`를 먼저 읽고 그대로 따른다.
```

`claude/`는 사본이다. 루트 `.claude/`의 에이전트·설정을 고치면 여기에도 다시 복사해야 한다.

## 필요 환경

- Node.js 20+ (추가 패키지 없음)
- Google Chrome — S3 렌더 판정 (`rules.json gates.S3.render.chrome`)
- `FIGMA_TOKEN` 환경변수 — S4 Figma 재조회

## 검증

```bash
node judge/selftest.mjs
```

통과하지 않으면 하네스를 쓰지 않는다 (docs/verification.md).

## rules.json 고치기

hook이 Claude의 `rules.json` 편집을 막는다. 사람이 `.rules-unlock` 파일을 만들면 풀리고, 지우면 다시 잠긴다.
