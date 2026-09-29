# AI Social Media — 디자인 개요

`tokens/tokens.css`와 `style-reference.md`(Figma 컴포넌트 라이브러리 전수조사)를 요약한 한 장짜리 참고 문서다. 상세 근거·예외 사례는 `style-reference.md`를 보고, 여기서는 새 화면을 뜰 때 빠르게 참조할 규칙만 담는다. 값이 바뀌면 이 문서가 아니라 `tokens/tokens.css`를 먼저 고치고, 여기 표는 그걸 반영해 갱신한다.

---

## 1. 개요

흰 배경(`neutral-0`) 위에 짙은 남색 텍스트(`neutral-900`)를 쓰는 뉴트럴 톤 UI다. 브랜드 블루(`brand/primary`)는 전체를 칠하는 색이 아니라 **"지금 이게 켜져 있다/ AI가 개입 중이다"를 알리는 신호색**으로만 아껴 쓴다 — 카드나 리스트를 선택했을 때는 파란색이 아니라 보더·배경을 한 단계 진한 회색으로 바꾼다. 버튼의 주 액션(Primary)은 브랜드 블루가 아니라 진회색~검정 그라디언트다.

## 2. 컬러

| 토큰 | 값 | 용도 |
|---|---|---|
| `--color-neutral-0` | `#ffffff` | 기본 배경, 카드 배경 |
| `--color-neutral-100` | `#eef2fa` | 옅은 배경 틴트 |
| `--color-neutral-150` | `#e9edf6` | 선택된 카드/행 배경 |
| `--color-neutral-300` | `#d6ddeb` | 구분선, TopBar 보더 |
| `--color-neutral-400` | `#c8d1e1` | 기본 보더 |
| `--color-neutral-500` | `#8a93a8` | 보조 텍스트, 기본 아이콘 색, 선택 보더 |
| `--color-neutral-700` | `#475069` | 라벨 텍스트 |
| `--color-neutral-900` | `#0f1729` | 본문 텍스트 |
| `--color-brand-primary` | `#4f6de6` | on/off 강조, AI 신호, CTA 텍스트·틴트 (배경 채우기 X) |
| `--color-brand-primary-mid` | `#a8cbff` | 브랜드 강조 배경 틴트 |
| `--color-brand-primary-light` | `#dce7fb` | Nav 선택 상태 배경 틴트 |
| `--color-brand-accent` | `#ed7797` | 알림 점 등 극소량 포인트 |
| `--color-badge-green-text` / `-bg` | `#027a48` / `#ecfdf3` | 성공/완료 배지 |
| `--color-badge-red-text` / `-bg` | `#b80000` / `#ffe0e2` | 위험/삭제 배지 |

전체 스케일은 `tokens/tokens.css`의 `--color-neutral-*`(0~950), `--color-brand-*`, `--color-badge-*` 참고.

## 3. 타이포그래피

- **폰트**: 본문·UI `'DM Sans'`, 모노스페이스 `'JetBrains Mono'`, 로고 `'Manrope'`.
- **굵기**: Regular 400 / Medium 500 / Semibold 600 / Bold 700.
- **본문(Text) 스케일** — 화면 대부분은 이 스케일을 쓴다:

| 토큰 | 크기 | 행간 |
|---|---|---|
| `text-2xl` | 18px | 28px |
| `text-xl` | 16px | 24px |
| `text-lg` | 15px | 22px |
| `text-md` | 14px | 22px |
| `text-sm` | 13px | 20px |
| `text-xs` | 12px | 18px |
| `text-2xs` | 11px | 16px |

- **제목(Display) 스케일**은 랜딩성 헤드라인용으로 48~20px(`display-2xl`~`display-xs`), 기본 굵기는 Bold~Semibold.
- 배지 텍스트는 별도로 9~11px(`font-size-badge-*`)를 쓴다.

## 4. 레이아웃·모양

- **spacing**: 8px 그리드가 기본. `spacing-xs(4) / sm(8) / md(12) / lg(16) / xl(20) / 2xl(24) / 3xl(32) / 4xl(40)…`. 컨테이너 내부 패딩은 `sm~lg`에 몰리고, 화면 레벨 여백만 `2xl` 이상으로 올라간다. **8px 스텝을 벗어난 값(예: 10px, 14px)은 쓰지 않는다** — 기존 컴포넌트 일부에 남아있는 이탈값은 실수이지 규칙이 아니다.
- **radius 3단 규칙**:
  1. 구조물(카드·패널·필드·모달) → `radius-lg(8)`~`radius-xl(12)`
  2. 그 안에서 떠 있는 pill/내부 필 → 구조물보다 한 단계 작게(예: 트랙 8이면 내부 필 6)
  3. 완전한 원이 필요한 곳(아바타, 스위치, 프로그레스바 트랙, 아이콘 배경) → `radius-full`
- **그림자**: 기본은 그림자 없이 보더로 경계를 그린다. 그림자는 목적이 명확한 곳에서만 토큰으로 쓴다 — 모달 `shadow-modal`, 팝오버 `shadow-popover`/`shadow-context-popover`, 뜬 캔버스/포스터 `shadow-canvas-poster`. 임의의 `box-shadow` 값을 새로 만들지 않는다.

## 5. 컴포넌트

- **버튼**
  - 아이콘 전용 버튼은 항상 36px 정사각형, radius `lg`.
  - Primary = 다크 그라디언트(`#323232→#222`, AI 액션용). Secondary = `neutral-0` 배경 + `neutral-400` 보더 + `neutral-700` 텍스트. Ghost = 배경 없이 텍스트만.
  - 브랜드 블루로 채운 버튼은 만들지 않는다. CTA 강조는 텍스트/배경 틴트로.
- **인풋**
  - 높이는 두 티어: `SM 36px` / `MD 40px`.
  - 기본 상태 = `neutral-0` 배경 + `neutral-400` 보더 + `neutral-900` 텍스트, 라벨은 `neutral-400` 대문자.
  - 값이 선택된 상태(체크박스, 스위치 on, 라디오, 세그먼트 아이템)만 `brand/primary`로 채운다.
- **카드/리스트**
  - 기본 = `neutral-0` 배경 + `neutral-400` 보더.
  - 선택 = `neutral-150` 배경 + `neutral-500` 보더(브랜드 컬러 아님). 텍스트 색·굵기는 선택 여부와 무관하게 유지.
- **빈 슬롯/추가 액션**: 항상 파선(dashed) 보더 + 중앙 정렬 아이콘 (`+` 새로 만들기, 업로드 드롭존 등 공통 패턴).
- **AI 관여 표시**: AI가 지금 개입 중인 입력창·버튼(AI Prompt Box, Spark 버튼)만 보더/배경에 `brand/primary`를 쓴다. 그 외 입력창은 뉴트럴.

## 6. Do / Don't

**Do**
- 선택·활성 상태는 기본적으로 뉴트럴 톤(보더·배경 한 단계 진하게)으로 표현한다.
- 브랜드 블루는 ① on/off 컨트롤의 on 상태, ② AI 개입 신호, ③ CTA 텍스트/포커스 틴트 — 이 세 곳에만 쓴다.
- spacing·radius·색상은 항상 `tokens/tokens.css`의 토큰 이름으로 참조하고, 값이 필요하면 토큰을 먼저 확인한다.

**Don't**
- 카드 그리드나 리스트의 "선택됨"을 브랜드 블루 배경으로 칠하지 않는다 — 이 제품의 카드 선택은 예외 없이 뉴트럴 강조다.
- 8px 그리드를 벗어난 임의의 spacing 값(10px, 14px 등)을 새로 만들지 않는다.
- 그라디언트·그림자·보더 색을 raw hex로 하드코딩하지 않는다 — 토큰에 없으면 새로 만들기 전에 먼저 토큰 추가 여부를 확인한다.
