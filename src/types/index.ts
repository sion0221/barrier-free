// src/types/index.ts

// 1. 접근성 및 편의시설 상태 정규화 타입 (설계서 5번 정책 반영)
export type AccessibilityStatus = "가능" | "제한적 가능" | "확인 필요" | "불가";

// 2. 방문 적합도 5단계 판정 타입 (설계서 7번 정책 반영)
export type VisitLevel =
  | "안심 방문 가능"
  | "동행 시 방문 가능"
  | "부분 방문 가능"
  | "방문 전 확인 필요"
  | "추천 제외";

// 3. 개별 관광지 카드 데이터 인터페이스
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
    // 공공데이터 공백 상황에 대비해 안전하게 string | null 처리로 보완합니다.
    route: string | null;
    elevator: string | null;
    restroom: string | null;
    babycar: string | null;
    petName: string | null;
    relisMetm: string | null;
  };
}

// 4. Ennoia Agent 최종 응답 전체 Schema (설계서 11번 반영)
export interface BarrierFreeDashboardResponse {
  summary: string;
  query: {
    locationText: string;
    mapX: number | null; // 예외 상황을 고려하여 null 허용으로 확장
    mapY: number | null; // 예외 상황을 고려하여 null 허용으로 확장
    radius: number;
    userTypes: string[];
    requiredConditions: string[];
    optionalConditions: string[];
  };
  cards: PlaceCardData[];
  excludedPlaces: {
    title: string;
    reason: string;
  }[];
  warnings: string[];
}
