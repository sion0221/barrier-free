import { NextResponse } from "next/server";
import type {
  AccessibilityStatus,
  VisitLevel,
  PlaceCardData,
  BarrierFreeDashboardResponse,
} from "@/types";

// ── 요청 바디 ──────────────────────────────────────────────
interface FilterBody {
  locationText?: string;
  destination?: string;
  radius?: number;
  userTypes?: string[];
  conditions?: string[];
  preferences?: string[];
  excludes?: string[];
  courseRecommend?: boolean;
}

// ── 내부 Tool API 호출 헬퍼 ───────────────────────────────
const BASE =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

async function callTool<T = Record<string, unknown>>(
  path: string,
  body: unknown,
): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ── 타입 변환 ──────────────────────────────────────────────
function toStatus(val?: string): AccessibilityStatus {
  if (val === "가능") return "가능";
  if (val === "제한적 가능") return "제한적 가능";
  if (val === "불가") return "불가";
  return "확인 필요";
}

function toVisitLevel(val?: string): VisitLevel {
  const levels: VisitLevel[] = [
    "안심 방문 가능",
    "동행 시 방문 가능",
    "부분 방문 가능",
    "방문 전 확인 필요",
    "추천 제외",
  ];
  return levels.includes(val as VisitLevel)
    ? (val as VisitLevel)
    : "방문 전 확인 필요";
}

// ── 추천 이유 / 리스크 자동 생성 ─────────────────────────
function buildRecommendReason(
  title: string,
  statuses: PlaceCardData["statuses"],
  score: number,
): string {
  const good = (
    [
      [statuses.route, "경사로·보행로"],
      [statuses.elevator, "엘리베이터"],
      [statuses.restroom, "장애인 화장실"],
      [statuses.babycar, "유모차 대여"],
      [statuses.pet, "반려동물 동반"],
    ] as [AccessibilityStatus, string][]
  )
    .filter(([s]) => s === "가능")
    .map(([, label]) => label);

  if (good.length >= 3) {
    return `접근성 점수 ${score}점. ${good.slice(0, 3).join("·")} 시설이 확인되어 이동 약자에게 적합합니다.`;
  }
  if (good.length > 0) {
    return `접근성 점수 ${score}점. ${good.join("·")} 시설이 확인됩니다. 방문 전 추가 시설을 확인해 보세요.`;
  }
  return `접근성 점수 ${score}점. 시설 정보가 일부 미확인 상태로, 방문 전 현장 확인을 권장합니다.`;
}

function buildRiskFactors(statuses: PlaceCardData["statuses"]): string[] {
  const risks: string[] = [];
  if (statuses.route === "불가") risks.push("경사로 또는 보행로 접근이 불가합니다.");
  if (statuses.route === "확인 필요") risks.push("보행로 접근 정보가 불충분합니다.");
  if (statuses.elevator === "불가") risks.push("엘리베이터가 없습니다. 계단 이동이 필요할 수 있습니다.");
  if (statuses.restroom === "불가") risks.push("장애인 화장실이 없거나 이용이 불가합니다.");
  if (statuses.restroom === "확인 필요") risks.push("장애인 화장실 정보를 방문 전 확인해 주세요.");
  if (statuses.pet === "불가") risks.push("반려동물 동반이 불가합니다.");
  if (statuses.pet === "제한적 가능") risks.push("반려동물 동반 조건(목줄·케이지 등)을 사전 확인하세요.");
  return risks;
}

function buildCheckBeforeVisit(statuses: PlaceCardData["statuses"]): string[] {
  const checks: string[] = [];
  if (statuses.babycar === "확인 필요") checks.push("유모차·휠체어 대여 가능 여부");
  if (statuses.pet === "확인 필요" || statuses.pet === "제한적 가능") checks.push("반려동물 동반 가능 구역 및 규정");
  if (statuses.elevator === "확인 필요") checks.push("엘리베이터 위치 및 운영 여부");
  if (statuses.restroom === "확인 필요") checks.push("장애인 화장실 위치 및 이용 여부");
  if (checks.length === 0) checks.push("현장 상황은 사전 전화 확인을 권장합니다.");
  return checks;
}

function buildBestFor(
  statuses: PlaceCardData["statuses"],
  userTypes: string[],
): string[] {
  const best: string[] = [];
  if (statuses.route === "가능" && statuses.elevator === "가능") best.push("휠체어 이용자");
  if (statuses.restroom === "가능") best.push("고령자");
  if (statuses.babycar === "가능" || statuses.elevator === "가능") best.push("영유아 동반 가족");
  if (statuses.pet === "가능" || statuses.pet === "제한적 가능") best.push("반려동물 동반자");
  if (best.length === 0) best.push("일반 동행자");
  return best;
}

// ── POST 핸들러 ────────────────────────────────────────────
export async function POST(request: Request) {
  let body: FilterBody = {};
  try {
    body = (await request.json()) as FilterBody;
  } catch {
    body = {};
  }

  const locationText = body.locationText || "서울역";
  const radius = body.radius || 3000;
  const conditions = body.conditions || [];
  const hasPet = body.preferences?.includes("pet") || conditions.includes("pet");

  try {
    // ── 1. 위치 좌표 변환 ────────────────────────────────
    const loc = await callTool<{
      mapX: number | null;
      mapY: number | null;
      confidence: number;
      source: string;
    }>("/api/tools/location/resolve", { locationText });

    if (!loc?.mapX || !loc?.mapY) {
      return NextResponse.json(
        { success: false, error: `'${locationText}'의 좌표를 찾을 수 없습니다.` },
        { status: 400 },
      );
    }

    // ── 2. 무장애 관광지 검색 (결과 없으면 반경 자동 확대) ───
    type PlaceItem = {
      contentId: string; title: string; addr1: string | null;
      mapX: number | null; mapY: number | null; distance: number | null;
    };
    let places: PlaceItem[] = [];
    let usedRadius = radius;
    for (const tryRadius of [radius, 3000, 5000, 10000]) {
      usedRadius = tryRadius;
      const searchResult = await callTool<{ places: PlaceItem[] }>(
        "/api/tools/barrier-free/search",
        { mapX: loc.mapX, mapY: loc.mapY, radius: tryRadius, numOfRows: 15 },
      );
      places = searchResult?.places ?? [];
      if (places.length > 0) break;
    }

    if (places.length === 0) {
      const result: BarrierFreeDashboardResponse = {
        summary: `${locationText} 반경 ${usedRadius / 1000}km 내 배리어프리 관광지 데이터가 없습니다.`,
        query: {
          locationText,
          mapX: loc.mapX,
          mapY: loc.mapY,
          radius,
          userTypes: body.userTypes || [],
          requiredConditions: conditions,
          optionalConditions: body.preferences || [],
        },
        cards: [],
        excludedPlaces: [],
        warnings: ["검색 반경을 늘리거나 출발지를 변경해 보세요."],
      };
      return NextResponse.json({ success: true, ...result });
    }

    // ── 3. 각 장소 상세 + 반려동물 + 점수 병렬 수집 ───────
    const cardResults = await Promise.all(
      places.slice(0, 10).map(async (place) => {
        const [detail, pet] = await Promise.all([
          callTool<{
            normalized: {
              routeStatus?: string;
              elevatorStatus?: string;
              restroomStatus?: string;
              babycarStatus?: string;
            };
            evidence: Record<string, string | null>;
          }>("/api/tools/barrier-free/detail", { contentId: place.contentId }),
          hasPet
            ? callTool<{ petAllowedStatus: string; petName: string | null; relisMetm: string | null }>(
                "/api/tools/pet-tour/detail",
                {
                  contentId: place.contentId,
                  title: place.title,
                  mapX: place.mapX,
                  mapY: place.mapY,
                },
              )
            : Promise.resolve(null),
        ]);

        const statuses = {
          route: toStatus(detail?.normalized?.routeStatus),
          elevator: toStatus(detail?.normalized?.elevatorStatus),
          restroom: toStatus(detail?.normalized?.restroomStatus),
          babycar: toStatus(detail?.normalized?.babycarStatus),
          pet: toStatus(pet?.petAllowedStatus),
        };

        const scoreResult = await callTool<{
          score: number;
          visitLevel: string;
          riskFactors: string[];
          bestFor: string[];
          excluded: boolean;
          excludeReason: string | null;
        }>("/api/tools/accessibility/score", {
          requiredConditions: conditions,
          statuses,
        });

        return { place, statuses, detail, pet, scoreResult };
      }),
    );

    // ── 4. 카드 / 제외 장소 분류 ─────────────────────────
    const cards: PlaceCardData[] = [];
    const excludedPlaces: { title: string; reason: string }[] = [];

    for (const { place, statuses, detail, pet, scoreResult } of cardResults) {
      if (scoreResult?.excluded) {
        excludedPlaces.push({
          title: place.title,
          reason: scoreResult.excludeReason || "필수 조건 미충족",
        });
        continue;
      }

      const score = scoreResult?.score ?? 50;
      const visitLevel = toVisitLevel(scoreResult?.visitLevel);

      cards.push({
        contentId: place.contentId,
        title: place.title,
        address: place.addr1 || "주소 정보 없음",
        mapX: place.mapX ?? loc.mapX,
        mapY: place.mapY ?? loc.mapY,
        distance: place.distance ?? 0,
        score,
        visitLevel,
        statuses,
        recommendReason: buildRecommendReason(place.title, statuses, score),
        riskFactors: scoreResult?.riskFactors?.length
          ? scoreResult.riskFactors
          : buildRiskFactors(statuses),
        checkBeforeVisit: buildCheckBeforeVisit(statuses),
        bestFor: scoreResult?.bestFor?.length
          ? scoreResult.bestFor
          : buildBestFor(statuses, body.userTypes || []),
        evidence: {
          route: detail?.evidence?.route ?? null,
          elevator: detail?.evidence?.elevator ?? null,
          restroom: detail?.evidence?.restroom ?? null,
          babycar: detail?.evidence?.babycar ?? null,
          petName: pet?.petName ?? null,
          relisMetm: pet?.relisMetm ?? null,
        },
      });
    }

    // ── 5. 응답 조립 ──────────────────────────────────────
    const result: BarrierFreeDashboardResponse = {
      summary: `${locationText} 반경 ${usedRadius / 1000}km 내 배리어프리 관광지 ${cards.length}곳을 확인했습니다.`,
      query: {
        locationText,
        mapX: loc.mapX,
        mapY: loc.mapY,
        radius,
        userTypes: body.userTypes || [],
        requiredConditions: conditions,
        optionalConditions: body.preferences || [],
      },
      cards,
      excludedPlaces,
      warnings: [
        "한국관광공사 공공데이터 기준이며, 현장 상황과 다를 수 있습니다.",
        "정보가 없는 항목은 '확인 필요'로 표시됩니다.",
      ],
    };

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
