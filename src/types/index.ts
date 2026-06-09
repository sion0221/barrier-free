// ── 접근성 상태 4단계 ────────────────────────────────────────────────────────
export type AccessibilityStatus =
  | "가능"
  | "제한적 가능"
  | "확인 필요"
  | "불가";

// ── 방문 적합도 5단계 ────────────────────────────────────────────────────────
export type VisitLevel =
  | "안심 방문 가능"
  | "동행 시 방문 가능"
  | "부분 방문 가능"
  | "방문 전 확인 필요"
  | "추천 제외";

// ── 개별 장소 카드 ────────────────────────────────────────────────────────────
export interface PlaceCardData {
  contentId: string;
  title: string;
  address: string;
  mapX: number;
  mapY: number;
  distance: number;
  score: number;
  visitLevel: VisitLevel;
  statuses: {
    route: AccessibilityStatus;
    elevator: AccessibilityStatus;
    restroom: AccessibilityStatus;
    babycar: AccessibilityStatus;
    pet: AccessibilityStatus;
  };
  recommendReason: string;
  riskFactors: string[];
  checkBeforeVisit: string[];
  bestFor: string[];
  evidence: {
    route: string | null;
    elevator: string | null;
    restroom: string | null;
    babycar: string | null;
    petName: string | null;
    relisMetm: string | null;
  };
}

// ── 조건 미충족 장소 ──────────────────────────────────────────────────────────
export interface ExcludedPlace {
  title: string;
  reason: string;
}

// ── 대시보드 전체 응답 ────────────────────────────────────────────────────────
export interface BarrierFreeDashboardResponse {
  summary: string;
  query: {
    locationText: string;
    mapX: number | null;
    mapY: number | null;
    radius: number;
    userTypes: string[];
    requiredConditions: string[];
    optionalConditions: string[];
  };
  cards: PlaceCardData[];
  excludedPlaces: ExcludedPlace[];
  warnings: string[];
}
