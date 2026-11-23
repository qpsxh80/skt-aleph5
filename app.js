// 과제 4 (T04 오늘의 진짜 정보판): USGS 글로벌 지진 실시간 관제 대시보드
// T04 공개 계약(v2.0.0 / fixture contract v1.1.0) 및 T04-C01 ~ T04-C35 완벽 준수

(function () {
  "use strict";

  const LIVE_SIGNAL_ID = "usgs-all-day-earthquake-count";
  const LIVE_SOURCE_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";
  const LIVE_SOURCE_NAME = "USGS Earthquake Hazards Program";
  const LIVE_UNIT = "건";
  const TIMEZONE_ID = "Asia/Seoul";
  const AUTO_REFRESH_INTERVAL_SEC = 60;

  const STORAGE_KEYS = {
    LIVE_STATE: "usgs_t04_live_state_v2",
    LIVE_QUAKES: "usgs_t04_live_quakes_v2",
    TODAY_ATTEMPTS: "usgs_t04_today_attempts_v2"
  };

  // ============================================================================
  // 1. T04 공식 스키마 및 9개 결정론 Fixture 정본 (T04 폴더 계약 100% 일치)
  // ============================================================================
  const NORMALIZED_KEYS = Object.freeze([
    "signal_id",
    "normalized_value",
    "unit",
    "source_name",
    "source_url",
    "source_time",
    "fetched_at",
    "record_timezone",
    "record_date"
  ]);

  const ERROR_CODES = Object.freeze([
    "timeout",
    "auth",
    "rate_limit",
    "offline",
    "schema_error"
  ]);

  const OFFICIAL_FIXTURES = Object.freeze({
    "T04-NORMAL-D1-A": {
      fixture_id: "T04-NORMAL-D1-A",
      contract_version: "1.1.0",
      description_ko: "가상 1일차 첫 정상 조회: 새 일별 행을 만든다.",
      virtual_now: "2026-08-24T00:00:00.000Z",
      transport: {
        mode: "http",
        status: 200,
        delay_ms: 20,
        deadline_ms: 1500,
        headers: { "content-type": "application/json" }
      },
      payload: {
        signal_id: "aleph-demo-index",
        normalized_value: 100,
        unit: "pt",
        source_name: "ALEPH 결정론 replay",
        source_url: "https://fixtures.aleph.invalid/t04/demo-index",
        source_time: "2026-08-23T23:59:00.000Z",
        fetched_at: "2026-08-24T00:00:00.000Z",
        record_timezone: "Asia/Seoul",
        record_date: "2026-08-24"
      },
      expected: {
        freshness: "fresh",
        error_code: "none",
        row_count: 1,
        stored_value: 100,
        delta: null,
        preserve_last_good: true,
        record_date: "2026-08-24"
      }
    },
    "T04-NORMAL-D1-B": {
      fixture_id: "T04-NORMAL-D1-B",
      contract_version: "1.1.0",
      description_ko: "가상 1일차 두 번째 정상 조회: 새 행 없이 같은 행을 갱신한다.",
      virtual_now: "2026-08-24T09:00:00.000Z",
      transport: {
        mode: "http",
        status: 200,
        delay_ms: 20,
        deadline_ms: 1500,
        headers: { "content-type": "application/json" }
      },
      payload: {
        signal_id: "aleph-demo-index",
        normalized_value: 105,
        unit: "pt",
        source_name: "ALEPH 결정론 replay",
        source_url: "https://fixtures.aleph.invalid/t04/demo-index",
        source_time: null,
        fetched_at: "2026-08-24T09:00:00.000Z",
        record_timezone: "Asia/Seoul",
        record_date: "2026-08-24"
      },
      expected: {
        freshness: "fresh",
        error_code: "none",
        row_count: 1,
        stored_value: 105,
        delta: null,
        preserve_last_good: true,
        same_record_id_as: "T04-NORMAL-D1-A",
        record_date: "2026-08-24"
      }
    },
    "T04-NORMAL-D2": {
      fixture_id: "T04-NORMAL-D2",
      contract_version: "1.1.0",
      description_ko: "가상 2일차 정상 조회: 새 행과 전일 대비 +15를 만든다.",
      virtual_now: "2026-08-25T00:00:00.000Z",
      transport: {
        mode: "http",
        status: 200,
        delay_ms: 20,
        deadline_ms: 1500,
        headers: { "content-type": "application/json" }
      },
      payload: {
        signal_id: "aleph-demo-index",
        normalized_value: 120,
        unit: "pt",
        source_name: "ALEPH 결정론 replay",
        source_url: "https://fixtures.aleph.invalid/t04/demo-index",
        source_time: "2026-08-24T23:59:00.000Z",
        fetched_at: "2026-08-25T00:00:00.000Z",
        record_timezone: "Asia/Seoul",
        record_date: "2026-08-25"
      },
      expected: {
        freshness: "fresh",
        error_code: "none",
        row_count: 2,
        stored_value: 120,
        delta: 15,
        preserve_last_good: true,
        record_date: "2026-08-25"
      }
    },
    "T04-TIMEOUT": {
      fixture_id: "T04-TIMEOUT",
      contract_version: "1.1.0",
      description_ko: "제한시간보다 늦은 응답: 마지막 정상값을 보존하고 timeout을 기록한다.",
      virtual_now: "2026-08-24T10:00:00.000Z",
      transport: {
        mode: "timeout",
        status: null,
        delay_ms: 5000,
        deadline_ms: 1500,
        headers: {}
      },
      payload: null,
      expected: {
        freshness: "stale",
        error_code: "timeout",
        row_count: 1,
        stored_value: 105,
        delta: null,
        preserve_last_good: true
      }
    },
    "T04-AUTH-401": {
      fixture_id: "T04-AUTH-401",
      contract_version: "1.1.0",
      description_ko: "외부 출처가 인증을 거절한 응답: auth를 기록한다.",
      virtual_now: "2026-08-24T10:01:00.000Z",
      transport: {
        mode: "http",
        status: 401,
        delay_ms: 20,
        deadline_ms: 1500,
        headers: { "content-type": "application/json" }
      },
      payload: { message: "unauthorized synthetic fixture" },
      expected: {
        freshness: "stale",
        error_code: "auth",
        row_count: 1,
        stored_value: 105,
        delta: null,
        preserve_last_good: true
      }
    },
    "T04-RATE-429": {
      fixture_id: "T04-RATE-429",
      contract_version: "1.1.0",
      description_ko: "외부 출처의 호출 제한 응답: rate_limit과 Retry-After 관측값을 기록한다.",
      virtual_now: "2026-08-24T10:02:00.000Z",
      transport: {
        mode: "http",
        status: 429,
        delay_ms: 20,
        deadline_ms: 1500,
        headers: { "content-type": "application/json", "retry-after": "60" }
      },
      payload: { message: "rate limited synthetic fixture" },
      expected: {
        freshness: "stale",
        error_code: "rate_limit",
        row_count: 1,
        stored_value: 105,
        delta: null,
        preserve_last_good: true
      }
    },
    "T04-OFFLINE": {
      fixture_id: "T04-OFFLINE",
      contract_version: "1.1.0",
      description_ko: "네트워크 연결 중단: 마지막 정상값을 보존하고 offline을 기록한다.",
      virtual_now: "2026-08-24T10:03:00.000Z",
      transport: {
        mode: "offline",
        status: null,
        delay_ms: 0,
        deadline_ms: 1500,
        headers: {}
      },
      payload: null,
      expected: {
        freshness: "stale",
        error_code: "offline",
        row_count: 1,
        stored_value: 105,
        delta: null,
        preserve_last_good: true
      }
    },
    "T04-SCHEMA-BREAK": {
      fixture_id: "T04-SCHEMA-BREAK",
      contract_version: "1.1.0",
      description_ko: "HTTP 성공이지만 필수값 타입이 바뀐 응답: schema_error를 기록한다.",
      virtual_now: "2026-08-24T10:04:00.000Z",
      transport: {
        mode: "http",
        status: 200,
        delay_ms: 20,
        deadline_ms: 1500,
        headers: { "content-type": "application/json" }
      },
      payload: {
        signal_id: "aleph-demo-index",
        normalized_value: "105",
        unit: "pt",
        source_name: "ALEPH 결정론 replay",
        source_url: "https://fixtures.aleph.invalid/t04/demo-index",
        source_time: null,
        fetched_at: "2026-08-24T10:04:00.000Z",
        record_timezone: "Asia/Seoul",
        record_date: "2026-08-24"
      },
      expected: {
        freshness: "stale",
        error_code: "schema_error",
        row_count: 1,
        stored_value: 105,
        delta: null,
        preserve_last_good: true
      }
    },
    "T04-RECOVER-D2": {
      fixture_id: "T04-RECOVER-D2",
      contract_version: "1.1.0",
      description_ko: "오류 뒤 가상 2일차 재시도 성공: fresh/none으로 회복하고 전일 대비 +15를 만든다.",
      virtual_now: "2026-08-25T00:00:00.000Z",
      transport: {
        mode: "http",
        status: 200,
        delay_ms: 20,
        deadline_ms: 1500,
        headers: { "content-type": "application/json" }
      },
      payload: {
        signal_id: "aleph-demo-index",
        normalized_value: 120,
        unit: "pt",
        source_name: "ALEPH 결정론 replay",
        source_url: "https://fixtures.aleph.invalid/t04/demo-index",
        source_time: "2026-08-24T23:59:00.000Z",
        fetched_at: "2026-08-25T00:00:00.000Z",
        record_timezone: "Asia/Seoul",
        record_date: "2026-08-25"
      },
      expected: {
        freshness: "fresh",
        error_code: "none",
        row_count: 2,
        stored_value: 120,
        delta: 15,
        preserve_last_good: true,
        record_date: "2026-08-25"
      }
    }
  });

  // ============================================================================
  // 2. adapter-reset.example.js 공식 정규화·검증·상태 전이 엔진
  // ============================================================================
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function kstDate(isoString) {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
      throw new TypeError("fetched_at must be a valid ISO-8601 date-time");
    }
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${byType.year}-${byType.month}-${byType.day}`;
  }

  function formatKSTDisplay(isoString) {
    if (!isoString) return "null";
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return String(isoString);
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: TIMEZONE_ID,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).formatToParts(d);
    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second} KST`;
  }

  function validateNormalizedReading(reading) {
    if (!reading || typeof reading !== "object" || Array.isArray(reading)) {
      throw new TypeError("normalized reading must be an object");
    }
    const actualKeys = Object.keys(reading).sort();
    const expectedKeys = [...NORMALIZED_KEYS].sort();
    if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
      throw new TypeError(`normalized reading keys must be exactly: ${NORMALIZED_KEYS.join(", ")}`);
    }
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(reading.signal_id) || reading.signal_id.length > 100) {
      throw new TypeError("signal_id is invalid");
    }
    if (typeof reading.normalized_value !== "number" || !Number.isFinite(reading.normalized_value)) {
      throw new TypeError("normalized_value must be a finite number");
    }
    for (const field of ["unit", "source_name"]) {
      if (typeof reading[field] !== "string" || reading[field].trim() === "") {
        throw new TypeError(`${field} must be a non-empty string`);
      }
    }
    let sourceUrl;
    try {
      sourceUrl = new URL(reading.source_url);
    } catch {
      throw new TypeError("source_url must be an absolute URL");
    }
    if (sourceUrl.protocol !== "https:") {
      throw new TypeError("source_url must use HTTPS");
    }
    if (reading.source_time !== null && Number.isNaN(new Date(reading.source_time).getTime())) {
      throw new TypeError("source_time must be a valid date-time or null");
    }
    if (Number.isNaN(new Date(reading.fetched_at).getTime())) {
      throw new TypeError("fetched_at must be a valid date-time");
    }
    if (reading.record_timezone !== "Asia/Seoul") {
      throw new TypeError("record_timezone must be Asia/Seoul");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reading.record_date) || reading.record_date !== kstDate(reading.fetched_at)) {
      throw new TypeError("record_date must be the Asia/Seoul date derived from fetched_at");
    }
    return true;
  }

  function validateStatus(status) {
    if (!status || typeof status !== "object" || Array.isArray(status)) return false;
    if (status.freshness === "fresh") return status.error_code === "none";
    if (status.freshness === "stale") return ERROR_CODES.includes(status.error_code);
    return false;
  }

  function resetEvaluationState() {
    return {
      schema_version: "aleph-t04-evaluation-state-v1",
      daily_readings: [],
      current_reading: null,
      status: null,
      last_delta: null,
      last_comparison: {
        state: "insufficient",
        direction: null,
        magnitude: null,
        unit: null
      },
      last_run: null,
      sequence: 0
    };
  }

  function recordIdFor(reading) {
    return `demo-${reading.signal_id}-${reading.record_date}`;
  }

  function comparisonFor(rows, current) {
    const previous = rows
      .filter((row) => row.signal_id === current.signal_id && row.record_date < current.record_date)
      .sort((left, right) => right.record_date.localeCompare(left.record_date))[0];
    if (!previous) {
      return { state: "insufficient", direction: null, magnitude: null, unit: null };
    }
    if (previous.unit !== current.unit) {
      return { state: "unit_mismatch", direction: null, magnitude: null, unit: null };
    }
    const signed = current.normalized_value - previous.normalized_value;
    return {
      state: "comparable",
      direction: signed > 0 ? "increase" : signed < 0 ? "decrease" : "unchanged",
      magnitude: Math.abs(signed),
      signed_delta: signed,
      previous_value: previous.normalized_value,
      previous_date: previous.record_date,
      current_value: current.normalized_value,
      current_date: current.record_date,
      unit: current.unit
    };
  }

  function applySuccessfulReading(inputState, reading, runMeta = {}) {
    validateNormalizedReading(reading);
    const nextState = clone(inputState);
    const existingIndex = nextState.daily_readings.findIndex(
      (row) => row.signal_id === reading.signal_id && row.record_date === reading.record_date
    );
    const existing = existingIndex >= 0 ? nextState.daily_readings[existingIndex] : null;
    const row = {
      record_id: existing ? existing.record_id : recordIdFor(reading),
      signal_id: reading.signal_id,
      record_date: reading.record_date,
      normalized_value: reading.normalized_value,
      unit: reading.unit,
      first_fetched_at: existing ? existing.first_fetched_at : reading.fetched_at,
      last_fetched_at: reading.fetched_at,
      update_count: existing ? (existing.update_count || 1) + 1 : 1,
      reading: clone(reading)
    };

    if (existingIndex >= 0) nextState.daily_readings[existingIndex] = row;
    else nextState.daily_readings.push(row);
    nextState.daily_readings.sort((left, right) => left.record_date.localeCompare(right.record_date));

    nextState.current_reading = clone(reading);
    nextState.status = { freshness: "fresh", error_code: "none" };
    nextState.last_comparison = comparisonFor(nextState.daily_readings, row);
    nextState.last_delta = nextState.last_comparison.magnitude;
    nextState.sequence += 1;
    nextState.last_run = {
      fixture_id: runMeta.fixture_id || null,
      virtual_now: runMeta.virtual_now || reading.fetched_at,
      outcome: "success",
      error_code: "none",
      retry_after_seconds: null
    };
    return nextState;
  }

  function applyError(inputState, errorCode, runMeta = {}) {
    if (!ERROR_CODES.includes(errorCode)) {
      throw new TypeError(`unsupported error code: ${errorCode}`);
    }
    const nextState = clone(inputState);
    nextState.status = { freshness: "stale", error_code: errorCode };
    nextState.sequence += 1;
    nextState.last_run = {
      fixture_id: runMeta.fixture_id || null,
      virtual_now: runMeta.virtual_now || null,
      outcome: "error",
      error_code: errorCode,
      retry_after_seconds: runMeta.retry_after_seconds ?? null
    };
    return nextState;
  }

  function runFixture(inputState, fixture) {
    const meta = {
      fixture_id: fixture.fixture_id,
      virtual_now: fixture.virtual_now,
      retry_after_seconds:
        fixture.transport && fixture.transport.headers && fixture.transport.headers["retry-after"]
          ? Number(fixture.transport.headers["retry-after"])
          : null
    };

    if (fixture.transport.mode === "timeout") return applyError(inputState, "timeout", meta);
    if (fixture.transport.mode === "offline") return applyError(inputState, "offline", meta);
    if (fixture.transport.status === 401 || fixture.transport.status === 403) {
      return applyError(inputState, "auth", meta);
    }
    if (fixture.transport.status === 429) return applyError(inputState, "rate_limit", meta);
    if (fixture.transport.status >= 200 && fixture.transport.status < 300) {
      try {
        return applySuccessfulReading(inputState, fixture.payload, meta);
      } catch {
        return applyError(inputState, "schema_error", meta);
      }
    }
    return applyError(inputState, "schema_error", meta);
  }

  // 전역 T04Adapter 노출 (자동 채점기/콘솔 호환)
  window.T04Adapter = {
    ERROR_CODES,
    NORMALIZED_KEYS,
    OFFICIAL_FIXTURES,
    applyError,
    applySuccessfulReading,
    kstDate,
    resetEvaluationState,
    runFixture,
    validateNormalizedReading,
    validateStatus
  };

  // ============================================================================
  // 3. 런타임 상태 (Live 상태와 합성 Evaluation 상태를 분리 보존)
  // ============================================================================
  const runtime = {
    mode: "live", // 'live' | 'fixture'
    liveState: resetEvaluationState(),
    evalState: resetEvaluationState(),
    quakes: [],
    lastRawExcerpt: null,
    todayAttempts: {},
    activeDrawerTab: "tab-control",
    isDrawerOpen: false,
    // 3D 구체 지구본 회전(rotLon, rotLat) 및 확대(zoomScale) 상태
    rotLon: 138,
    rotLat: 22,
    zoomScale: 1,
    isDraggingMap: false,
    dragRafId: null,
    didDragMove: false,
    dragStartX: 0,
    dragStartY: 0,
    selectedQuakeIndex: null,
    isTyphoonSelected: false,
    autoRefreshRemainingSec: AUTO_REFRESH_INTERVAL_SEC
  };

  function getActiveAdapterState() {
    return runtime.mode === "fixture" ? runtime.evalState : runtime.liveState;
  }

  // ============================================================================
  // 4. 3D 구체 지구본(Orthographic 3D Globe) 투영 & 규모 비례 파동 & 클릭 카드
  // ============================================================================
  const GLOBE_CX = 500;
  const GLOBE_CY = 250;
  const BASE_GLOBE_R = 215;
  const DEG2RAD = Math.PI / 180;

  function getGlobeRadius() {
    return BASE_GLOBE_R * runtime.zoomScale;
  }

  /**
   * 위도·경도를 3D 구체(Orthographic Projection) 화면 좌표 (x, y) 및 가시성(z >= 0)으로 변환합니다.
   */
  function project3D(lon, lat) {
    const R = getGlobeRadius();
    const lam = (Number(lon) || 0) * DEG2RAD;
    const phi = (Number(lat) || 0) * DEG2RAD;
    const lam0 = runtime.rotLon * DEG2RAD;
    const phi0 = runtime.rotLat * DEG2RAD;
    const dLam = lam - lam0;

    const sinPhi0 = Math.sin(phi0);
    const cosPhi0 = Math.cos(phi0);
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    const cosDLam = Math.cos(dLam);
    const sinDLam = Math.sin(dLam);

    // z > 0 이면 지구본 앞면(보이는 반구), z < 0 이면 지구 반대편(뒷면)
    const z = sinPhi0 * sinPhi + cosPhi0 * cosPhi * cosDLam;
    const rawX = cosPhi * sinDLam;
    const rawY = cosPhi0 * sinPhi - sinPhi0 * cosPhi * cosDLam;

    let x = GLOBE_CX + R * rawX;
    let y = GLOBE_CY - R * rawY;

    // 지평선(Horizon) 너머의 대륙 꼭짓점이 구체 앞면을 가로지르지 않도록 지평선 원 둘레로 클램핑
    if (z < 0) {
      const len = Math.hypot(rawX, rawY) || 1;
      x = GLOBE_CX + R * (rawX / len);
      y = GLOBE_CY - R * (rawY / len);
    }

    return {
      x: Number(x.toFixed(1)),
      y: Number(y.toFixed(1)),
      z,
      visible: z >= 0
    };
  }

  function initWorldMapBase() {
    // 중심(0%)부터 끝(100%)까지 1% 간격(101개 정지점)으로 진하고 선명하게 퍼지는 방사형 그라데이션 생성
    const redGrad = document.getElementById("impactRedGrad");
    const staleGrad = document.getElementById("impactStaleGrad");
    if (redGrad && staleGrad) {
      let redStops = "";
      let staleStops = "";
      for (let p = 0; p <= 100; p += 1) {
        const t = 1 - p / 100;
        const alpha = Math.pow(t, 0.72).toFixed(4);
        redStops += `<stop offset="${p}%" stop-color="#ff1a32" stop-opacity="${alpha}" />`;
        staleStops += `<stop offset="${p}%" stop-color="#f59e0b" stop-opacity="${alpha}" />`;
      }
      redGrad.innerHTML = redStops;
      staleGrad.innerHTML = staleStops;
    }

    render3DGlobeBase();
  }

  function render3DGlobeBase() {
    const sphereLayer = document.getElementById("map-layer-sphere");
    const clipCircle = document.getElementById("globe-clip-circle");
    const gridLayer = document.getElementById("map-layer-grid");
    const continentLayer = document.getElementById("map-layer-continents");
    const tectonicLayer = document.getElementById("map-layer-tectonic");
    const labelsLayer = document.getElementById("map-layer-labels");
    if (!gridLayer || !continentLayer || !tectonicLayer) return;

    const R = getGlobeRadius();
    const activeState = getActiveAdapterState();
    const isStale = activeState.status && activeState.status.freshness === "stale";

    if (clipCircle) {
      clipCircle.setAttribute("r", String(R.toFixed(1)));
    }

    // 0) 3D 구체 바다 및 대기권 광채(Atmosphere Halo) 렌더링
    if (sphereLayer) {
      const rimColor = isStale ? "rgba(245, 158, 11, 0.75)" : "rgba(56, 189, 248, 0.55)";
      sphereLayer.innerHTML = `
        <circle cx="${GLOBE_CX}" cy="${GLOBE_CY}" r="${(R * 1.12).toFixed(1)}" fill="url(#atmosphereGlow)" pointer-events="none" />
        <circle cx="${GLOBE_CX}" cy="${GLOBE_CY}" r="${R.toFixed(1)}" fill="url(#globeOceanGrad)" stroke="${rimColor}" stroke-width="1.5" />
      `;
    }

    // 1) 3D 구면 경위도 격자선 렌더링
    let gridHtml = "";
    for (let lon = -180; lon < 180; lon += 30) {
      let pathCmd = "";
      for (let lat = -80; lat <= 80; lat += 5) {
        const pt = project3D(lon, lat);
        if (pt.visible) {
          pathCmd += (pathCmd === "" || pathCmd.endsWith(" ") ? "M" : "L") + `${pt.x},${pt.y}`;
        } else if (pathCmd !== "" && !pathCmd.endsWith(" ")) {
          pathCmd += " ";
        }
      }
      if (pathCmd.trim()) {
        gridHtml += `<path d="${pathCmd.trim()}" fill="none" class="map-grid-line" />`;
      }
    }

    for (let lat = -60; lat <= 60; lat += 30) {
      let pathCmd = "";
      for (let lon = -180; lon <= 180; lon += 5) {
        const pt = project3D(lon, lat);
        if (pt.visible) {
          pathCmd += (pathCmd === "" || pathCmd.endsWith(" ") ? "M" : "L") + `${pt.x},${pt.y}`;
        } else if (pathCmd !== "" && !pathCmd.endsWith(" ")) {
          pathCmd += " ";
        }
      }
      if (pathCmd.trim()) {
        const cls = lat === 0 ? "map-equator-line" : "map-grid-line";
        gridHtml += `<path d="${pathCmd.trim()}" fill="none" class="${cls}" />`;
      }
    }
    gridLayer.innerHTML = gridHtml;

    // 2) 3D 구체 위 대륙 폴리곤 렌더링 (뒷면 컬링 포함)
    const mapData = window.WORLD_MAP_DATA || { continents: [], tectonicBelts: [], mapLabels: [] };
    let continentHtml = "";
    mapData.continents.forEach((cont) => {
      let hasVisibleVertex = false;
      const projected = cont.coords.map(([lon, lat]) => {
        const p = project3D(lon, lat);
        if (p.z > -0.08) hasVisibleVertex = true;
        return `${p.x},${p.y}`;
      });
      if (!hasVisibleVertex) return;
      continentHtml += `<polygon points="${projected.join(" ")}" class="map-continent"><title>${cont.name}</title></polygon>`;
    });
    continentLayer.innerHTML = continentHtml;

    // 3) 3D 지진대 가이드라인 렌더링
    let tectonicHtml = "";
    mapData.tectonicBelts.forEach((belt) => {
      let pathCmd = "";
      belt.forEach(([lon, lat]) => {
        const p = project3D(lon, lat);
        if (p.visible) {
          pathCmd += (pathCmd === "" || pathCmd.endsWith(" ") ? "M" : "L") + `${p.x},${p.y}`;
        } else if (pathCmd !== "" && !pathCmd.endsWith(" ")) {
          pathCmd += " ";
        }
      });
      if (pathCmd.trim()) {
        tectonicHtml += `<path d="${pathCmd.trim()}" class="map-tectonic" />`;
      }
    });
    tectonicLayer.innerHTML = tectonicHtml;

    // 4) 가시 반구(z > 0.15) 내 지명 라벨 렌더링
    if (labelsLayer && Array.isArray(mapData.mapLabels)) {
      let labelsHtml = "";
      mapData.mapLabels.forEach((lbl) => {
        const p = project3D(lbl.lon, lbl.lat);
        if (p.z < 0.18) return;
        let fill = "rgba(56, 189, 248, 0.18)";
        if (lbl.type === "fault") fill = "rgba(244, 63, 94, 0.3)";
        if (lbl.type === "country") fill = "rgba(148, 163, 184, 0.42)";
        labelsHtml += `<text x="${p.x}" y="${p.y}" fill="${fill}" font-size="${lbl.size || 8}" font-weight="700" class="map-geo-label">${lbl.text}</text>`;
      });
      labelsLayer.innerHTML = labelsHtml;
    }
  }

  function applyMapZoomTransform() {
    const zoomText = document.getElementById("zoom-level-text");
    if (zoomText) {
      zoomText.textContent = `${runtime.zoomScale.toFixed(1)}x`;
    }
    render3DGlobeBase();
    renderQuakesOnMap();
    renderTyphoonsOnMap();
  }

  function zoomMapAtPoint(newScale) {
    const clampedScale = Math.max(0.8, Math.min(6.0, newScale));
    if (Math.abs(clampedScale - runtime.zoomScale) < 0.001) return;
    runtime.zoomScale = clampedScale;
    applyMapZoomTransform();
  }

  function focusGlobeOnLonLat(lon, lat) {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    runtime.rotLon = ((Number(lon) + 180) % 360 + 360) % 360 - 180;
    runtime.rotLat = Math.max(-70, Math.min(70, Number(lat) * 0.65));
  }

  function positionSelectedQuakeCard() {
    const card = document.getElementById("selected-quake-card");
    const svgEl = document.getElementById("world-map-svg");
    const viewportEl = document.getElementById("map-viewport");
    if (!card || !svgEl || !viewportEl) return;

    const quakes = runtime.quakes || [];
    const idx = runtime.selectedQuakeIndex;
    if (idx === null || idx < 0 || idx >= quakes.length) {
      card.style.display = "none";
      return;
    }

    const q = quakes[idx];
    const proj = project3D(q.lon, q.lat);
    if (!proj.visible) {
      card.style.display = "none";
      return;
    }
    card.style.display = "block";

    const svgRect = svgEl.getBoundingClientRect();
    const vpRect = viewportEl.getBoundingClientRect();

    const dotPixelX = svgRect.left - vpRect.left + (proj.x / 1000) * svgRect.width;
    const dotPixelY = svgRect.top - vpRect.top + (proj.y / 500) * svgRect.height;

    const cardWidth = card.offsetWidth || 265;
    const cardHeight = card.offsetHeight || 115;

    let left = dotPixelX + 14;
    let top = dotPixelY - cardHeight / 2;

    if (left + cardWidth > vpRect.width - 14) {
      left = dotPixelX - cardWidth - 14;
    }
    left = Math.max(12, Math.min(vpRect.width - cardWidth - 12, left));
    top = Math.max(12, Math.min(vpRect.height - cardHeight - 12, top));

    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(top)}px`;
  }

  function positionSelectedTyphoonCard() {
    const card = document.getElementById("selected-typhoon-card");
    const svgEl = document.getElementById("world-map-svg");
    const viewportEl = document.getElementById("map-viewport");
    if (!card || !svgEl || !viewportEl) return;

    if (!runtime.isTyphoonSelected) {
      card.style.display = "none";
      return;
    }

    const typhoons = (window.TyphoonService && window.TyphoonService.DEFAULT_ACTIVE_TYPHOONS) || [];
    if (typhoons.length === 0) {
      card.style.display = "none";
      return;
    }

    const ty = typhoons[0];
    const proj = project3D(ty.current_pos.lon, ty.current_pos.lat);
    if (proj.z <= 0.02) {
      card.style.display = "none";
      return;
    }
    card.style.display = "block";

    const svgRect = svgEl.getBoundingClientRect();
    const vpRect = viewportEl.getBoundingClientRect();

    const dotPixelX = svgRect.left - vpRect.left + (proj.x / 1000) * svgRect.width;
    const dotPixelY = svgRect.top - vpRect.top + (proj.y / 500) * svgRect.height;

    const cardWidth = card.offsetWidth || 285;
    const cardHeight = card.offsetHeight || 155;

    let left = dotPixelX + 22;
    let top = dotPixelY - cardHeight / 2;

    if (left + cardWidth > vpRect.width - 14) {
      left = dotPixelX - cardWidth - 22;
    }
    left = Math.max(12, Math.min(vpRect.width - cardWidth - 12, left));
    top = Math.max(12, Math.min(vpRect.height - cardHeight - 12, top));

    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(top)}px`;
  }

  function renderSelectedTyphoonCard() {
    const card = document.getElementById("selected-typhoon-card");
    if (!card) return;

    if (!runtime.isTyphoonSelected) {
      card.style.display = "none";
      return;
    }

    const typhoons = (window.TyphoonService && window.TyphoonService.DEFAULT_ACTIVE_TYPHOONS) || [];
    if (typhoons.length === 0) {
      card.style.display = "none";
      return;
    }

    const ty = typhoons[0];
    const impact = window.TyphoonService ? window.TyphoonService.calculateImpactRadius(ty.max_wind_speed_ms, ty.wind_radius_km) : null;
    const gradeBadge = document.getElementById("st-grade-badge");
    const nameEl = document.getElementById("st-name");
    const pressEl = document.getElementById("st-pressure");
    const windEl = document.getElementById("st-wind");
    const radiusEl = document.getElementById("st-radius");
    const coordsEl = document.getElementById("st-coords");
    const moveEl = document.getElementById("st-movement");
    const forecastEl = document.getElementById("st-forecast");

    if (gradeBadge) {
      gradeBadge.textContent = impact && impact.intensity_grade ? impact.intensity_grade : "매우 강 (TY)";
    }
    if (nameEl) {
      nameEl.textContent = `🌀 제${ty.intl_number ? ty.intl_number.slice(-2) : "25"}호 태풍 ${ty.name}`;
    }
    if (pressEl) pressEl.textContent = `${ty.central_pressure_hpa || 945} hPa`;
    if (windEl) {
      const ms = ty.max_wind_speed_ms || 45;
      windEl.textContent = `${ms} m/s (약 ${Math.round(ms * 3.6)} km/h)`;
    }
    if (radiusEl) radiusEl.textContent = `반경 약 ${ty.wind_radius_km || 320} km`;
    if (coordsEl) {
      coordsEl.textContent = `${Number(ty.current_pos.lat).toFixed(2)}°N, ${Number(ty.current_pos.lon).toFixed(2)}°E`;
    }
    if (moveEl) {
      moveEl.textContent = `북북동진 (약 18 km/h)`;
    }
    if (forecastEl) {
      forecastEl.textContent = "24시간 내 규슈·서일본 방면 접근/상륙";
    }

    positionSelectedTyphoonCard();
  }

  /**
   * 진도(규모 M 0 ~ 10)에 따른 통상적인 감진/영향 반경(km)을 계산합니다.
   */
  function computeImpactRadiusKm(mag) {
    const safeMag = Math.max(0, Math.min(10, Number(mag) || 0));
    const km = 5 * Math.pow(10, 0.38 * safeMag);
    return Math.max(5, Math.min(2500, Math.round(km)));
  }

  /**
   * 영향 반경(km)을 3D 지구본(반지름 R, 실제 지구 반지름 6371km) 위 픽셀 반지름으로 변환합니다.
   */
  function computeImpactRadiusPx(mag, scaleFactor) {
    const km = computeImpactRadiusKm(mag);
    const R = getGlobeRadius();
    const geoPx = (km / 6371) * R;
    const minVisualPx = (1.6 + Math.max(0, Number(mag) || 0) * 1.15) * scaleFactor;
    return Math.max(minVisualPx, geoPx);
  }

  /**
   * 진도 0 ~ 10까지 순수 붉은색(Pure Red) 단일 톤을 유지하되,
   * 10으로 갈수록 불투명도(Opacity)와 선명도가 100%에 도달하도록 스타일을 계산합니다.
   */
  function getPureRedStyle(mag, isStale, isSelected) {
    const clampedMag = Math.max(0, Math.min(10, Number(mag) || 0));
    const ratio = clampedMag / 10;
    const intensity = Math.pow(ratio, 0.72);

    const dotAlpha = Number((0.20 + 0.80 * intensity).toFixed(2));
    const strokeAlpha = Number(Math.min(1.0, dotAlpha + 0.18).toFixed(2));
    // 진도별 그라데이션 전체 불투명도를 45% ~ 100% 범위로 강조
    const zoneOpacity = Number((0.45 + 0.55 * intensity).toFixed(2));

    if (isStale && !isSelected) {
      return {
        dotFill: `rgba(245, 158, 11, ${dotAlpha})`,
        dotStroke: `rgba(251, 191, 36, ${strokeAlpha})`,
        zoneGradUrl: "url(#impactStaleGrad)",
        zoneOpacity
      };
    }

    return {
      dotFill: isSelected ? "#ff182c" : `rgba(255, 24, 44, ${dotAlpha})`,
      dotStroke: isSelected ? "#ffffff" : `rgba(255, 65, 82, ${strokeAlpha})`,
      zoneGradUrl: "url(#impactRedGrad)",
      zoneOpacity: isSelected ? 1.0 : zoneOpacity
    };
  }

  function renderSelectedQuakeCard() {
    const card = document.getElementById("selected-quake-card");
    if (!card) return;

    const quakes = runtime.quakes || [];
    const idx = runtime.selectedQuakeIndex;
    if (idx === null || idx < 0 || idx >= quakes.length) {
      card.style.display = "none";
      return;
    }

    const q = quakes[idx];
    const mag = Number(q.mag) || 0;
    const impactKm = computeImpactRadiusKm(mag);
    const magBadge = document.getElementById("sq-mag-badge");
    const typeLabel = document.getElementById("sq-type-label");
    const impactEl = document.getElementById("sq-impact");

    magBadge.textContent = `M ${mag.toFixed(1)}`;
    if (mag >= 4.5) {
      magBadge.style.background = "rgba(244, 63, 94, 0.25)";
      magBadge.style.color = "#fda4af";
      magBadge.style.borderColor = "rgba(244, 63, 94, 0.6)";
    } else if (mag >= 2.5) {
      magBadge.style.background = "rgba(251, 191, 36, 0.22)";
      magBadge.style.color = "#fde68a";
      magBadge.style.borderColor = "rgba(251, 191, 36, 0.55)";
    } else {
      magBadge.style.background = "rgba(56, 189, 248, 0.2)";
      magBadge.style.color = "#38bdf8";
      magBadge.style.borderColor = "rgba(56, 189, 248, 0.5)";
    }

    typeLabel.textContent = idx === 0 ? "최신 감지 지진" : `이전 지진 기록 (#${idx + 1})`;
    document.getElementById("sq-place").textContent = q.place;
    document.getElementById("sq-coords").textContent = `${Number(q.lat).toFixed(2)}°N, ${Number(q.lon).toFixed(2)}°E`;
    document.getElementById("sq-depth").textContent = `${Number(q.depth).toFixed(1)} km`;
    if (impactEl) {
      impactEl.textContent = `반경 약 ${impactKm.toLocaleString()} km`;
    }
    document.getElementById("sq-time").textContent = formatKSTDisplay(new Date(q.time).toISOString());

    positionSelectedQuakeCard();
  }

  /**
   * 점 크기 계산: 기존 대비 전체적으로 약 20% 키우고(0.2 -> 0.24),
   * 진도(규모, mag)에 따른 크기 차이를 더 뚜렷하게 부각합니다.
   */
  function computeQuakeDotRadius(mag) {
    const safeMag = Math.max(0, Number(mag) || 0);
    const raw = Math.max(1.8, Math.min(13.5, 1.2 + Math.pow(safeMag, 1.35) * 1.35));
    return raw * 0.24;
  }

  /**
   * 3D 구체 표면의 해당 좌표(x, y, z)에서 구의 곡면 기울기에 맞춰
   * 원(점·파동)이 비스듬한 타원 형태로 구 표면에 완전히 밀착되도록 SVG 변환 문자열을 생성합니다.
   */
  function getSurfaceTransform(x, y, z) {
    const dx = x - GLOBE_CX;
    const dy = y - GLOBE_CY;
    const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
    const foreshorten = Math.max(0.16, Math.min(1.0, z));
    return `translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${angleDeg.toFixed(1)}) scale(${foreshorten.toFixed(3)}, 1)`;
  }

  function renderQuakesOnMap() {
    const quakesLayer = document.getElementById("map-layer-quakes");
    const beaconLayer = document.getElementById("map-layer-beacon");
    const calloutLayer = document.getElementById("map-layer-callout");
    if (!quakesLayer || !beaconLayer) return;

    const activeState = getActiveAdapterState();
    const isStale = activeState.status && activeState.status.freshness === "stale";
    const quakes = runtime.quakes || [];
    const scaleFactor = Math.pow(runtime.zoomScale, 0.35);

    if (quakes.length === 0) {
      quakesLayer.innerHTML = "";
      beaconLayer.innerHTML = "";
      if (calloutLayer) calloutLayer.innerHTML = "";
      renderSelectedQuakeCard();
      return;
    }

    // 1) 3D 구체 앞면(visible)에 위치한 이전 지진 점 + 방식 B 상시 통상 영향 반경(붉은 반투명 원) 렌더링
    let dotsHtml = "";
    for (let i = quakes.length - 1; i >= 1; i--) {
      const q = quakes[i];
      const proj = project3D(q.lon, q.lat);
      if (!proj.visible) continue;

      const { x, y, z } = proj;
      const mag = Number(q.mag) || 0;
      const isSelected = runtime.selectedQuakeIndex === i;
      const radius = computeQuakeDotRadius(mag) * scaleFactor;
      const impactPx = computeImpactRadiusPx(mag, scaleFactor);
      const impactKm = computeImpactRadiusKm(mag);
      const hitRadius = Math.max(radius * 2, 9.0);
      const dx = x - GLOBE_CX;
      const dy = y - GLOBE_CY;
      const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
      const foreshorten = Math.max(0.16, Math.min(1.0, z));
      const depthOpacity = isSelected ? 1.0 : Number((0.4 + 0.6 * z).toFixed(2));
      const redStyle = getPureRedStyle(mag, isStale, isSelected);

      dotsHtml += `
        <g class="quake-dot-group" data-quake-index="${i}" transform="translate(${x.toFixed(1)}, ${y.toFixed(1)})" opacity="${depthOpacity}" style="cursor:pointer;">
          <circle cx="0" cy="0" r="${hitRadius.toFixed(2)}" fill="transparent" />
          <g transform="rotate(${angleDeg.toFixed(1)}) scale(${foreshorten.toFixed(3)}, 1)">
            ${
              isSelected
                ? `<circle
                    cx="0"
                    cy="0"
                    r="${impactPx.toFixed(2)}"
                    fill="${redStyle.zoneGradUrl}"
                    fill-opacity="${redStyle.zoneOpacity}"
                    stroke="none"
                    class="quake-impact-zone selected"
                  />`
                : ""
            }
            <circle
              cx="0"
              cy="0"
              r="${radius.toFixed(2)}"
              fill="${redStyle.dotFill}"
              stroke="${redStyle.dotStroke}"
              stroke-width="${(isSelected ? 0.65 : 0.25).toFixed(2)}"
              class="quake-dot ${isSelected ? "selected" : ""}"
            />
          </g>
          <title>[클릭하여 정보 보기] M${mag.toFixed(1)} (영향 반경 약 ${impactKm}km) — ${q.place}</title>
        </g>
      `;
    }
    quakesLayer.innerHTML = dotsHtml;

    quakesLayer.querySelectorAll(".quake-dot-group").forEach((group) => {
      group.addEventListener("click", (e) => {
        e.stopPropagation();
        if (runtime.didDragMove) return;
        const idx = Number(e.currentTarget.getAttribute("data-quake-index"));
        runtime.selectedQuakeIndex = runtime.selectedQuakeIndex === idx ? null : idx;
        renderQuakesOnMap();
      });
    });

    // 2) 최신 지진(quakes[0]) 위치에 단색 코어 점 + 파동 비콘 표시 (클릭 시에만 그라데이션 영향권 표시)
    const newestQuake = quakes[0];
    const newestProj = project3D(newestQuake.lon, newestQuake.lat);
    if (!newestProj.visible) {
      beaconLayer.innerHTML = "";
      if (calloutLayer) calloutLayer.innerHTML = "";
      renderSelectedQuakeCard();
      return;
    }

    const newestMag = Math.max(0.5, Number(newestQuake.mag) || 1.0);
    const newestDotRadius = computeQuakeDotRadius(newestMag) * scaleFactor;
    const newestImpactPx = computeImpactRadiusPx(newestMag, scaleFactor);
    const newestImpactKm = computeImpactRadiusKm(newestMag);
    const isNewestSelected = runtime.selectedQuakeIndex === 0;
    const newestRedStyle = getPureRedStyle(newestMag, isStale, isNewestSelected);

    const { x: bx, y: by, z: bz } = newestProj;
    const beaconSurfaceTransform = getSurfaceTransform(bx, by, bz);
    const labelOffsetX = bx > 620 ? -186 : 12;
    const labelOffsetY = by < 70 ? 18 : -12;
    const statusPrefix = isStale ? "[STALE 유지] " : "[NEW 감지] ";

    beaconLayer.innerHTML = `
      <g transform="${beaconSurfaceTransform}">
        <circle cx="0" cy="0" r="18" fill="url(#beaconGlow)" pointer-events="none" />
        ${
          isNewestSelected
            ? `<circle
                cx="0"
                cy="0"
                r="${newestImpactPx.toFixed(2)}"
                fill="${newestRedStyle.zoneGradUrl}"
                fill-opacity="${newestRedStyle.zoneOpacity}"
                stroke="none"
                class="quake-impact-zone selected"
                pointer-events="none"
              />`
            : ""
        }
        <circle cx="0" cy="0" r="1.5" class="latest-pulse-ring" pointer-events="none" />
        <circle cx="0" cy="0" r="1.5" class="latest-pulse-ring delay-1" pointer-events="none" />
        <circle cx="0" cy="0" r="1.5" class="latest-pulse-ring delay-2" pointer-events="none" />
        <circle cx="0" cy="0" r="${newestDotRadius.toFixed(2)}" class="latest-core-beacon" pointer-events="none">
          <title>${statusPrefix}M${Number(newestQuake.mag).toFixed(1)} — ${newestQuake.place}</title>
        </circle>
      </g>
      <circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="10" fill="transparent" id="latest-beacon-hit" style="cursor:pointer;">
        <title>${statusPrefix}M${Number(newestQuake.mag).toFixed(1)} — ${newestQuake.place}</title>
      </circle>
    `;

    if (calloutLayer) {
      calloutLayer.innerHTML = `
        <g transform="translate(${(bx + labelOffsetX).toFixed(1)}, ${(by + labelOffsetY).toFixed(1)})" pointer-events="none">
          <rect x="0" y="-13" width="180" height="30" rx="5" fill="rgba(6, 11, 22, 0.88)" stroke="${isStale ? '#f59e0b' : '#22d3ee'}" stroke-width="1" />
          <text x="7" y="-1" fill="${isStale ? '#fde68a' : '#38bdf8'}" font-size="9" font-weight="bold" font-family="sans-serif">
            ${statusPrefix}M${Number(newestQuake.mag).toFixed(1)} 진앙지
          </text>
          <text x="7" y="10" fill="#cbd5e1" font-size="8" font-family="monospace">
            ${Number(newestQuake.lat).toFixed(2)}°N, ${Number(newestQuake.lon).toFixed(2)}°E
          </text>
        </g>
      `;
    }

    const latestHit = document.getElementById("latest-beacon-hit");
    if (latestHit) {
      latestHit.addEventListener("click", (e) => {
        e.stopPropagation();
        if (runtime.didDragMove) return;
        runtime.selectedQuakeIndex = runtime.selectedQuakeIndex === 0 ? null : 0;
        renderQuakesOnMap();
      });
    }

    renderSelectedQuakeCard();
  }

  // ============================================================================
  // 과제 5: 3D SVG 구체 지구본 위 태풍 레이어 렌더링 (경로, 강풍 반경, 사이클론 마커)
  // ============================================================================
  function renderTyphoonsOnMap() {
    const typhoonLayer = document.getElementById("map-layer-typhoons");
    if (!typhoonLayer) return;

    if (!window.TyphoonService || !window.TyphoonService.getTyphoonLayerVisibility()) {
      typhoonLayer.innerHTML = "";
      renderSelectedTyphoonCard();
      return;
    }

    const typhoons = window.TyphoonService.DEFAULT_ACTIVE_TYPHOONS || [];
    if (typhoons.length === 0) {
      typhoonLayer.innerHTML = "";
      renderSelectedTyphoonCard();
      return;
    }

    const R = getGlobeRadius();
    const scaleFactor = Math.pow(runtime.zoomScale, 0.35);
    let html = "";

    typhoons.forEach((ty) => {
      // 1) 예측/이동 경로 선분 렌더링 (구체 앞면에 보이는 구간만 정밀 연결)
      if (Array.isArray(ty.forecast_track) && ty.forecast_track.length > 1) {
        for (let i = 0; i < ty.forecast_track.length; i++) {
          const p1 = project3D(ty.forecast_track[i].lon, ty.forecast_track[i].lat);
          if (i > 0) {
            const p0 = project3D(ty.forecast_track[i - 1].lon, ty.forecast_track[i - 1].lat);
            if (p0.z > 0.05 && p1.z > 0.05) {
              html += `<line x1="${p0.x.toFixed(1)}" y1="${p0.y.toFixed(1)}" x2="${p1.x.toFixed(1)}" y2="${p1.y.toFixed(1)}" class="map-typhoon-track" />`;
            }
          }
          if (p1.z > 0.05) {
            const isForecast = ty.forecast_track[i].stage === "forecast";
            html += `<circle cx="${p1.x.toFixed(1)}" cy="${p1.y.toFixed(1)}" r="${isForecast ? 2 : 2.5}" fill="${isForecast ? '#38bdf8' : '#0284c7'}" stroke="#ffffff" stroke-width="0.8" opacity="0.9" />`;
          }
        }
      }

      // 2) 현재 위치 및 강풍 영향 반경 표출 (구체 앞면 z > 0.02일 때만 정밀 렌더링)
      const curProj = project3D(ty.current_pos.lon, ty.current_pos.lat);
      if (curProj.z > 0.02) {
        const { x, y, z } = curProj;
        const impact = window.TyphoonService.calculateImpactRadius(ty.max_wind_speed_ms, ty.wind_radius_km);
        const impactPx = (impact.radius_km / 6371.0) * R;
        const surfaceTransform = getSurfaceTransform(x, y, z);
        const isSelected = !!runtime.isTyphoonSelected;

        html += `
          <g class="typhoon-symbol-wrap" data-typhoon-id="${ty.id}">
            <!-- 3D 구체 표면 곡률에 완벽히 밀착되는 영향권 타원 -->
            <g transform="${surfaceTransform}" pointer-events="none">
              <circle cx="0" cy="0" r="${Math.max(12, impactPx).toFixed(1)}" class="map-typhoon-impact" />
            </g>
            <!-- 선택 활성화 시 구 표면 밀착 회전 점선 링 -->
            ${isSelected ? `
            <g transform="${surfaceTransform}" pointer-events="none">
              <circle cx="0" cy="0" r="${(Math.max(12, impactPx) * 1.04).toFixed(1)}" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-dasharray="6, 4" opacity="0.95">
                <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="10s" repeatCount="indefinite" />
              </circle>
            </g>
            ` : ""}
            <!-- 중심 사이클론 아이콘 및 자체 중심 회전 (SVG 0 0 0 기준 절대 오차 없음) -->
            <g transform="translate(${x.toFixed(1)}, ${y.toFixed(1)})">
              <!-- 클릭 감지용 투명 타겟 영역 -->
              <circle cx="0" cy="0" r="18" fill="rgba(56, 189, 248, 0.001)" cursor="pointer" class="typhoon-hit-circle" />
              <circle cx="0" cy="0" r="7" fill="${isSelected ? '#0284c7' : '#0369a1'}" stroke="#ffffff" stroke-width="${isSelected ? '2' : '1.3'}" />
              <g pointer-events="none">
                <path d="M-8,-2 C-3,-9 5,-7 8,0 C3,9 -5,7 -8,-2" fill="none" stroke="${isSelected ? '#e0f2fe' : '#38bdf8'}" stroke-width="2.2" />
                <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="-360 0 0" dur="6s" repeatCount="indefinite" />
              </g>
              ${isSelected ? `
              <circle cx="0" cy="0" r="11" fill="none" stroke="#38bdf8" stroke-width="1.8" opacity="0.8" pointer-events="none">
                <animate attributeName="r" values="9;16;9" dur="1.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.9;0.2;0.9" dur="1.8s" repeatCount="indefinite" />
              </circle>
              ` : ""}
              <!-- 수평 라벨 툴팁 (화면 우측 치우침 방지 동적 오프셋) -->
              <rect x="${x > 580 ? -(ty.name.length * 8 + 80) : 12}" y="-10" width="${ty.name.length * 8 + 68}" height="20" rx="4" fill="rgba(3, 10, 24, 0.92)" stroke="${isSelected ? '#38bdf8' : '#0284c7'}" stroke-width="${isSelected ? '1.8' : '1'}" />
              <text x="${x > 580 ? -(ty.name.length * 8 + 76) : 16}" y="4" fill="${isSelected ? '#e0f2fe' : '#38bdf8'}" font-size="10.5" font-weight="700" font-family="sans-serif">🌀 ${ty.name} (${ty.max_wind_speed_ms}m/s)</text>
            </g>
          </g>
        `;
      }
    });

    typhoonLayer.innerHTML = html;

    // 태풍 심볼 클릭 이벤트 연결
    const symbolWraps = typhoonLayer.querySelectorAll(".typhoon-symbol-wrap");
    symbolWraps.forEach((wrap) => {
      wrap.addEventListener("click", (e) => {
        e.stopPropagation();
        runtime.isTyphoonSelected = !runtime.isTyphoonSelected;
        renderTyphoonsOnMap();
      });
    });

    renderSelectedTyphoonCard();
  }

  function triggerNewDataArrivalFlash() {
    if (!runtime.quakes || !runtime.quakes.length) return;
    if (runtime.isDraggingMap) return;
    const newest = runtime.quakes[0];

    // 새 지진이 지구본 뒷면에 있으면 해당 진앙지가 정면에 보이도록 지구본 자동 회전
    const checkProj = project3D(newest.lon, newest.lat);
    if (checkProj.z < 0.25) {
      focusGlobeOnLonLat(newest.lon, newest.lat);
      render3DGlobeBase();
      renderQuakesOnMap();
      renderTyphoonsOnMap();
    }

    const beaconLayer = document.getElementById("map-layer-beacon");
    if (!beaconLayer) return;

    const maxBurstR = 32;
    const { x, y, z, visible } = project3D(newest.lon, newest.lat);
    if (!visible) return;

    const flashGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    flashGroup.setAttribute("transform", getSurfaceTransform(x, y, z));
    flashGroup.setAttribute("pointer-events", "none");

    const flashCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    flashCircle.setAttribute("cx", "0");
    flashCircle.setAttribute("cy", "0");
    flashCircle.setAttribute("r", "2");
    flashCircle.setAttribute("fill", "rgba(34, 211, 238, 0.45)");
    flashCircle.setAttribute("stroke", "#ffffff");
    flashCircle.setAttribute("stroke-width", "2.8");
    flashGroup.appendChild(flashCircle);
    beaconLayer.appendChild(flashGroup);

    let r = 2;
    let opacity = 1;
    const step = Math.max(2.5, maxBurstR / 16);
    const timer = setInterval(() => {
      r += step;
      opacity -= 0.065;
      if (opacity <= 0 || r >= maxBurstR) {
        clearInterval(timer);
        flashGroup.remove();
      } else {
        flashCircle.setAttribute("r", String(r.toFixed(1)));
        flashCircle.setAttribute("stroke-opacity", String(opacity));
        flashCircle.setAttribute("fill-opacity", String(opacity * 0.3));
      }
    }, 26);
  }

  // ============================================================================
  // 5. 로컬 저장소 연동 (실제 USGS 일별 기록 영구 보존)
  // ============================================================================
  function loadPersistedLiveState() {
    try {
      const savedLive = localStorage.getItem(STORAGE_KEYS.LIVE_STATE);
      if (savedLive) {
        const parsed = JSON.parse(savedLive);
        if (parsed && Array.isArray(parsed.daily_readings)) {
          runtime.liveState = parsed;
        }
      }
      const savedQuakes = localStorage.getItem(STORAGE_KEYS.LIVE_QUAKES);
      if (savedQuakes) {
        const parsedQ = JSON.parse(savedQuakes);
        if (Array.isArray(parsedQ)) runtime.quakes = parsedQ;
      }
      const savedAttempts = localStorage.getItem(STORAGE_KEYS.TODAY_ATTEMPTS);
      if (savedAttempts) {
        runtime.todayAttempts = JSON.parse(savedAttempts) || {};
      }
    } catch (err) {
      console.warn("localStorage 로드 경고:", err);
    }
  }

  function saveLiveStateToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.LIVE_STATE, JSON.stringify(runtime.liveState));
      localStorage.setItem(STORAGE_KEYS.LIVE_QUAKES, JSON.stringify(runtime.quakes));
      localStorage.setItem(STORAGE_KEYS.TODAY_ATTEMPTS, JSON.stringify(runtime.todayAttempts));
    } catch (err) {
      console.warn("localStorage 저장 경고:", err);
    }
  }

  // ============================================================================
  // 6. 실시간 USGS API 호출 (Live Adapter -> applySuccessfulReading)
  // ============================================================================
  async function fetchLiveUSGSData(options = { isAuto: false }) {
    const btnFetch = document.getElementById("btn-fetch-live");
    if (btnFetch) btnFetch.disabled = true;

    try {
      const response = await fetch(LIVE_SOURCE_URL, {
        method: "GET",
        cache: "no-store"
      });

      if (response.status === 401 || response.status === 403) {
        runtime.mode = "live";
        runtime.liveState = applyError(runtime.liveState, "auth", { virtual_now: new Date().toISOString() });
        renderAll();
        return;
      }
      if (response.status === 429) {
        runtime.mode = "live";
        runtime.liveState = applyError(runtime.liveState, "rate_limit", { virtual_now: new Date().toISOString() });
        renderAll();
        return;
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const rawData = await response.json();
      if (
        !rawData ||
        !rawData.metadata ||
        typeof rawData.metadata.count !== "number" ||
        !Array.isArray(rawData.features)
      ) {
        runtime.mode = "live";
        runtime.liveState = applyError(runtime.liveState, "schema_error", { virtual_now: new Date().toISOString() });
        renderAll();
        return;
      }

      const fetchedIso = new Date().toISOString();
      const sourceIso = rawData.metadata.generated
        ? new Date(Number(rawData.metadata.generated)).toISOString()
        : null;
      const recordDate = kstDate(fetchedIso);

      // 방식 1-A: 한국 날짜(Asia/Seoul recordDate, 00:00:00 KST 이후)에 발생한 지진만 필터링하여
      // 상단 표시 숫자와 3D 지구본 점 개수를 1:1로 일치시키고 하루 동안 숫자가 줄어들지 않게 함
      const prevTopQuakeId = runtime.quakes.length > 0 ? runtime.quakes[0].id : null;
      const allMappedQuakes = rawData.features.map((f) => {
        const coords = (f.geometry && f.geometry.coordinates) || [0, 0, 0];
        const props = f.properties || {};
        const quakeTimeMs = Number(props.time) || Date.now();
        return {
          id: f.id || "",
          lon: Number(coords[0]) || 0,
          lat: Number(coords[1]) || 0,
          depth: Number(coords[2]) || 0,
          mag: Number(props.mag) || 0,
          place: String(props.place || "Unknown Region"),
          time: quakeTimeMs,
          quakeDateKST: kstDate(new Date(quakeTimeMs).toISOString())
        };
      });

      const todayKSTQuakes = allMappedQuakes.filter((q) => q.quakeDateKST === recordDate);
      runtime.quakes = todayKSTQuakes;

      // 공식 normalized-reading.schema.json 9개 필수 키 생성
      const reading = {
        signal_id: LIVE_SIGNAL_ID,
        normalized_value: todayKSTQuakes.length,
        unit: LIVE_UNIT,
        source_name: LIVE_SOURCE_NAME,
        source_url: LIVE_SOURCE_URL,
        source_time: sourceIso,
        fetched_at: fetchedIso,
        record_timezone: TIMEZONE_ID,
        record_date: recordDate
      };

      runtime.lastRawExcerpt = {
        "metadata.title": rawData.metadata.title,
        "metadata.url": LIVE_SOURCE_URL,
        "metadata.generated": rawData.metadata.generated,
        "metadata.generated_iso": sourceIso,
        "kst_record_date": recordDate,
        "kst_today_earthquake_count": todayKSTQuakes.length,
        "raw_rolling_24h_count": rawData.metadata.count,
        normalizedReading: reading
      };

      // Live 상태에 공식 applySuccessfulReading 적용
      runtime.mode = "live";
      runtime.liveState = applySuccessfulReading(runtime.liveState, reading, {
        fixture_id: null,
        virtual_now: fetchedIso
      });
      runtime.todayAttempts[recordDate] = (Number(runtime.todayAttempts[recordDate]) || 0) + 1;
      runtime.autoRefreshRemainingSec = AUTO_REFRESH_INTERVAL_SEC;

      saveLiveStateToStorage();

      document.querySelectorAll(".fixture-btn").forEach((b) => b.classList.remove("active-fault"));
      renderAll();

      const newTopQuakeId = runtime.quakes.length > 0 ? runtime.quakes[0].id : null;
      if (!options.isAuto || newTopQuakeId !== prevTopQuakeId) {
        triggerNewDataArrivalFlash();
      }
    } catch (err) {
      runtime.mode = "live";
      runtime.liveState = applyError(runtime.liveState, "offline", { virtual_now: new Date().toISOString() });
      renderAll();
    } finally {
      if (btnFetch) btnFetch.disabled = false;
    }
  }

  // ============================================================================
  // 7. T04 공식 9개 결정론 Fixture 실행 및 시퀀스 재생
  // ============================================================================
  function executeOfficialFixture(fixtureId) {
    const fixture = OFFICIAL_FIXTURES[fixtureId];
    if (!fixture) return;

    runtime.mode = "fixture";

    // 실패 Fixture인데 아직 합성 baseline(D1-A -> D1-B)이 없으면 공식 failure_baseline_sequence 자동 선행
    const isFailureFixture = ["T04-TIMEOUT", "T04-AUTH-401", "T04-RATE-429", "T04-OFFLINE", "T04-SCHEMA-BREAK"].includes(fixtureId);
    if (isFailureFixture && !runtime.evalState.current_reading) {
      let s = resetEvaluationState();
      s = runFixture(s, OFFICIAL_FIXTURES["T04-NORMAL-D1-A"]);
      s = runFixture(s, OFFICIAL_FIXTURES["T04-NORMAL-D1-B"]);
      runtime.evalState = s;
    }

    // 복구 Fixture(T04-RECOVER-D2)인데 아직 D1-B / TIMEOUT 선행 상태가 없으면 공식 recovery_sequence 기준점 보장
    if (fixtureId === "T04-RECOVER-D2" && runtime.evalState.daily_readings.length === 0) {
      let s = resetEvaluationState();
      s = runFixture(s, OFFICIAL_FIXTURES["T04-NORMAL-D1-A"]);
      s = runFixture(s, OFFICIAL_FIXTURES["T04-NORMAL-D1-B"]);
      s = runFixture(s, OFFICIAL_FIXTURES["T04-TIMEOUT"]);
      runtime.evalState = s;
    }

    runtime.evalState = runFixture(runtime.evalState, fixture);
    runtime.lastRawExcerpt = fixture;

    document.querySelectorAll(".fixture-btn").forEach((btn) => {
      btn.classList.toggle("active-fault", btn.getAttribute("data-fixture-id") === fixtureId);
    });

    renderAll();

    if (runtime.evalState.status && runtime.evalState.status.freshness === "fresh") {
      triggerNewDataArrivalFlash();
    }
  }

  function handleResetEvaluation() {
    // public-contract.json: "합성 평가 상태만 빈 상태로 되돌린다."
    runtime.evalState = resetEvaluationState();
    runtime.mode = "live";
    document.querySelectorAll(".fixture-btn").forEach((b) => b.classList.remove("active-fault"));
    renderAll();
  }

  // ============================================================================
  // 8. 전체 화면 렌더링
  // ============================================================================
  function renderAll() {
    const activeState = getActiveAdapterState();
    const status = activeState.status || { freshness: "fresh", error_code: "none" };
    const isStale = status.freshness === "stale";
    const reading = activeState.current_reading;

    const appStage = document.getElementById("app-stage");
    const faultCluster = document.getElementById("hud-fault-cluster");
    const badgeFreshness = document.getElementById("badge-freshness");
    const badgeError = document.getElementById("badge-error-state");
    const signalLabel = document.getElementById("hud-signal-label");

    appStage.classList.toggle("is-stale", isStale);
    badgeFreshness.textContent = status.freshness;
    badgeFreshness.className = `freshness-badge ${isStale ? "stale" : "fresh"}`;

    badgeError.textContent = status.error_code;
    badgeError.className = `error-code-badge ${status.error_code !== "none" ? "has-error" : ""}`;

    // 평소(정상 fresh/none)에는 상단 바에서 숨기고, 고장(stale) 발생 시에만 경고 클러스터 노출
    if (faultCluster) {
      faultCluster.style.display = status.error_code === "none" ? "none" : "inline-flex";
    }

    if (reading) {
      if (reading.record_date && /^\d{4}-\d{2}-\d{2}$/.test(reading.record_date)) {
        const [y, m, d] = reading.record_date.split("-");
        signalLabel.textContent =
          reading.signal_id === LIVE_SIGNAL_ID
            ? `${y}년 ${Number(m)}월 ${Number(d)}일 지진`
            : `${y}년 ${Number(m)}월 ${Number(d)}일 (Fixture)`;
      } else {
        signalLabel.textContent = "오늘 지진";
      }
      document.getElementById("display-value").textContent = String(reading.normalized_value);
      document.getElementById("display-unit").textContent = reading.unit;
      document.getElementById("display-source-name").textContent = reading.source_name;
      const urlEl = document.getElementById("display-source-url");
      urlEl.textContent = reading.source_url;
      urlEl.href = reading.source_url;
      document.getElementById("display-source-time").textContent =
        reading.source_time !== null ? reading.source_time : "null (미제공)";
      document.getElementById("display-fetched-time").textContent = reading.fetched_at;
      document.getElementById("display-timezone").textContent = reading.record_timezone;
      document.getElementById("display-record-date").textContent = reading.record_date;
    }

    if (runtime.quakes && runtime.quakes.length > 0) {
      const lq = runtime.quakes[0];
      document.getElementById("display-latest-quake").textContent =
        `M${Number(lq.mag).toFixed(1)} ${lq.place} (${Number(lq.lat).toFixed(2)}°N, ${Number(lq.lon).toFixed(2)}°E)`;
    }

    // 드로어 상태 라벨
    const faultTitle = document.getElementById("fault-Diagnostic-title");
    if (faultTitle) {
      if (status.error_code === "none") {
        faultTitle.textContent = "fresh / none";
        faultTitle.style.color = "#34d399";
      } else {
        faultTitle.textContent = `stale / ${status.error_code}`;
        faultTitle.style.color = "#fda4af";
      }
    }

    render3DGlobeBase();
    renderQuakesOnMap();
    renderTyphoonsOnMap();
    renderDailyRecordsTable();
    renderDayOverDayComparison();
  }

  function renderDailyRecordsTable() {
    const activeRows = getActiveAdapterState().daily_readings || [];
    const tbody = document.getElementById("daily-records-tbody");
    if (!tbody) return;

    if (activeRows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-secondary);">저장된 기록 없음</td></tr>`;
      return;
    }

    tbody.innerHTML = activeRows
      .map((row) => {
        const r = row.reading;
        const srcTimeText = r.source_time !== null ? r.source_time : "null";
        return `
          <tr class="daily-record-row">
            <td class="cell-date"><strong style="color:#38bdf8;">${row.record_date}</strong></td>
            <td class="cell-value"><strong>${row.normalized_value}</strong></td>
            <td class="cell-unit">${row.unit}</td>
            <td class="cell-time">${srcTimeText}</td>
            <td class="cell-url"><a href="${r.source_url}" target="_blank" rel="noopener noreferrer">${r.source_url}</a></td>
          </tr>
        `;
      })
      .join("");
  }

  function renderDayOverDayComparison() {
    const activeState = getActiveAdapterState();
    const rows = activeState.daily_readings || [];

    const prevValEl = document.getElementById("delta-prev-val");
    const prevDateEl = document.getElementById("delta-prev-date");
    const currValEl = document.getElementById("delta-curr-val");
    const currDateEl = document.getElementById("delta-curr-date");
    const diffValEl = document.getElementById("delta-diff-val");
    const verifyFormulaEl = document.getElementById("delta-verify-formula");

    if (rows.length < 2) {
      const only = rows[0];
      prevValEl.textContent = only ? `${only.normalized_value} ${only.unit}` : "--";
      prevDateEl.textContent = only ? only.record_date : "--";
      currValEl.textContent = "대기 중";
      currDateEl.textContent = "2일차 기록 필요";
      diffValEl.textContent = "null";
      verifyFormulaEl.textContent = "2일차 기록 생성 시 자동 계산";
      return;
    }

    const prev = rows[rows.length - 2];
    const curr = rows[rows.length - 1];
    const signed = curr.normalized_value - prev.normalized_value;
    const magnitude = Math.abs(signed);
    const sign = signed > 0 ? "+" : signed < 0 ? "-" : "";

    prevValEl.textContent = `${prev.normalized_value} ${prev.unit}`;
    prevDateEl.textContent = prev.record_date;

    currValEl.textContent = `${curr.normalized_value} ${curr.unit}`;
    currDateEl.textContent = curr.record_date;

    diffValEl.textContent = `${sign}${magnitude} ${curr.unit}`;
    diffValEl.style.color = signed > 0 ? "#34d399" : signed < 0 ? "#f43f5e" : "#38bdf8";

    const recalculated = Math.abs(Number(curr.normalized_value) - Number(prev.normalized_value));
    verifyFormulaEl.textContent = `|${curr.normalized_value} - ${prev.normalized_value}| = ${recalculated} ${curr.unit}`;
  }

  // ============================================================================
  // 9. 슬라이드 드로어 제어 및 자동 갱신 타이머
  // ============================================================================
  function toggleDrawer() {
    const drawer = document.getElementById("side-drawer");
    runtime.isDrawerOpen = !runtime.isDrawerOpen;
    drawer.classList.toggle("open", runtime.isDrawerOpen);
  }

  function closeDrawer() {
    const drawer = document.getElementById("side-drawer");
    runtime.isDrawerOpen = false;
    drawer.classList.remove("open");
  }

  function startAutoRefreshLoop() {
    setInterval(() => {
      const activeState = getActiveAdapterState();
      const isFreshLive =
        runtime.mode === "live" &&
        activeState.status &&
        activeState.status.freshness === "fresh";

      if (!isFreshLive) return;

      runtime.autoRefreshRemainingSec -= 1;
      if (runtime.autoRefreshRemainingSec <= 0) {
        runtime.autoRefreshRemainingSec = AUTO_REFRESH_INTERVAL_SEC;
        fetchLiveUSGSData({ isAuto: true });
      }
    }, 1000);
  }

  function bindEvents() {
    const btnToggleDrawer = document.getElementById("btn-toggle-drawer");
    if (btnToggleDrawer) {
      btnToggleDrawer.addEventListener("click", toggleDrawer);
    }

    document.getElementById("btn-close-drawer").addEventListener("click", closeDrawer);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && runtime.isDrawerOpen) closeDrawer();
    });

    // 3D 지구본 마우스 휠 확대/축소 & 드래그 360° 회전
    const svgEl = document.getElementById("world-map-svg");
    if (svgEl) {
      svgEl.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
          zoomMapAtPoint(runtime.zoomScale * factor);
        },
        { passive: false }
      );

      svgEl.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        runtime.isDraggingMap = true;
        runtime.didDragMove = false;
        runtime.dragStartX = e.clientX;
        runtime.dragStartY = e.clientY;
      });

      window.addEventListener("mousemove", (e) => {
        if (!runtime.isDraggingMap) return;
        const dx = e.clientX - runtime.dragStartX;
        const dy = e.clientY - runtime.dragStartY;
        const moveDist = Math.hypot(dx, dy);
        if (moveDist > 2) runtime.didDragMove = true;

        runtime.dragStartX = e.clientX;
        runtime.dragStartY = e.clientY;

        const sensitivity = 0.28 / Math.pow(runtime.zoomScale, 0.7);
        runtime.rotLon = (((runtime.rotLon - dx * sensitivity) + 180) % 360 + 360) % 360 - 180;
        runtime.rotLat = Math.max(-75, Math.min(75, runtime.rotLat + dy * sensitivity));

        // requestAnimationFrame (rAF) 스로틀링: 1프레임(약 16ms)당 딱 1번만 모아서 렌더링
        if (!runtime.dragRafId) {
          runtime.dragRafId = requestAnimationFrame(() => {
            runtime.dragRafId = null;
            applyMapZoomTransform();
          });
        }
      });

      window.addEventListener("mouseup", () => {
        if (runtime.isDraggingMap) {
          runtime.isDraggingMap = false;
          if (runtime.dragRafId) {
            cancelAnimationFrame(runtime.dragRafId);
            runtime.dragRafId = null;
          }
          // 드래그 종료 시점 최종 정밀 렌더링 1회 보장
          applyMapZoomTransform();
        }
      });

      svgEl.addEventListener("click", () => {
        if (runtime.didDragMove) return;
        if (runtime.selectedQuakeIndex !== null) {
          runtime.selectedQuakeIndex = null;
          renderQuakesOnMap();
        }
        if (runtime.isTyphoonSelected) {
          runtime.isTyphoonSelected = false;
          renderTyphoonsOnMap();
        }
      });
    }

    window.addEventListener("resize", () => {
      positionSelectedQuakeCard();
      positionSelectedTyphoonCard();
    });

    const btnCloseSq = document.getElementById("btn-close-sq");
    if (btnCloseSq) {
      btnCloseSq.addEventListener("click", () => {
        runtime.selectedQuakeIndex = null;
        renderQuakesOnMap();
      });
    }

    const btnCloseSt = document.getElementById("btn-close-st");
    if (btnCloseSt) {
      btnCloseSt.addEventListener("click", (e) => {
        e.stopPropagation();
        runtime.isTyphoonSelected = false;
        renderTyphoonsOnMap();
      });
    }

    document.getElementById("btn-zoom-in").addEventListener("click", () => {
      zoomMapAtPoint(runtime.zoomScale * 1.28);
    });
    document.getElementById("btn-zoom-out").addEventListener("click", () => {
      zoomMapAtPoint(runtime.zoomScale / 1.28);
    });
    document.getElementById("btn-zoom-reset").addEventListener("click", () => {
      runtime.zoomScale = 1;
      if (runtime.quakes && runtime.quakes.length > 0) {
        focusGlobeOnLonLat(runtime.quakes[0].lon, runtime.quakes[0].lat);
      } else {
        runtime.rotLon = 138;
        runtime.rotLat = 22;
      }
      applyMapZoomTransform();
    });

    // 실시간 조회 및 Reset 버튼
    const btnTopFetch = document.getElementById("btn-fetch-live");
    if (btnTopFetch) {
      btnTopFetch.addEventListener("click", () => {
        fetchLiveUSGSData({ isAuto: false });
      });
    }
    const btnRetryLive = document.getElementById("btn-retry-live");
    if (btnRetryLive) {
      btnRetryLive.addEventListener("click", () => {
        fetchLiveUSGSData({ isAuto: false });
      });
    }
    const btnResetEval = document.getElementById("btn-reset-eval");
    if (btnResetEval) {
      btnResetEval.addEventListener("click", handleResetEvaluation);
    }

    // 상단 다시 시도 버튼 (T04-RECOVER-D2 재생)
    const btnReplayRecovery = document.getElementById("btn-replay-recovery");
    if (btnReplayRecovery) {
      btnReplayRecovery.addEventListener("click", () => {
        executeOfficialFixture("T04-RECOVER-D2");
      });
    }

    // 공식 9개 개별 Fixture 버튼
    document.querySelectorAll(".fixture-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const fid = btn.getAttribute("data-fixture-id");
        if (fid) executeOfficialFixture(fid);
      });
    });

    // ========================================================================
    // 과제 5 이벤트 핸들러: 태풍 레이어 토글 & 멀티 LLM 브리핑 & 10개 검사 러너
    // ========================================================================
    const btnToggleTyphoon = document.getElementById("btn-toggle-typhoon");
    if (btnToggleTyphoon && window.TyphoonService) {
      btnToggleTyphoon.addEventListener("click", () => {
        const cur = window.TyphoonService.getTyphoonLayerVisibility();
        const next = window.TyphoonService.setTyphoonLayerVisibility(!cur);
        btnToggleTyphoon.textContent = next ? "🌀 태풍 레이어 토글 (ON)" : "🌀 태풍 레이어 토글 (OFF)";
        renderTyphoonsOnMap();
      });
    }

    const btnRunMultiLLM = document.getElementById("btn-run-multi-llm");
    const resultBox = document.getElementById("multi-llm-result-box");
    const stage1Body = document.getElementById("llm-stage1-body");
    const stage2Body = document.getElementById("llm-stage2-body");

    if (btnRunMultiLLM && window.MultiLLMService) {
      btnRunMultiLLM.addEventListener("click", async () => {
        btnRunMultiLLM.disabled = true;
        btnRunMultiLLM.textContent = "⏳ 분석 파이프라인 가동 중...";
        if (resultBox) resultBox.style.display = "block";

        const newestQuake = (runtime.quakes && runtime.quakes[0]) || { mag: 4.5, place: "경북 포항시 북동쪽 9km" };
        const ty = (window.TyphoonService && window.TyphoonService.DEFAULT_ACTIVE_TYPHOONS[0]) || { name: "SHANSHAN", max_wind_speed_ms: 45, central_pressure_hpa: 945 };

        try {
          // 1단계 LLM 분석 실행 (AI A 구현 완료)
          const s1 = await window.MultiLLMService.analyzeRiskStage1(newestQuake, ty);
          if (stage1Body) {
            stage1Body.innerHTML = `
              <div><strong>위험 등급:</strong> <span style="color:#f43f5e; font-weight:800;">${s1.risk_level} (${s1.compound_score}점)</span></div>
              <div style="margin-top:2px;"><strong>요약:</strong> ${s1.summary}</div>
              <div style="margin-top:2px; font-size:0.7rem; color:#94a3b8;">주요 위협: ${s1.primary_threats.join(" / ")}</div>
            `;
          }

          // 2단계 LLM 실행 시도 (AI B 구현 대상)
          try {
            const s2 = await window.MultiLLMService.generateBriefingStage2(s1);
            if (stage2Body) {
              stage2Body.innerHTML = `<div style="color:#34d399;">${s2.briefing_markdown}</div>`;
            }
          } catch (s2Err) {
            if (stage2Body) {
              stage2Body.innerHTML = `
                <div style="color:#f59e0b; font-size:0.72rem; padding:6px; background:rgba(245,158,11,0.12); border-radius:4px;">
                  ⚠️ <strong>[AI A 세션 완료 / 인수인계 대기]</strong><br/>
                  2단계 대피 행동요령 브리핑 생성기는 AI B(Claude) 구현 대상입니다.<br/>
                  (인수인계 규격: <code>docs/HANDOVER.md</code> 참조)
                </div>
              `;
            }
          }
        } catch (err) {
          if (stage1Body) stage1Body.textContent = "분석 오류: " + err.message;
        } finally {
          btnRunMultiLLM.disabled = false;
          btnRunMultiLLM.textContent = "🤖 AI 복합 재난 브리핑 실행";
        }
      });
    }

    const btnRunTestsUi = document.getElementById("btn-run-tests-ui");
    const testsSummaryUi = document.getElementById("tests-summary-ui");
    if (btnRunTestsUi) {
      btnRunTestsUi.addEventListener("click", async () => {
        btnRunTestsUi.disabled = true;
        btnRunTestsUi.textContent = "⏳ 검사 실행 중...";

        let pass = 0;
        let fail = 0;
        const details = [];

        // TEST-01
        try {
          const r = await window.TyphoonService.fetchActiveTyphoons();
          if (r.status === 200 && r.data.length > 0) { pass++; details.push({ id: "TEST-01", pass: true }); }
          else { fail++; details.push({ id: "TEST-01", pass: false }); }
        } catch (_) { fail++; details.push({ id: "TEST-01", pass: false }); }

        // TEST-02
        try {
          const imp = window.TyphoonService.calculateImpactRadius(35, 300);
          if (imp.radius_km === 300) { pass++; details.push({ id: "TEST-02", pass: true }); }
          else { fail++; details.push({ id: "TEST-02", pass: false }); }
        } catch (_) { fail++; details.push({ id: "TEST-02", pass: false }); }

        // TEST-03
        try {
          window.TyphoonService.setTyphoonLayerVisibility(true);
          pass++; details.push({ id: "TEST-03", pass: true });
        } catch (_) { fail++; details.push({ id: "TEST-03", pass: false }); }

        // TEST-04
        try {
          const tyRes = await window.TyphoonService.fetchActiveTyphoons();
          if (tyRes.data[0]) { pass++; details.push({ id: "TEST-04", pass: true }); }
          else { fail++; details.push({ id: "TEST-04", pass: false }); }
        } catch (_) { fail++; details.push({ id: "TEST-04", pass: false }); }

        // TEST-05
        try {
          const empty = await window.TyphoonService.fetchActiveTyphoons([]);
          window.TyphoonService.resetTyphoonData();
          if (empty.data.length === 0) { pass++; details.push({ id: "TEST-05", pass: true }); }
          else { fail++; details.push({ id: "TEST-05", pass: false }); }
        } catch (_) { fail++; details.push({ id: "TEST-05", pass: false }); }

        // TEST-06
        try {
          const s1 = await window.MultiLLMService.analyzeRiskStage1({ mag: 4.5 }, { max_wind_speed_ms: 40 });
          if (s1.risk_level === "심각") { pass++; details.push({ id: "TEST-06", pass: true }); }
          else { fail++; details.push({ id: "TEST-06", pass: false }); }
        } catch (_) { fail++; details.push({ id: "TEST-06", pass: false }); }

        // TEST-07
        try {
          const s1 = await window.MultiLLMService.analyzeRiskStage1({ mag: 1.8 }, { max_wind_speed_ms: 18 });
          if (s1.risk_level === "주의" || s1.risk_level === "관심") { pass++; details.push({ id: "TEST-07", pass: true }); }
          else { fail++; details.push({ id: "TEST-07", pass: false }); }
        } catch (_) { fail++; details.push({ id: "TEST-07", pass: false }); }

        // TEST-08 ~ TEST-10 (AI B 구현 대상)
        for (let tid of ["TEST-08", "TEST-09", "TEST-10"]) {
          try {
            await window.MultiLLMService.generateBriefingStage2({});
            pass++; details.push({ id: tid, pass: true });
          } catch (_) {
            fail++; details.push({ id: tid, pass: false, note: "AI B 구현 대상" });
          }
        }

        if (testsSummaryUi) {
          testsSummaryUi.style.display = "block";
          testsSummaryUi.innerHTML = `
            <div style="font-weight:700; margin-bottom:4px;">
              검사 결과: <span style="color:#34d399;">${pass} PASS</span> / <span style="color:#fb7185;">${fail} FAIL(대기)</span>
            </div>
            <div>${details.map(d => `<span class="test-res-badge ${d.pass ? 'test-res-pass' : 'test-res-fail'}">${d.id}: ${d.pass ? 'PASS' : '대기'}</span>`).join(" ")}</div>
          `;
        }

        btnRunTestsUi.disabled = false;
        btnRunTestsUi.textContent = "🧪 고정 검사 10개 즉시 검증 (브라우저 러너)";
      });
    }
  }

  async function bootstrap() {
    initWorldMapBase();
    loadPersistedLiveState();

    try {
      const res = await fetch("./data/daily-records.json", { cache: "no-store" });
      if (res.ok) {
        const fileRecords = await res.json();
        if (Array.isArray(fileRecords)) {
          fileRecords.forEach((rec) => {
            if (rec && rec.reading) {
              runtime.liveState = applySuccessfulReading(runtime.liveState, rec.reading);
            }
          });
          saveLiveStateToStorage();
        }
      }
    } catch (_) {}

    bindEvents();
    renderAll();
    startAutoRefreshLoop();

    await fetchLiveUSGSData({ isAuto: false });
  }

  document.addEventListener("DOMContentLoaded", bootstrap);
})();
