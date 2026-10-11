# Analytics 작업 인수인계 (2026-10-11 기준)

다음 세션에서 이 파일부터 읽고 이어서 작업한다.

## 1. 지금까지 한 것

### 문서 (harness/docs/)
- `prd.md`: Analytics PRD. Phase 1에 조회수·좋아요 포함.
- `story-service.md`: 서비스 유저 스토리.
- `story-work.md`: 작업 흐름 스토리. 7번 보류, 6번 Figma 산출, 1번은 멈추고 컨펌. 게이트 G1~G3.
- `purpose.md`, `pipeline.md`, `gates.md`, `roles.md`, `artifacts.md`, `verification.md`, `orchestrator.md`: 하네스 설계(원칙 P1~P9, R0~R8 인터뷰 결과는 대부분 기본값으로 정함).

### 하네스 (이 폴더 = github.com/yjkim9627-gif/my-harness)
- 흐름: S1 레퍼런스 → S2 설계 → **SW 와이어프레임** → 승인(approval.md) → S3 HTML → S4 Figma. 최종 산출물은 HTML → Figma.
- 에이전트: s1-reference, s2-spec, sw-wireframe, s3-html, s4-figma, judge(읽기 전용 판정).
- 명령: "<화면> 만들어줘 / 판정해줘 / 승인했어", "하네스 상태 알려줘" → `harness/CLAUDE.md`를 따른다.
- 다른 컴퓨터 설치: `setup.sh` 실행(vendor 스냅샷, 템플릿 .claude 설치). 결과물 `runs/`는 git에서 제외.

### Figma 리디자인 (가장 최근 작업)
- 파일: FME_AI-Social-Media `N8AXYZVtz82rgHcCRHKzEl`, 페이지 "✍️ AI Social Media (Redsigning~)"
- 섹션 **Analytics_to be** `12576:448644`
  - 기존 화면: `12576:448645`
  - **새 리디자인: "Analytics · default" `12579:248761`** (1920×1441, 기존 프레임 오른쪽)
    https://www.figma.com/design/N8AXYZVtz82rgHcCRHKzEl/FME_AI-Social-Media?node-id=12579-248761
- 방식: Home 프레임(`12427:416860`, 페이지 "Phase2 hand off")을 복제한 뒤, 내비는 Analytics 선택 상태, 상단 바는 "Analytics"로 바꿈. Main Content는 새로 조립함.
- 구성 (콘텐츠는 기존 Analytics 그대로, 스타일만 Home/Trends에 맞춤):
  - 헤더 `12581:25`: 제목·설명 + 기간 선택(30 days / 90 days / All time / Custom, 새로 그린 일반 프레임) + Stats summary KPI 4개(Posts ready 10, In progress 0, Failed renders 1, Compute spend $5.98). Failed renders 아이콘은 circle-alert.
  - 1행 `12582:26`: Meta Ads spend(막대 5주, "live" 배지, Peak / Avg / 12w total) | Content mix · by count(도넛 + 범례)
  - 2행 `12582:579186`: Paid performance · Meta Ads(Connected 배지 + 빈 상태)
  - 3행 `12582:579206`: Top forecast performers(Home Top content 목록 복제, leads + CPL, "★ Predicted top" 칩, "All →") | Top performers · this period(빈 상태)
- 재사용한 컴포넌트: Nav / Navigation, Nav / App TopBar, Stats summary, Trends / Section Header, Actions / Text Button, Feedback / Status Chip, empty-state(Compact `12229:194030`)
- 새로 그린 것(컴포넌트 아님, 변수에 연결): 기간 선택, 막대 차트, 도넛 차트

## 2. 사용자 확인이 필요한 항목 (아직 답 없음)
1. 막대 높이는 임의 값이다(Peak 1,137 / 평균 626 / 합계 3,130에 맞춤).
2. 도넛 가운데 "10 pieces"는 새로 넣은 문구다.
3. Top forecast performers 썸네일은 Home 이미지 그대로다.
4. #2, #3 칩은 뺐다.
5. "12w total" 라벨이 5주 막대와 맞지 않는다(원본 그대로 둠).
6. 프레임 높이가 1441이다(다른 화면은 1162).
7. 기간 선택과 차트 카드를 컴포넌트로 만들지 결정해야 한다.

## 3. 다음 할 일
- 사용자가 기능을 다듬어 추가하고 화면 디자인을 변경할 예정이다. 위 리디자인 프레임을 기준으로 이어간다.
- 위 2번 항목의 답을 받아 반영한다.

## 4. 작업 규칙 메모
- 주의: 하네스 S4의 Figma 대상(IwmNcXuHeFy7fmv5uhQdwa "Analytics" 페이지)과 이번 리디자인 파일(N8AXYZVtz82rgHcCRHKzEl)은 서로 다른 파일이다. 이번 리디자인은 하네스 밖에서 직접 작업했고, runs/ 폴더는 아직 만들어지지 않았다(하네스 실행 이력 없음).
- Figma 작업은 use_figma(skillNames "resource:figma-use,resource:figma-generate-design")로 한다. 노드 ID는 위 값을 그대로 쓴다.
- 카드 스타일: neutral/0 배경, neutral/400 1px 테두리(inside), radius/xl, shadow/md. 섹션 사이 간격 spacing/4xl(40), 열 사이 24, 헤더와 카드 사이 16.
- HTML 작업 시 토큰은 `tokens/tokens.css`만 쓴다. 컴포넌트는 `components/ai-social-media/`에 먼저 만들고 참조한다. 1920×1162 `.frame` + `fitFrameToViewport()` 규칙을 따른다.
- 관련 HTML 화면(formee-education 레포): `prototypes/ai-social-media/home/home.html`, `trends/trends.html`. 배포는 https://yjkim9627-gif.github.io/formee-education/
