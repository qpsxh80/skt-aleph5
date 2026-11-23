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
   * 2단계 LLM: 맞춤 대피 행동요령 브리핑 생성 (AI B 구현)
   * TEST-08: 1단계 JSON 전달 시 대피 요령/수칙 텍스트 생성
   * TEST-09: 파이프라인 연계 (Stage 1 -> Stage 2)
   * TEST-10: 1단계 누락/오류 시 예외 없이 Fallback 반환
   *
   * @param {Object} stage1Result analyzeRiskStage1 의 반환 객체
   * @returns {Promise<Object>}
   */
  const VALID_RISK_LEVELS = ["관심", "주의", "경보", "심각"];

  // 등급별 기본 행동 수칙
  const LEVEL_GUIDELINES = {
    "심각": [
      "즉시 대피 준비를 마치고, 지자체 대피 명령이 내려지면 지체 없이 지정 대피소로 이동하십시오.",
      "해안가·급경사지·산사태 위험 지역 및 반지하 주택에 계신 분은 지금 바로 안전한 곳으로 이동하십시오."
    ],
    "경보": [
      "대피 경로와 가까운 대피소 위치를 확인하고 비상용품(손전등, 비상식량, 상비약)을 챙기십시오.",
      "불필요한 외출을 삼가고 재난 문자와 방송을 계속 확인하십시오."
    ],
    "주의": [
      "기상 및 지진 정보를 수시로 확인하고 가족과 비상 연락 방법을 점검하십시오.",
      "베란다 화분, 간판 등 바람에 날릴 수 있는 물건을 미리 고정하십시오."
    ],
    "관심": [
      "평소 안전 점검 상태를 유지하고 기상 예보를 모니터링하십시오."
    ]
  };

  // 위협 키워드별 맞춤 행동 수칙 (1단계 primary_threats / summary 텍스트 기반)
  const THREAT_RULES = [
    {
      keywords: ["지진", "여진", "낙하물", "흔들림", "균열", "건축물"],
      guidelines: [
        "지진 직후이므로 엘리베이터 대신 계단을 이용해 넓은 공터로 대피하십시오.",
        "여진에 대비해 낙하물(유리, 간판, 외벽)이 있는 건물 주변을 피하고 머리를 보호하십시오.",
        "가스 밸브와 전기 차단기를 잠근 뒤 대피하고, 균열이 생긴 건물에는 다시 들어가지 마십시오."
      ]
    },
    {
      keywords: ["태풍", "강풍", "간판", "비산", "월파", "풍압"],
      guidelines: [
        "태풍 중심 통과 시까지 간판 탈락 및 비산물에 주의하여 실내 안전 지대에 머무르십시오.",
        "창문에서 떨어져 있고, 유리창은 테이프나 젖은 신문지로 보강하십시오.",
        "해안가·방파제·저지대 접근을 금지하고, 월파 위험 시 즉시 내륙 고지대로 이동하십시오."
      ]
    },
    {
      keywords: ["산사태", "급경사", "사면", "토사"],
      guidelines: [
        "산사태 위험 지역(급경사지, 옹벽 아래)에서는 즉시 벗어나 튼튼한 건물의 높은 층이나 지정 대피소로 이동하십시오.",
        "지반이 약해진 상태이므로 비탈면에서 물이 샘솟거나 흙탕물이 나오면 바로 대피하십시오."
      ]
    },
    {
      keywords: ["침수", "호우", "범람", "해일"],
      guidelines: [
        "침수 우려 지역은 차량·지하 공간 이용을 중단하고 높은 곳으로 이동하십시오.",
        "물에 잠긴 도로와 하천변은 접근하지 말고, 전기 설비는 만지지 마십시오."
      ]
    }
  ];

  const FALLBACK_BRIEFING = {
    briefing_markdown: "### [안전 유의 기본 안내]\n기상 특보 및 지진 발생 시 국민행동요령을 준수하십시오.",
    evacuation_guidelines: ["기본 안전 수칙을 준수하십시오."]
  };

  function buildFallbackStage2(reason) {
    return {
      stage: 2,
      model: "Stage2-ActionAdvisor (Fallback)",
      is_fallback: true,
      fallback_reason: reason,
      timestamp: new Date().toISOString(),
      briefing_markdown: FALLBACK_BRIEFING.briefing_markdown,
      evacuation_guidelines: FALLBACK_BRIEFING.evacuation_guidelines.slice()
    };
  }

  /** 1단계 결과가 2단계 처리에 필요한 필수 필드를 갖췄는지 검증. 문제가 있으면 사유 문자열 반환. */
  function validateStage1(s1) {
    if (s1 === null || s1 === undefined) return "stage1Result 누락";
    if (typeof s1 !== "object" || Array.isArray(s1)) return "stage1Result 형식 오류";
    if (typeof s1.risk_level !== "string" || !VALID_RISK_LEVELS.includes(s1.risk_level)) {
      return "risk_level 누락 또는 알 수 없는 값";
    }
    if (typeof s1.summary !== "string" || s1.summary.trim() === "") return "summary 누락";
    if (!Array.isArray(s1.primary_threats) || s1.primary_threats.length === 0) {
      return "primary_threats 누락";
    }
    return null;
  }

  async function generateBriefingStage2(stage1Result) {
    try {
      const problem = validateStage1(stage1Result);
      if (problem) return buildFallbackStage2(problem);

      const level = stage1Result.risk_level;
      const summary = stage1Result.summary.trim();
      const threats = stage1Result.primary_threats.map((t) => String(t));
      const score = Number.isFinite(Number(stage1Result.compound_score))
        ? Number(stage1Result.compound_score)
        : null;

      // 위협 텍스트에서 해당하는 맞춤 수칙 선택 (등급 기본 수칙 + 위협별 수칙, 중복 제거)
      const threatText = threats.join(" ");
      const guidelines = [];
      const pushUnique = (g) => { if (!guidelines.includes(g)) guidelines.push(g); };

      for (const rule of THREAT_RULES) {
        if (rule.keywords.some((k) => threatText.includes(k))) {
          rule.guidelines.forEach(pushUnique);
        }
      }
      LEVEL_GUIDELINES[level].forEach(pushUnique);

      // 위협 키워드가 매칭되지 않은 경우에도 최소 한 개 이상의 수칙 보장
      if (guidelines.length === 0) {
        FALLBACK_BRIEFING.evacuation_guidelines.forEach(pushUnique);
      }

      const scoreText = score !== null ? ` (복합 위험도 ${score}점)` : "";
      const briefingMarkdown = [
        "### [재난 대응 긴급 브리핑]",
        `현재 위험 등급: **${level}**${scoreText}`,
        "",
        `**상황 요약**: ${summary}`,
        "",
        "**주요 위협**",
        ...threats.map((t) => `- ${t}`),
        "",
        "**대피 행동요령**",
        ...guidelines.map((g, i) => `${i + 1}. ${g}`)
      ].join("\n");

      return {
        stage: 2,
        model: "Stage2-ActionAdvisor",
        is_fallback: false,
        timestamp: new Date().toISOString(),
        risk_level: level,
        briefing_markdown: briefingMarkdown,
        evacuation_guidelines: guidelines
      };
    } catch (err) {
      // 어떤 예기치 못한 오류에서도 예외를 던지지 않고 안전 수칙 반환
      return buildFallbackStage2("처리 중 오류: " + (err && err.message ? err.message : "unknown"));
    }
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
