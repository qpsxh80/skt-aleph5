/**
 * typhoon-service.js
 * 과제 5: 지진·태풍 복합 재난 관제 시스템 - 태풍 데이터 및 지리 계산 모듈
 * 브라우저 및 Node.js 환경 동시 지원 (Universal Module)
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.TyphoonService = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // 기본 활성 태풍 결정론 데이터 (오프라인 및 무인증 T05-C38 100% 호환)
  const DEFAULT_ACTIVE_TYPHOONS = [
    {
      id: "TY-2026-01",
      name: "SHANSHAN (산산)",
      intl_number: "2601",
      category: "TY",
      status: "ACTIVE",
      central_pressure_hpa: 945,
      max_wind_speed_ms: 45,
      wind_radius_km: 320,
      current_pos: {
        lon: 130.5,
        lat: 28.2
      },
      forecast_track: [
        { lon: 129.2, lat: 25.1, time: "2026-11-19T00:00:00Z", stage: "past" },
        { lon: 130.0, lat: 26.8, time: "2026-11-19T12:00:00Z", stage: "past" },
        { lon: 130.5, lat: 28.2, time: "2026-11-20T00:00:00Z", stage: "current" },
        { lon: 131.2, lat: 31.0, time: "2026-11-20T12:00:00Z", stage: "forecast" },
        { lon: 132.8, lat: 33.5, time: "2026-11-21T00:00:00Z", stage: "forecast" },
        { lon: 135.0, lat: 35.8, time: "2026-11-21T12:00:00Z", stage: "forecast" }
      ],
      updated_at: "2026-11-20T12:00:00Z"
    }
  ];

  let currentDataset = JSON.parse(JSON.stringify(DEFAULT_ACTIVE_TYPHOONS));
  let isLayerVisible = true;

  /**
   * TEST-01: 활성 태풍 목록 조회
   * @param {Array|null} customData 모의/경계값 테스트용 주입 데이터
   * @returns {Promise<{ status: number, data: Array }>}
   */
  async function fetchActiveTyphoons(customData = null) {
    if (customData !== null) {
      currentDataset = customData;
    }
    return {
      status: 200,
      count: currentDataset.length,
      data: JSON.parse(JSON.stringify(currentDataset))
    };
  }

  /**
   * TEST-02: 태풍 영향 반경 및 3D 구체 투영용 지리 데이터 계산
   * @param {number} maxWindSpeedMs 최대 풍속 (m/s)
   * @param {number} radiusKm 영향 반경 (km)
   * @returns {{ radius_km: number, wind_speed_ms: number, intensity_grade: string, arc_degrees: number }}
   */
  function calculateImpactRadius(maxWindSpeedMs, radiusKm) {
    const wind = Math.max(0, Number(maxWindSpeedMs) || 0);
    const radius = Math.max(0, Number(radiusKm) || 0);

    // 지구 반지름 약 6,371km 기준 대원각(Great Circle Arc) 각도 계산
    const EARTH_RADIUS_KM = 6371.0;
    const arcDegrees = (radius / EARTH_RADIUS_KM) * (180 / Math.PI);

    let intensityGrade = "보통";
    if (wind >= 44) {
      intensityGrade = "매우 강";
    } else if (wind >= 33) {
      intensityGrade = "강";
    } else if (wind >= 25) {
      intensityGrade = "중";
    }

    return {
      radius_km: radius,
      wind_speed_ms: wind,
      intensity_grade: intensityGrade,
      arc_degrees: parseFloat(arcDegrees.toFixed(3))
    };
  }

  /**
   * TEST-03: 레이어 가시성 토글 및 상태 확인
   */
  function setTyphoonLayerVisibility(visible) {
    isLayerVisible = Boolean(visible);
    return isLayerVisible;
  }

  function getTyphoonLayerVisibility() {
    return isLayerVisible;
  }

  /**
   * 데이터 리셋 (기본값 복구)
   */
  function resetTyphoonData() {
    currentDataset = JSON.parse(JSON.stringify(DEFAULT_ACTIVE_TYPHOONS));
    isLayerVisible = true;
    return currentDataset;
  }

  return {
    fetchActiveTyphoons,
    calculateImpactRadius,
    setTyphoonLayerVisibility,
    getTyphoonLayerVisibility,
    resetTyphoonData,
    DEFAULT_ACTIVE_TYPHOONS
  };
});
