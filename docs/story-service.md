# Analytics — User Stories (Phase 1)

출처: [prd.md](prd.md)

## 유저스토리

| # | 유저스토리 | 근거 |
|---|---|---|
| 1 | Social Media Manager가 Posts ready / Failed renders 개수와 실패 건의 auto-retry 상태를 확인하고, 실패한 렌더를 다시 시도하거나 삭제한다 | PRD Scenario 01 – 2, 3 |
| 2 | Social Media Manager가 이번 기간 Compute spend를 시스템이 보여주는 기준 범위와 비교해 확인한다 | PRD Scenario 01 – 4 |
| 3 | Social Media Manager가 Reels/Posts/Carousels/Stories 비중과 플랫폼(인스타그램·페이스북·틱톡)별 조회수·좋아요 반응을 확인한다 | PRD Scenario 02 – 1, 2 |
| 4 | Social Media Manager가 실측 Top performers를 예측 Top forecast performers와 구분해서 확인한다 | PRD Scenario 02 – 3, 4 |
| 5 | Social Media Manager가 Meta 광고의 Ad spend 추이, 성과 지표(Impressions·Clicks·CTR·Leads·CPL/CPA), CPL이 가장 낮은 캠페인/콘텐츠를 확인한다 | PRD Scenario 03 – 2~4 |

### 공통 조건 — 기간

- 모든 스토리의 "이번 기간 / 기간별" 데이터는 **30일 / 90일 / All time / Custom** 중에서 선택한 기간을 기준으로 한다. (PRD 4. 공통 — 기간 선택)

## 이 서비스에서 어기면 안 되는 것

| # | 규칙 | 근거 |
|---|---|---|
| 1 | 예측치(forecast)를 실측치(actual)와 같은 카드/리스트 스타일로 섞어서 보여주지 않는다 | PRD Must Not 2, Must 2, 사용자 불편 2 |
| 2 | Production 지표(생성 성공률·실패·비용)와 Content 성과 지표를 한 섹션에 섞지 않는다 | PRD Must 1, 사용자 불편 1 |
