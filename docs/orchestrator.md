# orchestrator — 오케스트레이터 (R7)

출처 표시: `[사용자]` · `[기본값 승인]` · `[임의]` — [purpose.md](purpose.md)와 같다.
이 라운드의 값은 전부 `[기본값 승인]`이다.

## 1. 지시 파일 위치

| 파일 | 내용 |
|---|---|
| `prototypes/ai-social-media/analytics/harness/CLAUDE.md` | 하네스 전용 오케스트레이터 지시 |
| 루트 `CLAUDE.md` | 트리거 안내 몇 줄만 추가 → `harness/CLAUDE.md`를 따르게 함 |
| 루트 `AGENTS.md` (Codex) | 변경하지 않음 |

하위 폴더의 CLAUDE.md는 그 폴더 파일을 읽을 때만 로드되므로, 트리거 인식을 위해 루트에 안내를 둔다.

## 2. 오케스트레이터가 하는 일

오케스트레이터는 메인 Claude 세션이다. **길만 정하고 산출물은 직접 만들지 않는다.** (P6)

```
state.json 읽기 → 다음 단계 결정 → 에이전트 호출 → run-stage.mjs (판정·횟수·state 갱신)
   ├─ 통과: 다음 단계
   ├─ 실패: 같은 단계 재시도 (한도: pipeline.md 3절)
   ├─ 한도 초과: 멈추고 사람에게 알림
   └─ S2 통과 후: approval.md가 생길 때까지 대기
```

오케스트레이터는 파일을 쓰지 않는다. 단계 실행·판정·시도 횟수·`state.json` 갱신은 `judge/run-stage.mjs`가 하고, 오케스트레이터는 그 exit code로 다음 행동을 정한다. (개선 4)

| exit | 뜻 | 오케스트레이터 |
|---|---|---|
| 0 | 통과 | 다음 단계 에이전트 호출 |
| 1 | 실패, 재시도 가능 | verdict를 넘겨 같은 단계 에이전트 재호출 |
| 3 | 한도 초과 | 멈추고 사람에게 보고 |
| 4 | 이전 단계 미통과 또는 승인 대기 | 사람에게 알리고 대기 |
| 2 | 스크립트 오류 | 멈추고 사람에게 보고 |

## 3. 에이전트 정의와 hook 위치

Claude Code는 저장소 루트 `.claude/`만 인식한다.

| 항목 | 위치 |
|---|---|
| 에이전트 정의 | `.claude/agents/s1-reference.md`, `s2-spec.md`, `s3-html.md`, `s4-figma.md`, `judge.md` |
| hook 등록 | `.claude/settings.json` (저장소 공유 설정) |
| hook 검사 로직 | `prototypes/ai-social-media/analytics/harness/hooks/guard.mjs` |

## 4. design.md 기준 경로

- 판정 스크립트는 `rules.json`의 `sources.design` 경로 하나만 읽는다. 현재 `components/ai-social-media/design.md`. "가장 최근 파일"을 매번 찾지 않는다.
- 사본 `harness/reference/design.md`는 두되 판정에 쓰지 않는다.
- 사본이 원본과 다르면 `judge-s3.mjs`가 **경고만** 낸다. 실패로 처리하지 않는다.
