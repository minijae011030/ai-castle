# 📊 Dashboard Description (Home)

본 문서는 AI Castle 홈 화면 대시보드의 목표, 데이터 구조, UI 블록, 구현 순서를 정의합니다.

---

## 1. 목표

- 사용자가 하루/주간 학습 흐름을 한 화면에서 즉시 파악한다.
- AI가 만든 TODO/조정 결과가 실제로 효과가 있었는지 수치로 확인한다.
- 다음 액션(무엇을 줄이고, 무엇을 강화할지)을 빠르게 결정할 수 있게 한다.

---

## 2. 디자인 방향

- 톤: 다크/퍼플 계열, 밀도 높은 카드형 분석 대시보드
- 구성: 상단 KPI -> 중단 분포/히트맵 -> 하단 과목/추세 -> 인사이트 카드
- 핵심 원칙: “예쁜 차트”보다 “다음 행동이 보이는 차트”

---

## 3. 화면 블록

## 3.1 KPI 카드

- 오늘 집중 시간(Deep Focus)
- 오늘 총 학습 시간
- 오늘 남은 가능 시간(day_end_time 기준)
- 이번 주 누적 학습 시간

## 3.2 분포/패턴

- 주간 히트맵 (요일 x 시간대 학습량)
- 과목 비중 도넛 차트
- 시간대별 집중도 막대 차트

## 3.3 과목/추세

- 과목별 학습 시간 막대(일/주/월 토글)
- TODO 완료율 추세(line)
- 조정 전/후 효율 비교(선택)

## 3.4 AI 인사이트

- 과부하 경고 카드
- 내일 예측 부하 점수
- 추천 액션 카드(예: “정렬 복습 20분으로 축소”, “저녁 블록 분할”)
- 에이전트별 기여도 위젯(코테/정처기/CS 등)

---

## 4. 데이터 모델 (초안)

## 4.1 DailyMetrics

- date
- totalStudyMinutes
- deepFocusMinutes
- todoCompletedCount
- todoCreatedCount
- overloadScore

## 4.2 SubjectMetrics

- date
- subjectKey
- studyMinutes
- completedCount

## 4.3 AgentContribution

- date
- agentId
- agentName
- generatedTodoCount
- completedTodoCount
- rescheduleAppliedCount

## 4.4 NegotiationMetrics

- date
- requestCount
- acceptedCount
- rejectedCount
- avgShiftMinutes

---

## 5. API 초안

- `GET /api/dashboard/summary?date=YYYY-MM-DD`
- `GET /api/dashboard/heatmap?startDate=&endDate=`
- `GET /api/dashboard/subjects?startDate=&endDate=&unit=day|week|month`
- `GET /api/dashboard/agents?startDate=&endDate=`
- `GET /api/dashboard/insights?date=YYYY-MM-DD`

모든 응답은 `ResultResponse<T>` 래핑을 따른다.

---

## 6. 구현 순서 (권장)

1) 백엔드 집계 API 최소 2개(요약, 과목)  
2) 프론트 카드/KPI 스켈레톤  
3) 히트맵 + 도넛 + 막대 차트  
4) 인사이트 카드(과부하/추천) 연결  
5) 에이전트 기여도/조정 히스토리 위젯 확장

---

## 7. 완료 기준 (DoD)

- 홈 진입 시 2초 내 KPI 표시
- 빈 데이터일 때도 깨지지 않고 가이드 문구 노출
- 모바일/데스크탑 모두 카드 레이아웃 유지
- 주요 카드(요약, 과목, 인사이트) 최소 3개 이상 실제 데이터 연결

---

## 8. 비고

- 본 문서는 초기 버전이며, 실제 구현 단계에서 차트 라이브러리/지표 정의를 확정한다.
- UI 레퍼런스 분위기는 유지하되, AI Castle 도메인 지표를 우선 반영한다.
