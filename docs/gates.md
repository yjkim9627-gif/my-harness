# gates — 게이트 (R5)

출처 표시: `[사용자]` · `[기본값 승인]` · `[임의]` — [purpose.md](purpose.md)와 같다.
이 라운드의 값은 `[기본값 승인]`이다. 그중 제안 단계에서 Claude가 채워 넣은 값은 `[임의]`로 남긴다.
조건의 실제 값(지표 목록, 허용 토큰, 셀렉터 등)은 [`../rules.json`](../rules.json)에만 있다. 이 문서는 무엇을 세는지만 설명한다.

- 통과/실패는 판정 스크립트만 정한다. 에이전트 보고서는 판정에 쓰지 않는다. (P1, P7)
- 실패 시 복귀 경로와 한도는 [pipeline.md](pipeline.md) 3절을 따른다. (P8)
- ★ = [story-service.md](story-service.md)의 "어기면 안 되는 것"을 위반하면 걸리는 조건

```
S1 ─[S1]─▶ S2 ─[S2]─▶ SW ─[SW]─▶ ✋ 사람 승인 ─▶ S3 ─[S3]─▶ S4 ─[S4]─▶ 완료
```

## S1 — Reference

| # | 통과 조건 |
|---|---|
| S1-1 | 레퍼런스 개수가 3~5개 |
| S1-2 | 레퍼런스마다 uibowl `ui_url`과 대상 화면명이 있다 |
| S1-3 | 반영할 부분 중 design.md Don't 패턴이 0개 (브랜드 블루 선택 상태, 브랜드 블루로 채운 버튼, 그림자로 그린 카드 경계) |

`s1-reference.md` 안의 ```json 블록 형식은 `rules.json gates.S1.format`을 따른다. `[임의]`

story-work의 G1·G2(사람 컨펌)는 이 스크립트 조건으로 바뀐다.

## S2 — Spec

| # | 통과 조건 |
|---|---|
| S2-1 | 대상 화면의 PRD 지표 이름이 모두 한 번 이상 나온다 (문자열 대조) |
| S2-2 | 기간 옵션 4개(30일 / 90일 / All time / Custom)가 모두 있다 |
| S2-3 | Production Status 화면이면 retry·delete 액션이 있다 |

## SW — Wireframe (와이어프레임 라운드에서 추가)

회색 박스 수준인지와 구조만 센다. **토큰·px·폰트·radius는 세지 않는다.** headless Chrome 렌더 값으로 판정하고, 아래가 모두 0건이면 통과.

| # | 위반으로 세는 것 |
|---|---|
| SW-1 | 회색이 아닌 색 — 글자·배경·보더 색의 R·G·B가 다름 (완전 투명 제외) |
| SW-2 | 이미지(`<img>`, 배경 이미지)나 그림자 |
| SW-3 | 화면 PRD 지표·기간 옵션·액션 이름이 화면 글자로 없음 |
| SW-4 | 골격 — S3-12와 같은 검사 (내비 262, TopBar 56, main 패딩, filter bar, 카드 그리드) |
| ★SW-5 | 구조 — S3-8~11과 같은 검사 (Forecast/Actual, Production/Content 분리) |

FME에 없는 요소(차트, 지표 카드 등)는 `data-placeholder="chart"` 같은 회색 박스로 그려도 통과한다. (사용자 확인)

## ✋ 사람 승인 — SW → S3 (P5)

- 위치: story-work G3(화면 설계 컨펌)과 같은 자리. 하네스의 사람 승인은 이곳 **1곳뿐**이다. 설계 문서와 와이어프레임을 **함께** 보고 승인한다.
- 파일: `runs/<화면>/approval.md` — **사람만 쓴다.**
- 스크립트(`judge/check-approval.mjs`)는 `approved: yes`, `stage: SW`, `approved-sha256: <해시>`가 있고 **해시가 현재 `s2/s2-spec.md` + `sw/sw-wireframe.html`과 같은지** 확인한다. 하나라도 어긋나면 S3를 시작하지 않는다. 승인한 뒤 둘 중 하나라도 바뀌면 다시 승인해야 한다.
- 해시 줄은 `node judge/check-approval.mjs <화면> --print-hash`로 얻어 사람이 붙여 넣는다.

## S3 — HTML

아래 항목이 **모두 0건**이면 통과한다.

| # | 위반으로 세는 것 |
|---|---|
| S3-1 | CSS의 raw 색 — hex, rgb/hsl/hwb/lab/lch/oklch/color(), 색 이름(white, red …) (개선 1) |
| S3-2 | `var()` 없이 쓴 길이 값 — px·rem·em·vw 등 모든 길이 단위 (예외: `0`, `1px` 보더, 크기 속성의 Figma 골격 치수 262·56·64·304·1920·1162) (개선 1) |
| S3-3 | `tokens.css`에 없는 `var(--x)` 이름 |
| S3-4 | 허용된 그림자 토큰 4개 외의 `box-shadow`, `filter`/`backdrop-filter`의 `drop-shadow`, `text-shadow` (개선 1) |
| S3-5 | 허용 셀렉터 밖에서 쓴 `--color-brand-primary*` `[임의]` 셀렉터 목록 |
| S3-6 | 허용 셀렉터 밖의 `dashed` 보더 `[임의]` 셀렉터 목록 |
| S3-7 | Figma 컴포넌트명 목록에 없는 `data-component` 이름 |
| ★S3-8 | `data-kind="forecast"`와 `data-kind="actual"`이 같은 섹션 안에 있거나 같은 카드 클래스를 쓴다 |
| ★S3-9 | `data-kind` 요소에 "Forecast" / "Actual" 라벨 텍스트가 없다 |
| ★S3-10 | `data-section="production"`과 `data-section="content"`가 같은 섹션이거나 서로 중첩된다 |
| S3-11 | ★ 조건에 필요한 속성이 화면에 없다 — content-overview: `data-kind` forecast·actual, `data-section="content"` / production-status: `data-section="production"` `[임의]` 속성을 빼서 ★ 조건을 피하지 못하게 하려고 추가 |

**렌더 값 판정** (개선 2) — headless Chrome으로 1920 × 1162에서 실제 렌더한 계산값을 센다. CSS를 어떻게 썼든 결과로 판정한다. 렌더가 안 되면 `S3-render`로 실패.

| # | 위반으로 세는 것 |
|---|---|
| S3-12 | Figma 골격 — `Nav / Navigation` 없음 또는 폭 ≠ 262, `Nav / App TopBar` 없음 또는 높이 ≠ 56, `<main>` 상·좌 padding ≠ `layout.mainPadding` |
| S3-13 | radius 토큰 값이 아닌 border-radius (예: 50%, 7px) |
| S3-14 | 글자를 가진 요소의 font-size가 `--font-size-*` 값이 아니거나, font-weight가 400/500/600/700이 아니거나, 첫 font-family가 `--font-family-*`가 아님 |
| S3-15 | 글자 없는 버튼(아이콘 전용)이 36 × 36 / `radius-lg`가 아님, 인풋·셀렉트 높이가 36·40이 아님 |

| # | 위반으로 세는 것 |
|---|---|
| S3-16 | 승인된 와이어프레임과 구조 순서가 다름 — `data-section` · `data-kind` · 가장 바깥 `data-component`/`data-placeholder` 순서. 와이어프레임의 placeholder 자리에는 어떤 컴포넌트든 허용 |

radius "3단 규칙"(구조물 8~12, 안쪽은 한 단계 작게)은 어떤 요소가 구조물인지 기계가 알 수 없어 세지 않는다. 토큰 값인지만 센다.

story-work 7번(가이드 검토, 보류)은 S3·S4 조건으로 대신한다.

## S4 — Figma

아래 항목이 **모두 0건**이면 통과한다. 스크립트가 Figma에서 **직접 다시 읽은 결과**로만 판정한다. (P7)

| # | 위반으로 세는 것 |
|---|---|
| S4-1 | 분리(detach)됐거나 로컬에서 만든 컴포넌트 (레이아웃용 빈 프레임 제외) |
| S4-2 | 변수에 연결되지 않은 fill·stroke |
| S4-3 | 텍스트 스타일이 없는 텍스트 노드 |
| S4-4 | HTML `data-component` 목록과 Figma 인스턴스 목록의 이름·개수 차이 |
| S4-5 | HTML과 Figma의 텍스트 내용 차이 |
