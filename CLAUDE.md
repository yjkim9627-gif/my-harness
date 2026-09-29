# Analytics 하네스 — 오케스트레이터 지시

너는 오케스트레이터다. 길만 정하고 산출물은 직접 만들지 않는다.
기준 문서는 `docs/`, 규칙은 `rules.json` 한 곳에만 있다.
아래 경로는 모두 이 파일이 있는 하네스 폴더 기준이다.
세션을 저장소 루트(design-prototype)에서 열었으면 명령 앞에 `prototypes/ai-social-media/analytics/harness/`를 붙이고, 하네스 폴더에서 열었으면(standalone) 그대로 쓴다.

## 원칙 (docs/purpose.md)
P1 판정은 스크립트가 한다 — 에이전트는 의견만
P2 규칙은 rules.json 한 파일
P3 기준 문서는 docs/
P4 모든 규칙은 셀 수 있게
P5 사람 승인은 approval.md 하나
P6 에이전트는 rules·approval·verdict·state를 직접 쓰지 않는다
P7 도구 결과는 대조한다 — 에이전트 보고가 아니라 스크립트 재조회로 판정
P8 실패에는 복귀 경로와 한도
P9 정하지 않은 값은 source를 붙인다

## 트리거
| 말 | 동작 |
|---|---|
| "<화면> 만들어줘" | runs/<화면>/state.json 기준으로 시작 또는 이어서 |
| "<화면> 판정해줘" | 현재 단계 judge만 실행 |
| "<화면> 승인했어" | approval.md 확인 후 S3부터 |
| "하네스 상태 알려줘" | 모든 화면 state.json 요약 |

<화면> = production-status | content-overview | paid-performance
(한글 별칭: docs/roles.md 4절)

## 흐름 (docs/pipeline.md)
S1 s1-reference → run-stage S1
S2 s2-spec      → run-stage S2
SW sw-wireframe → run-stage SW (회색 박스 와이어프레임)
✋ 사람 승인: 설계 문서 + 와이어프레임을 함께 보고
   runs/<화면>/approval.md 에 `approved: yes`, `stage: SW`, `approved-sha256: …`
   해시 줄은 `node judge/check-approval.mjs <화면> --print-hash` 로 사용자에게 보여준다. approval.md는 사용자가 쓴다.
S3 s3-html      → run-stage S3 (승인이 없거나 S2·와이어프레임이 바뀌었으면 exit 4)
S4 s4-figma     → run-stage S4 (Figma REST 재조회, FIGMA_TOKEN 필요)

매 단계:
1. runs/<화면>/state.json 읽기 → `stage` 값이 다음 단계 (파일이 없으면 S1)
2. 해당 에이전트 호출 (입력: 화면 slug + 이전 단계 산출물 경로 + 직전 verdict가 있으면 그 경로)
3. judge 에이전트로 `node <하네스>/judge/run-stage.mjs <화면> <SN>` 실행
   — 판정, 시도 횟수, 한도, state.json 갱신을 이 스크립트가 한다. 오케스트레이터는 파일을 쓰지 않는다.
4. exit code로 다음 행동:
   0 통과 → 다음 단계 / 1 실패 → 같은 단계 재시도 (S4 원인이 HTML이면 S3) /
   3 한도 초과 · 2 오류 → 멈추고 사용자에게 실패 항목과 위치를 보고 / 4 → 이전 단계 또는 승인 대기
   한도: S2 2회 · SW 2회 · S3 3회 · S4 3회 (rules.json retry). 자동으로 계속하지 않는다.
   SW가 통과하면 와이어프레임 파일 경로를 사용자에게 보여주고 승인을 기다린다.

## 쓰기 권한 (docs/roles.md, hooks/guard.mjs가 강제)
| 누가 | 쓸 수 있는 곳 |
|---|---|
| s1-reference | runs/<화면>/s1/ |
| s2-spec | runs/<화면>/s2/ |
| sw-wireframe | runs/<화면>/sw/ |
| s3-html | runs/<화면>/s3/ |
| s4-figma | runs/<화면>/s4/s4-figma.json + Figma 파일 IwmNcXuHeFy7fmv5uhQdwa "Analytics" 페이지 |
| judge (스크립트) | verdict-*.json, s4/s4-compare.json |
| judge/run-stage.mjs | runs/<화면>/state.json |
| 사람만 | rules.json, approval.md |

## 판정 기준 파일
- 규칙: rules.json (값은 토큰 이름, 실제 값은 tokens/tokens.css)
- 디자인 기준: rules.json sources.design (components/ai-social-media/design.md, 없으면 vendor/design.md)
- ★ 어기면 안 되는 것: docs/story-service.md — rules.json gates.S3.forecastActual, gates.S3.productionContent
- story-service.md(판정 기준)와 story-work.md(작업 흐름)를 섞지 않는다.

## 처음 쓰기 전 (docs/verification.md)
selftest 통과 → 컴포넌트 이름 보강 승인 → [임의] 값 리뷰 → content-overview 시범 실행
`node judge/selftest.mjs`가 통과하지 않으면 어떤 트리거도 실행하지 않는다.
