import { NextResponse } from "next/server";
import { calcScore, determineVisitLevel, normalizeRequiredConditions, unwrapEnnoiaBody } from "@/lib/normalize";
import type { AccessibilityStatus, ScoreAccessibilityRequest, ScoreAccessibilityResponse } from "@/lib/types";

export async function POST(req: Request) {
  const body = (await unwrapEnnoiaBody(req)) as Partial<ScoreAccessibilityRequest>;
  const rawConditions = body?.requiredConditions ?? [];
  const rawStatuses = (body?.statuses ?? {}) as Record<string, AccessibilityStatus>;

  const requiredKeys = normalizeRequiredConditions(rawConditions);
  const score = calcScore(rawStatuses);
  const visitLevel = determineVisitLevel(score, rawStatuses, requiredKeys);

  const riskFactors: string[] = [];
  if (rawStatuses.route === "확인 필요") riskFactors.push("진입로·경사로 정보를 방문 전 확인하세요.");
  if (rawStatuses.route === "불가") riskFactors.push("진입로·경사로 접근이 어렵습니다.");
  if (rawStatuses.elevator === "확인 필요") riskFactors.push("엘리베이터 여부를 방문 전 확인하세요.");
  if (rawStatuses.restroom === "확인 필요") riskFactors.push("장애인 화장실 정보를 방문 전 확인하세요.");
  if (rawStatuses.restroom === "불가") riskFactors.push("장애인 화장실이 없습니다.");
  if (rawStatuses.pet === "제한적 가능") riskFactors.push("반려동물 동반 시 목줄·케이지 등 제한사항이 있을 수 있습니다.");
  if (rawStatuses.pet === "확인 필요") riskFactors.push("반려동물 동반 가능 여부를 방문 전 확인하세요.");

  const bestFor: string[] = [];
  if (rawStatuses.route === "가능" && rawStatuses.restroom === "가능") bestFor.push("휠체어 이용자");
  if (rawStatuses.elevator === "가능") bestFor.push("이동이 불편한 고령자");
  if (["가능", "제한적 가능"].includes(rawStatuses.babycar ?? "")) bestFor.push("영유아 동반자");
  if (["가능", "제한적 가능"].includes(rawStatuses.pet ?? "")) bestFor.push("반려동물 동반자");

  const excluded = visitLevel === "추천 제외";
  const excludeReason = excluded
    ? `필수 조건(${requiredKeys.join(", ")}) 중 불가 항목이 있습니다.`
    : null;

  const result: ScoreAccessibilityResponse = { score, visitLevel, riskFactors, bestFor, excluded, excludeReason };
  console.log(`[scoreAccessibility] score=${score} visitLevel=${visitLevel}`);
  return NextResponse.json(result);
}
