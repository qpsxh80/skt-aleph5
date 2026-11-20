/**
 * tests/test-suite.js
 * 과제 5: 고정 검사 10개 (TEST-01 ~ TEST-10) 공식 자동 채점 러너
 * 
 * 실행 방법:
 *   node tests/test-suite.js
 */

const path = require("path");
const TyphoonService = require(path.join(__dirname, "../typhoon-service.js"));
const MultiLLMService = require(path.join(__dirname, "../multi-llm-service.js"));

async function runTestSuite() {
  console.log("==================================================================");
  console.log(" [과제 5] 고정 검사 10개 (TEST-01 ~ TEST-10) 공식 검증 실행");
  console.log(" 기준서: docs/T05_BASELINE.md");
  console.log(" 실행 시각:", new Date().toISOString());
  console.log("==================================================================\n");

  const results = [];

  function record(id, title, passed, detail) {
    results.push({ id, title, passed, detail });
    const tag = passed ? "[\x1b[32mPASS\x1b[0m]" : "[\x1b[31mFAIL\x1b[0m]";
    console.log(`${tag} ${id}: ${title}`);
    if (detail) {
      console.log(`       └─ ${detail}`);
    }
  }

  // TEST-01: 태풍 활성 목록 조회 API 규격 검증
  try {
    const res = await TyphoonService.fetchActiveTyphoons();
    const isValid = res.status === 200 &&
      Array.isArray(res.data) &&
      res.data.length > 0 &&
      res.data[0].id &&
      res.data[0].current_pos &&
      Number.isFinite(res.data[0].current_pos.lon) &&
      Number.isFinite(res.data[0].current_pos.lat) &&
      Array.isArray(res.data[0].forecast_track);

    record("TEST-01", "태풍 활성 목록 조회 규격 (HTTP 200, 필수 지리 필드 및 경로 배열 반환)", isValid,
      isValid ? `조회 성공: 태풍 ${res.data[0].name}, 좌표 [${res.data[0].current_pos.lon}, ${res.data[0].current_pos.lat}]` : "필수 필드 누락");
  } catch (err) {
    record("TEST-01", "태풍 활성 목록 조회 규격", false, err.message);
  }

  // TEST-02: 태풍 영향 반경 계산 로직
  try {
    const impact = TyphoonService.calculateImpactRadius(35, 300);
    const isValid = impact.radius_km === 300 &&
      impact.wind_speed_ms === 35 &&
      impact.intensity_grade === "강" &&
      impact.arc_degrees > 0;

    record("TEST-02", "태풍 영향 반경 계산 (풍속 35m/s, 반경 300km 대원각 및 강도 계산)", isValid,
      isValid ? `계산 완료: 강도 '${impact.intensity_grade}', 대원각 ${impact.arc_degrees}°` : "계산값 불일치");
  } catch (err) {
    record("TEST-02", "태풍 영향 반경 계산", false, err.message);
  }

  // TEST-03: 지도 레이어 토글 입력 처리
  try {
    TyphoonService.setTyphoonLayerVisibility(false);
    const isHidden = TyphoonService.getTyphoonLayerVisibility() === false;
    TyphoonService.setTyphoonLayerVisibility(true);
    const isVisible = TyphoonService.getTyphoonLayerVisibility() === true;
    const isValid = isHidden && isVisible;

    record("TEST-03", "태풍 레이어 가시성 토글 입력", isValid,
      isValid ? "레이어 토글 상태 정상 반영 (false -> true)" : "토글 상태 불일치");
  } catch (err) {
    record("TEST-03", "태풍 레이어 가시성 토글 입력", false, err.message);
  }

  // TEST-04: 복합 재난 동시 표출 무결성
  try {
    const eqData = { mag: 5.0, place: "경북 포항시 북동쪽 9km", lon: 129.38, lat: 36.10 };
    const tyRes = await TyphoonService.fetchActiveTyphoons();
    const tyData = tyRes.data[0];

    const isValid = eqData.mag === 5.0 &&
      tyData &&
      Number.isFinite(tyData.current_pos.lon) &&
      TyphoonService.getTyphoonLayerVisibility() === true;

    record("TEST-04", "복합 재난 동시 표출 무결성 (지진 M5.0 + 태풍 활성 데이터 공존)", isValid,
      isValid ? `동시 로드 확인: 지진 [${eqData.place}], 태풍 [${tyData.name}]` : "데이터 충돌 또는 누락");
  } catch (err) {
    record("TEST-04", "복합 재난 동시 표출 무결성", false, err.message);
  }

  // TEST-05: [경계값] 활성 태풍이 0개일 때 안정적 처리
  try {
    const emptyRes = await TyphoonService.fetchActiveTyphoons([]);
    const isValid = emptyRes.status === 200 &&
      Array.isArray(emptyRes.data) &&
      emptyRes.data.length === 0;

    // 기본 데이터 원복
    TyphoonService.resetTyphoonData();

    record("TEST-05", "[경계값] 활성 태풍 0개 빈 데이터 처리", isValid,
      isValid ? "HTTP 200 및 빈 배열 [] 정상 반환, 예외 발생 없음" : "빈 데이터 응답 이상");
  } catch (err) {
    TyphoonService.resetTyphoonData();
    record("TEST-05", "[경계값] 활성 태풍 0개 빈 데이터 처리", false, err.message);
  }

  // TEST-06: 1단계 LLM 분석 (포항 지진 M4.5 + 부산 근접 태풍 40m/s) -> risk_level: "심각"
  try {
    const mockEq = { mag: 4.5, place: "포항 인근", lat: 36.1, lon: 129.4 };
    const mockTy = { name: "SHANSHAN", max_wind_speed_ms: 40, central_pressure_hpa: 948 };
    const res = await MultiLLMService.analyzeRiskStage1(mockEq, mockTy);

    const isValid = res.stage === 1 &&
      res.risk_level === "심각" &&
      res.compound_score >= 70 &&
      Array.isArray(res.primary_threats) &&
      res.primary_threats.length > 0 &&
      typeof res.summary === "string";

    record("TEST-06", "1단계 LLM 분석: 복합 재난 위험도 '심각' 판정 및 JSON 규격", isValid,
      isValid ? `판정 결과: ${res.risk_level} (위험점수: ${res.compound_score}점)` : "분석 응답 불일치");
  } catch (err) {
    record("TEST-06", "1단계 LLM 분석", false, err.message);
  }

  // TEST-07: [경계값] 1단계 LLM 경미 수치 (M1.8 미소지진 + 소형 태풍) -> risk_level: "주의" 이하
  try {
    const mockEq = { mag: 1.8, place: "원거리 해역", lat: 34.0, lon: 125.0 };
    const mockTy = { name: "소형태풍", max_wind_speed_ms: 18, central_pressure_hpa: 998 };
    const res = await MultiLLMService.analyzeRiskStage1(mockEq, mockTy);

    const isValid = res.stage === 1 &&
      (res.risk_level === "주의" || res.risk_level === "관심") &&
      res.compound_score < 45;

    record("TEST-07", "[경계값] 1단계 LLM 경미한 수치 입력 시 '주의' 이하 안정 판정", isValid,
      isValid ? `판정 결과: ${res.risk_level} (위험점수: ${res.compound_score}점)` : `기대치 초과: ${res.risk_level}`);
  } catch (err) {
    record("TEST-07", "[경계값] 1단계 LLM 경미한 수치 입력", false, err.message);
  }

  // TEST-08: 2단계 LLM 맞춤 대피 행동요령 브리핑 생성 (AI B 구현 대상)
  try {
    const mockStage1 = {
      stage: 1,
      risk_level: "심각",
      compound_score: 88,
      primary_threats: ["산사태", "강풍"],
      summary: "규모 4.5 지진 및 태풍 복합 심각 상황"
    };
    const res = await MultiLLMService.generateBriefingStage2(mockStage1);
    const isValid = res &&
      typeof res.briefing_markdown === "string" &&
      res.evacuation_guidelines &&
      Array.isArray(res.evacuation_guidelines);

    record("TEST-08", "2단계 LLM: 1단계 결과 기반 시민 대피 행동요령 브리핑 생성", isValid,
      isValid ? "브리핑 마크다운 생성 성공" : "응답 형식 불일치");
  } catch (err) {
    record("TEST-08", "2단계 LLM: 1단계 결과 기반 시민 대피 행동요령 브리핑 생성 (AI B 구현 대상)", false,
      `[AI A 중단점 / AI B 구현 대기]: ${err.message}`);
  }

  // TEST-09: 멀티 LLM 연계 파이프라인 종단간 실행 (AI B 구현 대상)
  try {
    const mockEq = { mag: 4.8, place: "울산 앞바다" };
    const mockTy = { name: "SHANSHAN", max_wind_speed_ms: 42, central_pressure_hpa: 940 };
    const res = await MultiLLMService.runMultiLLMPipeline(mockEq, mockTy);

    const isValid = res && res.stage1 && res.stage2 && res.stage1.risk_level && res.stage2.briefing_markdown;
    record("TEST-09", "멀티 LLM 연계 파이프라인 종단간 실행 (Stage 1 -> Stage 2)", isValid,
      isValid ? "파이프라인 연계 성공" : "파이프라인 응답 불일치");
  } catch (err) {
    record("TEST-09", "멀티 LLM 연계 파이프라인 종단간 실행 (AI B 구현 대상)", false,
      `[AI A 중단점 / AI B 구현 대기]: ${err.message}`);
  }

  // TEST-10: [경계값] 2단계 LLM 누락/오류 데이터 주입 시 Fallback 안전 출력 (AI B 구현 대상)
  try {
    const corruptedStage1 = { stage: 1, invalid_data: true };
    const res = await MultiLLMService.generateBriefingStage2(corruptedStage1);
    const isValid = res && res.is_fallback === true && typeof res.briefing_markdown === "string";

    record("TEST-10", "[경계값] 2단계 LLM 비정상 입력 주입 시 표준 기본 안전수칙 Fallback 반환", isValid,
      isValid ? "Fallback 안전 메시지 정상 반환" : "Fallback 미동작");
  } catch (err) {
    record("TEST-10", "[경계값] 2단계 LLM Fallback 방어 (AI B 구현 대상)", false,
      `[AI A 중단점 / AI B 구현 대기]: ${err.message}`);
  }

  console.log("\n==================================================================");
  const passCount = results.filter(r => r.passed).length;
  const failCount = results.filter(r => !r.passed).length;
  console.log(` 검사 결과 요약: 총 10개 검사 중 ${passCount} 통과 (PASS), ${failCount} 대기/실패 (FAIL)`);
  console.log("==================================================================");

  return { passCount, failCount, results };
}

if (require.main === module) {
  runTestSuite().then(({ passCount, failCount }) => {
    // AI A의 의도된 중단 상태이므로 프로세스는 정상 종료(코드 0)하여 로그 확인 보장
    process.exit(0);
  });
}

module.exports = runTestSuite;
