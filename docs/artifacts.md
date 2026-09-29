# artifacts — 산출물 (R4)

출처 표시: `[사용자]` · `[기본값 승인]` · `[임의]` — [purpose.md](purpose.md)와 같다.
이 라운드의 값은 전부 `[기본값 승인]`이다.

## 1. 단계별 산출물

화면마다 `harness/runs/<화면>/` 폴더 하나를 쓴다.
`<화면>` = `production-status` | `content-overview` | `paid-performance`

단계별 파일은 R6에서 정한 대로 단계 폴더(`s1/` ~ `s4/`) 안에 둔다.

| 단계 | 파일 | 쓰는 주체 |
|---|---|---|
| S1 | `s1/s1-reference.md` | S1 에이전트 |
| S2 | `s2/s2-spec.md` | S2 에이전트 |
| S3 | `s3/s3-screen.html`, `s3/s3-screen.css` | S3 에이전트 |
| S4 | `s4/s4-figma.json` — Figma 파일 키 · 노드 ID · 컴포넌트 매핑 | S4 에이전트 |
| S4 | `s4/s4-compare.json` — HTML↔Figma 대조 결과 | 판정 스크립트 |
| 판정 | `verdict-s3.json`, `verdict-s4.json` | 판정 스크립트 |
| 상태 | `state.json` | `judge/run-stage.mjs` |

**Figma 저장 위치**
- 파일: `IwmNcXuHeFy7fmv5uhQdwa` (레퍼런스가 있는 파일)
- 페이지: 새 페이지 **"Analytics"**
- 프레임: 화면마다 1개, 1920 × 1162

## 2. 규칙 SSOT (P2, P4)

- **`harness/rules.json`** 한 파일에만 규칙을 둔다.
- 값은 토큰 이름으로 적고, 실제 px·hex는 `tokens/tokens.css`에서 읽는다. (R0)
  - 예: `"spacing.allowed": "tokens:--spacing-*"`, `"radius.structure": ["--radius-lg", "--radius-xl"]`
- 초안 `default-design.md`, `default-layout.md`, `gates.md`는 R5 승인 뒤 `rules.json`으로 합치고 삭제한다.

## 3. 재개 (P8)

`runs/<화면>/state.json`

```json
{
  "screen": "content-overview",
  "stage": "S3",
  "passed": ["S1", "S2"],
  "attempts": { "S2": 1, "S3": 2, "S4": 0 },
  "lastVerdict": "verdict-s3.json"
}
```

- 다시 실행하면 `passed`의 마지막 단계 다음부터 시작한다.
- `attempts`는 이어서 센다. 한도는 [pipeline.md](pipeline.md) 3절을 따른다.
- 이 파일은 `judge/run-stage.mjs`만 쓴다. 시도 횟수와 한도를 LLM이 아니라 스크립트가 센다. (개선 4)
- 한도에 걸리면 `"halted": { "stage", "reason" }`가 기록되고, 같은 단계를 다시 불러도 판정을 돌리지 않는다.

## 4. 기준 문서 위치 (P3)

| 문서 | 경로 |
|---|---|
| 목적 · 파이프라인 · 산출물 | `harness/docs/purpose.md`, `pipeline.md`, `artifacts.md` |
| PRD | `harness/docs/prd.md` |
| 유저스토리 (판정 기준) | `harness/docs/story-service.md` |
| 작업 흐름 | `harness/docs/story-work.md` |
| 디자인 기준 | `components/ai-social-media/design.md` (저장소 공용, 이동 안 함) |
| 토큰 | `tokens/tokens.css` (저장소 공용, 이동 안 함) |
| Figma 골격 | `harness/reference/figma-reference.md` |

`docs/README.md`에 이 경로 목록을 둔다.
