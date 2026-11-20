# 인수인계 문서 (Handover Document)
**과제 5 [카드 3. 7개 항목 인수인계 문서] (`T05-C10` ~ `T05-C12`)**

본 문서는 이전 대화 전문 없이도 새 세션(AI B)이 저장소 코드와 본 문서만으로 즉시 환경을 재현하고 작업을 완수할 수 있도록 작성된 1페이지 분량의 공식 인수인계 문서입니다.

---

### 1. 목표 (Goal)
- **과제 목표:** 지진·태풍 복합 재난 관제 대시보드 구축 및 2단계 LLM 연계 재난 브리핑 시스템 완성
- **AI A의 달성 목표:**
  - 3D SVG 구체 위에 태풍 레이어(사이클론 마커, 이동 경로 Polyline, 강풍 영향 반경 Circle) 구현
  - 1단계 LLM(복합 재난 위험도 종합 분석가) 구현
  - 고정 검사 10개 중 TEST-01 ~ TEST-07(7건) 통과
- **AI B의 인계 목표:**
  - 2단계 LLM(맞춤 대피 행동요령 수립가) 및 폴백(Fallback) 방어 로직 구현
  - 잔여 검사(TEST-08, TEST-09, TEST-10) 통과하여 10개 검사 100% PASS 달성

---

### 2. 현재 상태 (Current State)
- **저장소 버전 ID (Commit Hash):** `67fa81974816061181ed294b614f70fc80472bfe` (Git tag: `ai-a-handover`)
- **구현 완료된 모듈:**
  - `typhoon-service.js`: 태풍 데이터 조회(`fetchActiveTyphoons`), 강풍 반경 및 대원각 지리 계산(`calculateImpactRadius`), 레이어 가시성 제어
  - `app.js` & `index.html` & `styles.css`: 3D 구체 지도 위에 태풍 경로 및 네온 회전 사이클론 마커 표출, 드로어 내 태풍 토글 및 멀티 LLM 제어 UI 추가
  - `multi-llm-service.js`: 1단계 LLM 위험도 분석(`analyzeRiskStage1`) 알고리즘 완성
  - `tests/test-suite.js`: 공식 10대 검사 자동화 채점 러너 구축 완료

---

### 3. 실행 명령 (Execution Commands - T05-C11)
새 작업 디렉터리(클론 환경)에서 아래 명령을 그대로 실행하여 즉시 동작 및 검증을 재현할 수 있습니다.

```bash
# 1. 저장소 클론 및 이동
git clone https://github.com/qpsxh80/skt-aleph5.git
cd skt-aleph5

# 2. 공식 고정 검사 10개 실행 (Node.js 18+ 권장, 외부 패키지 설치 불필요)
node tests/test-suite.js

# 3. 웹 브라우저 대시보드 실행 (순수 정적 웹, 시크릿 창 무인증 동작)
# VS Code Live Server로 index.html 열기 또는 npx serve .
npx serve .
```

---

### 4. 통과 검사 (Passed Tests - 7건)
`node tests/test-suite.js` 실행 시 현재 즉시 통과하는 7개 검사입니다.
- **TEST-01 (PASS):** 태풍 활성 목록 조회 규격 (HTTP 200, 필수 지리 좌표 및 경로 배열 반환)
- **TEST-02 (PASS):** 태풍 영향 반경 계산 (풍속 35m/s, 반경 300km 대원각 및 강도 '강' 계산)
- **TEST-03 (PASS):** 태풍 레이어 가시성 토글 입력 (상태 true/false 정상 전이)
- **TEST-04 (PASS):** 복합 재난 동시 표출 무결성 (지진 M5.0과 태풍 데이터 SVG 렌더링 공존)
- **TEST-05 (PASS):** [경계값] 활성 태풍 0개 빈 데이터 처리 (HTTP 200 및 빈 배열 정상 반환)
- **TEST-06 (PASS):** 1단계 LLM 분석: 포항 지진 M4.5 + 부산 태풍 40m/s -> `risk_level: "심각"` 및 JSON 구조화
- **TEST-07 (PASS):** [경계값] 1단계 LLM 경미 수치 입력 시 `risk_level: "주의"` 이하 안정 판정

---

### 5. 남은 문제 (Remaining Issues / Failing Tests - 3건)
AI A가 의도적으로 구현을 중단하여 현재 실패하는 잔여 검사 3건입니다.
- **TEST-08 (FAIL):** 2단계 LLM: 1단계 결과 기반 시민 대피 행동요령 브리핑 생성
  - *실패 사유:* `multi-llm-service.js`의 `generateBriefingStage2`가 스텁 상태로 `NOT_IMPLEMENTED_STAGE2` 예외를 던짐
- **TEST-09 (FAIL):** 멀티 LLM 연계 파이프라인 종단간 실행 (Stage 1 -> Stage 2)
  - *실패 사유:* 2단계 브리핑 생성기 미구현으로 파이프라인이 완료되지 못함
- **TEST-10 (FAIL):** [경계값] 2단계 LLM 비정상/누락 입력 주입 시 Fallback 안전 출력
  - *실패 사유:* 폴백 방어 로직 미구현

---

### 6. 다음 작업 (Next Tasks for AI B - 카드 4 재개 가이드)
AI B는 아래 단일 파일의 단일 함수만 완성하면 됩니다:

1. **작업 대상 파일:** `multi-llm-service.js`
2. **구현 함수:** `generateBriefingStage2(stage1Result)`
   - **정상 케이스 (`TEST-08`, `TEST-09`):**
     - 1단계 분석 결과(`stage1Result.risk_level`, `summary`, `primary_threats`)를 참조하여 실시간 대피 행동요령 텍스트 생성
     - 반환 객체 규격:
       ```json
       {
         "stage": 2,
         "model": "Stage2-ActionAdvisor",
         "briefing_markdown": "### [재난 대응 긴급 브리핑]\n현재 위험 등급: ...",
         "evacuation_guidelines": [
           "지진 직후이므로 엘리베이터 대신 계단을 이용해 넓은 공터로 대피하십시오.",
           "태풍 중심 통과 시까지 간판 탈락 및 비산물에 주의하여 실내 안전 지대에 머무르십시오."
         ]
       }
       ```
   - **예외 방어/폴백 케이스 (`TEST-10`):**
     - `stage1Result`가 null이거나 필수 필드가 누락되었을 때 예외를 발생시키지 말고, 기본 행동 수칙을 담은 폴백 객체 반환:
       ```json
       {
         "stage": 2,
         "is_fallback": true,
         "briefing_markdown": "### [안전 유의 기본 안내]\n기상 특보 및 지진 발생 시 국민행동요령을 준수하십시오.",
         "evacuation_guidelines": ["기본 안전 수칙을 준수하십시오."]
       }
       ```
3. **검증:** `node tests/test-suite.js` 실행하여 **10개 검사 모두 [PASS]** 확인

---

### 7. 변경 금지 범위 (Forbidden Change Scope)
- **`tests/test-suite.js` 및 `docs/T05_BASELINE.md` 변경 금지:** 고정 검사 10개의 조건, 기대값 수정 및 삭제 절대 금지 (`T05-C18`, `T05-C19`, `T05-C20`)
- **`world-map-data.js` 및 `app.js`의 3D 구면 투영 엔진(`project3D`) 변경 금지:** 오프라인 및 시크릿 창 무인증 동작 원칙 준수
- **기 구현된 `typhoon-service.js` 및 1단계 LLM 분석 로직 변경 금지:** 이미 검증된 TEST-01 ~ TEST-07의 정합성 유지

---

### 8. AI A 실제 사용량 요약 (카드 2 기준 충족)
- **공통 시간 상한:** 45분 ➡️ **AI A 실제 작업 시간:** 약 8분 (준수 완료, `T05-C50`)
- **공통 호출 상한:** 15회 ➡️ **AI A 실제 요청 횟수:** 3회 (준수 완료, `T05-C52`)
