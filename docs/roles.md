# roles — 역할 (R6)

출처 표시: `[사용자]` · `[기본값 승인]` · `[임의]` — [purpose.md](purpose.md)와 같다.
이 라운드의 값은 전부 `[기본값 승인]`이다.

## 1. 작업 에이전트와 편집 폴더

각 에이전트는 **자기 폴더 하나만** 편집한다. 다른 경로에 쓰면 PreToolUse hook이 막는다.

| 에이전트 | 단계 | 편집 폴더 | 산출물 |
|---|---|---|---|
| `s1-reference` | S1 | `runs/<화면>/s1/` | `s1-reference.md` |
| `s2-spec` | S2 | `runs/<화면>/s2/` | `s2-spec.md` |
| `s3-html` | S3 | `runs/<화면>/s3/` | `s3-screen.html`, `s3-screen.css` |
| `s4-figma` | S4 | `runs/<화면>/s4/` + Figma "Analytics" 페이지 | `s4-figma.json` |

## 2. 에이전트가 직접 쓰지 않는 파일 (P6)

| 파일 | 쓰는 주체 |
|---|---|
| `rules.json` | 사람 |
| `runs/<화면>/approval.md` | 사람 |
| `runs/<화면>/verdict-*.json`, `runs/<화면>/s4/s4-compare.json` | 판정 스크립트 |
| `runs/<화면>/state.json` | `judge/run-stage.mjs` (오케스트레이터가 실행) — 개선 4 |

에이전트가 이 파일을 쓰려고 하면 hook(`hooks/guard.mjs`)이 막는다.

`rules.json`을 Claude에게 고치게 하려면 사람이 `harness/.rules-unlock` 파일을 직접 만들고, 끝나면 지운다. Claude는 이 파일을 만들 수 없다. `[임의]` — P6(사람만 rules.json)과 R8 ③(승인된 값 반영)을 함께 지키려고 추가

## 3. 읽기 전용 판정자 (P1, P7)

- **판정 스크립트:** `harness/judge/judge-s1.mjs` ~ `judge-s4.mjs`. 통과/실패는 스크립트만 정한다.
- **판정 에이전트 `judge`:** 도구는 Read, Bash뿐이다. Bash는 `node harness/judge/*.mjs` 실행만 허용한다. 결과를 요약해 의견만 내고, 판정을 바꾸지 않는다.
- **S4 Figma 재조회:** S4 스크립트가 Figma REST API로 직접 다시 읽는다. 토큰은 환경변수 `FIGMA_TOKEN`에서 읽는다. 발급·설정은 사람이 한다.

## 4. 자연어 트리거

| 말 | 동작 |
|---|---|
| "`<화면>` 만들어줘" | `state.json` 기준으로 시작하거나 이어서 진행 |
| "`<화면>` 판정해줘" | 해당 단계 판정 스크립트만 실행 |
| "`<화면>` 승인했어" | `approval.md` 확인 후 S3부터 진행 |
| "하네스 상태 알려줘" | 모든 화면의 `state.json` 요약 |

`<화면>` 인식 (한글·영문):

| slug | 인식하는 말 |
|---|---|
| `production-status` | Production Status, 프로덕션 스테이터스, 생성 상태 |
| `content-overview` | Content Overview, 콘텐츠 오버뷰, 콘텐츠 개요 |
| `paid-performance` | Paid Performance, 페이드 퍼포먼스, 광고 성과 |

한글 별칭 목록은 `[임의]`다.
