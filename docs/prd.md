# Analytics — PRD (Phase 1)

## 1. 한 줄 정의

Analytics는 Social Media Manager가 AI로 생성한 콘텐츠의 제작 상태와 집행된 유료 광고 성과를 한곳에서 확인하고, 지금 있는 데이터 안에서 무엇이 잘 되고 있는지 빠르게 판단하는 기능이다.

> 참고: 플랫폼(Instagram, Facebook, TikTok)별 organic 반응은 **조회수·좋아요까지만** Phase 1에 포함한다. 그 외 organic 지표를 활용한 심화 플랫폼 비교는 Phase 2에서 다룬다.

## 2. 주요 사용자 1명

**Social Media Manager** — AI로 콘텐츠를 대량 생성하고, 그중 일부를 Meta 유료 광고로 집행하는 사용자.

지금 지쳐 있는 것:

- Analytics에 들어가면 "콘텐츠가 잘 됐는지"랑 "생성이 잘 됐는지"가 한 화면에 뒤섞여 있어서, 지금 내가 뭘 보고 있는 건지 매번 다시 생각해야 한다.
- "Top forecast performers"(예측)와 "Top performers"(실측)가 시각적으로 거의 똑같이 생겨서, 이게 진짜 성과인지 예측치인지 헷갈린다.

## 3. 사용자 시나리오

### Scenario 01 — 오늘 생성 상태 확인

1. Analytics에 진입한다.
2. Posts ready / Failed renders 개수를 확인한다.
3. 실패한 게 있으면 auto-retry 상태인지 확인하고, 필요하면 실패한 렌더를 다시 시도하거나 삭제한다.
4. 이번 기간 Compute spend가 시스템이 보여주는 기준 범위 안에 있는지 확인한다.

### Scenario 02 — 어떤 콘텐츠 형식이 잘 나가는지 파악

1. Content mix 섹션에서 Reels/Posts/Carousels/Stories 비중을 확인한다.
2. 플랫폼(인스타그램, 페이스북, 틱톡)별 반응이 좋은 콘텐츠를 확인한다. (조회수, 좋아요 기반)
3. Top performers(실측) 리스트에서 실제로 성과가 난 콘텐츠를 확인한다.
4. Top forecast performers(예측)와 헷갈리지 않고 구분해서 본다.

### Scenario 03 — Meta 광고 집행 성과 확인

1. Paid Performance로 이동한다.
2. 기간별 Ad spend 추이(Peak week/Avg/Total)를 확인한다.
3. Impressions, Clicks, CTR, Leads, CPL/CPA를 확인한다.
4. 어떤 캠페인/콘텐츠가 CPL이 가장 낮았는지 확인한다.

## 4. 만들 화면

1. **Production Status** (생성 파이프라인 상태)
2. **Content Overview** (콘텐츠 믹스 + 플랫폼별 조회수·좋아요 + 실측 Top performers)
3. **Paid Performance** (Meta Ads 상세)

### 공통 — 기간 선택

- 모든 화면의 "이번 기간 / 기간별" 데이터는 **30일 / 90일 / All time / Custom** 중 선택한 기간을 기준으로 한다.

## 5. 지켜야 할 것 / 안 할 것

### Must

- Production 지표(생성 성공률·실패·비용)와 Content 성과 지표는 시각적으로 분리된 섹션에 둔다.
- 예측치(forecast)와 실측치(actual)는 라벨과 스타일을 다르게 해서 한눈에 구분되게 한다.

### Must Not

- 플랫폼별 organic 성과는 조회수·좋아요 외의 지표로 넓히지 않는다 — 심화 플랫폼 비교는 Phase 2로 명시적으로 미룬다.
- 예측치를 실측치와 같은 카드/리스트 스타일로 섞어서 보여주지 않는다.
