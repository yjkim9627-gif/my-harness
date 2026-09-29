# Figma 레퍼런스 — 화면 골격

- 링크: https://www.figma.com/design/IwmNcXuHeFy7fmv5uhQdwa/Untitled?node-id=1-3642
- 노드: `1:3642` (section "reference")
- 캡처: [figma-reference.png](figma-reference.png)

같은 제품의 기존 화면 두 개(Content Library, Schedule)다. Analytics 화면은 이 골격을 그대로 따른다.
아래 수치는 Figma 메타데이터(노드 위치·크기)에서 읽은 값이다. 색·폰트 값은 읽지 않았으므로 design.md와 tokens.css(원본, 없으면 [vendor/](../vendor/design.md) 사본)를 따른다.

## 포함된 화면

| 프레임 | 노드 | 크기 |
|---|---|---|
| Content Library · full list · top | `1:2010` | 1920 × 1162 |
| Schedule · 1 calendar | `1:3253` | 1920 × 1162 |

## 공통 골격 (두 화면 동일)

```
┌──────────┬──────────────────────────────────────────────┐
│ Nav /    │ Nav / App TopBar                     (h 56)  │
│Navigation├──────────────────────────────────────────────┤
│ (w 262)  │ Main Content  (padding 28)                   │
│          │  header: title-block + Actions / Button (h54)│
│          │  ── gap 20 ──                                │
│          │  sticky · filter bar                  (h 64) │
│          │   Segmented Control(h46) · Filter/Select(h28)│
│          │  viewport (콘텐츠 영역)                        │
└──────────┴──────────────────────────────────────────────┘
```

| 요소 | 값 |
|---|---|
| 좌측 내비 `Nav / Navigation` | 폭 262 |
| 상단 바 `Nav / App TopBar` | 높이 56 |
| 메인 콘텐츠 좌우·상단 패딩 | 28 |
| 콘텐츠 폭 | 1602 |
| header | 높이 54 — 제목(h30) + 4 + 설명(h20), 우측에 `Actions / Button`(h38) |
| header → 다음 블록 간격 | 20 |
| sticky filter bar | 높이 64 — `Controls / Segmented Control`(h46) + 8 + `Controls / Filter / Select`(h28, 간격 12) |
| 카드 그리드 (Content Library) | 카드 폭 304, 가로 간격 16, 세로 간격 24 |
| 카드 내부 | 썸네일 → meta 간격 8 |
| 스크롤바 `Controls / Scrollbar` | 폭 6 |

## 등장하는 컴포넌트 이름 (Figma 네이밍 기준)

`Nav / Navigation`, `Nav / App TopBar`, `Actions / Button`, `Controls / Search Field`, `Controls / Segmented Control`, `Controls / Filter / Select`, `Controls / Scrollbar`, `Feedback / Status Chip`, `Data / Post Status Chip`

## design.md와 어긋나는 값

- **메인 콘텐츠 패딩 28** — `tokens.css`에 28px spacing 토큰이 없다. design.md 기준(토큰 스케일 밖의 값 금지)으로 보면 이탈값이다. → [rules.json](../rules.json) `layout.mainPadding`에서 처리 (`spacing-2xl`, 임의).
