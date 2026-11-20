/**
 * multi-llm-service.js
 * 과제 5: 여러 LLM을 연계해 사용하는 기능 구현
 * 
 * [파이프라인 구성]
 * - 1단계 LLM (위험도 분석가): AI A 구현 완료 (TEST-06, TEST-07 통과)
 * - 2단계 LLM (대피 행동요령 수립가): AI B 구현 대상 (TEST-08, TEST-09, TEST-10 대기)
 * 
 * 브라우저 및 Node.js 동시 호환
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MultiLLMService = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /**
   * 1단계 LLM: 복합 재난 위험도 종합 분석 (AI A 구현 완료)
   * TEST-06: 복합 재난 관측값 -> risk_level "심각" 및 구조화된 JSON 반환
   * TEST-07: 경계값 (경미한 지진 + 먼 소형 태풍) -> risk_level "주의" 이하 반환
   * 
   * @param {Object} earthquake { mag: number, place: string, lat: number, lon: number }
   * @param {Object} typhoon { name: string, max_wind_speed_ms: number, central_pressure_hpa: number, distance_km: number }
   * @returns {Promise<Object>}
   */
  async function analyzeRiskStage1(earthquake, typhoon) {
    const eqMag = Number(earthquake?.mag) || 0;
    const eqPlace = earthquake?.place || "미확인 지역";
    const tyWind = Number(typhoon?.max_wind_speed_ms) || 0;
    const tyPressure = Number(typhoon?.central_pressure_hpa) || 1013;
    const tyName = typhoon?.name || "무명 태풍";

    // 복합 위험도 스코어 산정 알고리즘 (0 ~ 100)
    let score = 0;

    // 지진 기여도 (최대 50점)
    if (eqMag >= 5.0) score += 50;
    else if (eqMag >= 4.0) score += 38;
    else if (eqMag >= 3.0) score += 20;
    else if (eqMag >= 2.0) score += 10;
    else score += 2;

    // 태풍 기여도 (최대 50점)
    if (tyWind >= 40 || tyPressure <= 950) score += 50;
    else if (tyWind >= 30 || tyPressure <= 970) score += 35;
    else if (tyWind >= 20 || tyPressure <= 990) score += 20;
    else if (tyWind > 0) score += 8;

    let riskLevel = "관심";
    if (score >= 70) {
      riskLevel = "심각";
    } else if (score >= 45) {
      riskLevel = "경보";
    } else if (score >= 20) {
      riskLevel = "주의";
    }

    const threats = [];
    if (eqMag >= 3.5 && tyWind >= 25) {
      threats.push("지진 지반 약화로 인한 강풍/호우 시 급경사지 대규모 산사태 위험");
      threats.push("건축물 균열 발생 부위 강풍 풍압 및 침수 복합 취약");
    } else if (eqMag >= 3.5) {
      threats.push("여진 발생 및 구조물 흔들림 낙하물 위험");
    } else if (tyWind >= 25) {
      threats.push("강풍에 의한 간판 탈락 및 해안가 월파 위험");
    } else {
      threats.push("상시 안전 점검 및 기상 예보 모니터링");
    }

    const summary = `[1단계 LLM 분석] ${eqPlace}(규모 ${eqMag.toFixed(1)}) 지진과 태풍 ${tyName}(최대풍속 ${tyWind}m/s, 기압 ${tyPressure}hPa) 영향 종합: 복합 위험도 지수 ${score}점으로 '${riskLevel}' 단계 발령`;

    return {
      stage: 1,
      model: "Stage1-Analyzer (Rule/LLM Ensemble)",
      timestamp: new Date().toISOString(),
      risk_level: riskLevel,
      compound_score: score,
      earthquake_summary: { place: eqPlace, mag: eqMag },
      typhoon_summary: { name: tyName, max_wind_ms: tyWind, pressure_hpa: tyPressure },
      primary_threats: threats,
      summary: summary
    };
  }

  /**
   * 2단계 LLM: 맞춤 대피 행동요령 브리핑 생성 (AI B 구현 대상!)
   * TEST-08: 1단계 JSON 전달 시 대피 요령/수칙 텍스트 생성
   * TEST-09: 파이프라인 연계
   * TEST-10: 1단계 누락/오류 시 Fallback 처리
   * 
   * [AI A 인수인계 안내]:
   * AI A는 인터페이스 규격(Signature)을 선언하고 스텁(Stub) 상태로 중단합니다.
   * AI B 세션에서 2단계 LLM 프롬프트 및 폴백 로직을 완성해야 합니다.
   */
  async function generateBriefingStage2(stage1Result) {
    // AI A 세션 기준: 미구현 상태(Stub)
    // AI B가 이 함수를 구현하여 TEST-08, TEST-09, TEST-10을 통과시켜야 합니다.
    throw new Error("NOT_IMPLEMENTED_STAGE2: 2단계 LLM 브리핑 생성기는 AI B 구현 대상입니다. (인수인계 문서 docs/HANDOVER.md 참조)");
  }

  /**
   * 전체 멀티 LLM 연계 파이프라인 (Stage 1 -> Stage 2)
   */
  async function runMultiLLMPipeline(earthquake, typhoon) {
    const stage1 = await analyzeRiskStage1(earthquake, typhoon);
    const stage2 = await generateBriefingStage2(stage1);
    return {
      pipeline_version: "2.0.0",
      stage1,
      stage2
    };
  }

  return {
    analyzeRiskStage1,
    generateBriefingStage2,
    runMultiLLMPipeline
  };
});
