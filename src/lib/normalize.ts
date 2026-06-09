import type { AccessibilityStatus, VisitLevel } from "@/types";

// ─── 정규화 키워드 (AGENTS.md 5절 기준) ─────────────────────────────────────
const POSITIVE = ["있음", "설치", "가능", "이용 가능", "대여 가능", "구비", "마련"];
const LIMITED  = ["일부", "보조", "문의", "제한", "사전", "조건부", "보호자"];
const NEGATIVE = ["없음", "불가", "미설치", "이용 불가", "대여 불가"];

export function normalizeText(text: string | null | undefined): AccessibilityStatus {
  if (!text || text.trim() === "" || text === "null" || text === "undefined") {
    return "확인 필요";
  }
  if (NEGATIVE.some((k) => text.includes(k))) return "불가";
  if (LIMITED.some((k) => text.includes(k)))  return "제한적 가능";
  if (POSITIVE.some((k) => text.includes(k))) return "가능";
  return "확인 필요";
}

// ─── 점수 계산 (AGENTS.md 6절 기준) ─────────────────────────────────────────
const SCORE_WEIGHT: Record<string, number> = {
  route: 25, elevator: 20, restroom: 25, babycar: 15, pet: 15,
};
const SCORE_RATIO: Record<AccessibilityStatus, number> = {
  "가능": 1.0,
  "제한적 가능": 0.6,
  "확인 필요": 0.3,
  "불가": 0.0,
};

export function calcScore(statuses: Record<string, AccessibilityStatus>): number {
  let total = 0;
  for (const [key, weight] of Object.entries(SCORE_WEIGHT)) {
    const status = statuses[key] ?? "확인 필요";
    total += weight * (SCORE_RATIO[status as AccessibilityStatus] ?? 0.3);
  }
  return Math.round(total);
}

// ─── requiredConditions 한국어 → 내부 키 매핑 ───────────────────────────────
const CONDITION_MAP: Record<string, string> = {
  경사로: "route",   진입로: "route",   보행로: "route",
  엘리베이터: "elevator", 리프트: "elevator", 휠체어리프트: "elevator",
  장애인화장실: "restroom", 화장실: "restroom", restroom: "restroom",
  유모차: "babycar", "유모차 대여": "babycar", 유모차대여: "babycar",
  반려동물: "pet", "반려동물 동반": "pet", 반려동물동반: "pet",
  // 영문 snake_case (RequestParserAgent 출력값)
  route: "route", elevator: "elevator", babycar: "babycar",
  pet: "pet", pet_allowed: "pet", low_walking_burden: "restroom",
};

export function normalizeRequiredConditions(
  raw: string[] | Record<string, string>
): string[] {
  const list = Array.isArray(raw) ? raw : Object.keys(raw);
  return list.map((c) => {
    const trimmed = c.replace(/\s/g, "");
    return CONDITION_MAP[trimmed] ?? CONDITION_MAP[c] ?? c;
  });
}

// ─── 방문 적합도 판정 (AGENTS.md 7절 기준) ──────────────────────────────────
export function determineVisitLevel(
  score: number,
  statuses: Record<string, AccessibilityStatus>,
  requiredKeys: string[]
): VisitLevel {
  for (const key of requiredKeys) {
    if (statuses[key] === "불가") return "추천 제외";
  }
  if (score >= 80) return "안심 방문 가능";
  if (score >= 60) return "동행 시 방문 가능";
  if (score >= 40) return "부분 방문 가능";
  if (score >= 20) return "방문 전 확인 필요";
  return "추천 제외";
}

// ─── Ennoia body 언팩 ({"value": "<json-string>"} → 실제 객체) ──────────────
export async function unwrapEnnoiaBody(req: Request): Promise<unknown> {
  try {
    const body = await req.json();
    if (
      body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      "value" in body &&
      Object.keys(body).length === 1
    ) {
      const inner = (body as { value: unknown }).value;
      if (typeof inner === "string") {
        try { return JSON.parse(inner); } catch { return inner; }
      }
      return inner;
    }
    return body;
  } catch {
    return {};
  }
}

// ─── 422 에러 응답 빌더 (API_SCHEMA.md 기준) ────────────────────────────────
export function validationError(detail: string[], body: unknown) {
  return Response.json(
    { detail, body: JSON.stringify(body) },
    { status: 422 }
  );
}
