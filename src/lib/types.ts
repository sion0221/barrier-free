// Tool API 전용 요청/응답 타입 (AGENTS.md + API_SCHEMA.md 기준)
// AccessibilityStatus, VisitLevel 은 @/types 에서 가져옵니다.
export type { AccessibilityStatus, VisitLevel } from "@/types";
import type { AccessibilityStatus } from "@/types";

// ── /tools/location/resolve ──────────────────────────────────────────────────
export interface ResolveLocationRequest {
  locationText: string;
}
export interface ResolveLocationResponse {
  locationText: string;
  mapX: number | null;
  mapY: number | null;
  confidence: number;
  source: "fallback" | "kakao_local" | "failed";
}

// ── /tools/barrier-free/search ───────────────────────────────────────────────
export interface BarrierFreeSearchRequest {
  mapX: number;
  mapY: number;
  radius?: number;
  numOfRows?: number;
}
export interface BarrierFreePlace {
  contentId: string;
  contentTypeId: string | null;
  title: string;
  addr1: string | null;
  mapX: number | null;
  mapY: number | null;
  distance: number | null;
}
export interface BarrierFreeSearchResponse {
  places: BarrierFreePlace[];
}

// ── /tools/barrier-free/detail ───────────────────────────────────────────────
export interface BarrierFreeDetailRequest {
  contentId: string;
}
export interface BarrierFreeNormalized {
  routeStatus: AccessibilityStatus;
  elevatorStatus: AccessibilityStatus;
  restroomStatus: AccessibilityStatus;
  babycarStatus: AccessibilityStatus;
}
export interface BarrierFreeDetailResponse {
  contentId: string;
  route: string | null;
  elevator: string | null;
  restroom: string | null;
  babycar: string | null;
  normalized: BarrierFreeNormalized;
  evidence: Record<string, string | null>;
}

// ── /tools/pet-tour/detail ───────────────────────────────────────────────────
export interface PetTourDetailRequest {
  contentId?: string | null;
  title?: string | null;
  addr1?: string | null;
  mapX?: number | null;
  mapY?: number | null;
}
export interface PetTourDetailResponse {
  contentId: string | null;
  matchType: "contentId" | "name_address_coordinate" | "none";
  matchConfidence: number;
  petName: string | null;
  relisMetm: string | null;
  petAllowedStatus: AccessibilityStatus;
  evidence: Record<string, string | null>;
}

// ── /tools/accessibility/score ───────────────────────────────────────────────
export interface ScoreAccessibilityRequest {
  // list[string] 또는 dict[string,string] 양쪽 허용 (API_SCHEMA.md Tip 참고)
  requiredConditions: string[] | Record<string, string>;
  statuses: {
    route?: AccessibilityStatus;
    elevator?: AccessibilityStatus;
    restroom?: AccessibilityStatus;
    babycar?: AccessibilityStatus;
    pet?: AccessibilityStatus;
  };
}
export interface ScoreAccessibilityResponse {
  score: number;
  visitLevel: import("@/types").VisitLevel;
  riskFactors: string[];
  bestFor: string[];
  excluded: boolean;
  excludeReason: string | null;
}
