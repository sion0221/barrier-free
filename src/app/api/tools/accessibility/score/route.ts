import { NextResponse } from "next/server";
import {
  calcScore,
  determineVisitLevel,
  normalizeRequiredConditions,
  unwrapEnnoiaBody,
  validationError,
} from "@/lib/normalize";
import type { ScoreAccessibilityRequest, ScoreAccessibilityResponse } from "@/lib/types";
import type { AccessibilityStatus } from "@/types";

// 키 → 한국어 레이블 (riskFactors / bestFor 생성용)
const KEY_LABEL: Record<string, string> = {
  route:    "진입로·경사로",
  elevator: "엘리베이터",
  restroom: "장애인 화장실",
  babycar:  "유모차 대여",
  pet:      "반려동물 허용",
};

export async function POST(request: Request) {
  const body = (await unwrapEnnoiaBody(request)) as ScoreAccessibilityRequest;

  if (!body?.statuses) {
    return validationError(["statuses 필드가 필요합니다."], body);
  }

  // requiredConditions 정규화 (list | dict 양쪽 허용)
  const rawRequired = body.requiredConditions ?? [];
  const requiredKeys = normalizeRequiredConditions(rawRequired);

  // statuses를 Record<string, AccessibilityStatus>로 변환
  const statuses = body.statuses as Record<string, AccessibilityStatus>;

  // 점수 계산
  const score = calcScore(statuses);

  // 방문 적합도 판정
  const visitLevel = determineVisitLevel(score, statuses, requiredKeys);

  const excluded = visitLevel === "추천 제외";
  let excludeReason: string | null = null;
  if (excluded) {
    const blockedKey = requiredKeys.find((k) => statuses[k] === "불가");
    excludeReason = blockedKey
      ? `필수 조건 미충족: ${KEY_LABEL[blockedKey] ?? blockedKey}`
      : "접근성 점수 미달 (20점 미만)";
  }

  // riskFactors: 불가 또는 확인 필요인 시설
  const riskFactors: string[] = [];
  for (const [key, label] of Object.entries(KEY_LABEL)) {
    const s = statuses[key];
    if (s === "불가")      riskFactors.push(`${label}: 이용 불가`);
    else if (s === "확인 필요") riskFactors.push(`${label}: 현장 확인 필요`);
  }

  // bestFor: 가능 상태인 시설
  const bestFor: string[] = [];
  for (const [key, label] of Object.entries(KEY_LABEL)) {
    if (statuses[key] === "가능") bestFor.push(label);
    else if (statuses[key] === "제한적 가능") bestFor.push(`${label} (제한적)`);
  }

  const result: ScoreAccessibilityResponse = {
    score,
    visitLevel,
    riskFactors,
    bestFor,
    excluded,
    excludeReason,
  };

  return NextResponse.json(result);
}
