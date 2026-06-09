import { NextResponse } from "next/server";
import {
  AccessibilityStatus,
  VisitLevel,
  PlaceCardData,
  BarrierFreeDashboardResponse,
} from "@/types";

// ── 요청 바디 타입 ────────────────────────────────────────
interface DashboardRequestBody {
  locationText?: string;
  destination?: string;
  radius?: number;
  userTypes?: string[];
  conditions?: string[];
  preferences?: string[];
  excludes?: string[];
  courseRecommend?: boolean;
}

// ── 엔노이아 응답 청크 타입 ────────────────────────────────
interface EnnoiaChunk {
  type?: string;
  content?: string;
  delta?: { type?: string; text?: string };
  text?: string;
}

// ── 엔노이아가 반환하길 기대하는 JSON 구조 ─────────────────
interface EnnoiaPlaceCard {
  contentId?: string;
  title?: string;
  address?: string;
  mapX?: number;
  mapY?: number;
  distance?: number;
  score?: number;
  visitLevel?: string;
  statuses?: {
    route?: string;
    elevator?: string;
    restroom?: string;
    babycar?: string;
    pet?: string;
  };
  recommendReason?: string;
  riskFactors?: string[];
  checkBeforeVisit?: string[];
  bestFor?: string[];
  evidence?: {
    route?: string | null;
    elevator?: string | null;
    restroom?: string | null;
    babycar?: string | null;
    petName?: string | null;
    relisMetm?: string | null;
  };
}

interface EnnoiaResponseJson {
  cards?: EnnoiaPlaceCard[];
  excludedPlaces?: { title?: string; reason?: string }[];
  warnings?: string[];
  summary?: string;
}

// ── 프롬프트 생성 ──────────────────────────────────────────
function buildPrompt(body: DashboardRequestBody): string {
  const location = body.locationText || "서울역";
  const dest = body.destination ? ` → 도착지: ${body.destination}` : "";
  const radius = body.radius ? `${body.radius}m` : "2000m";
  const userTypes = (body.userTypes || ["wheelchair"]).join(", ");
  const conds = (body.conditions || []).join(", ") || "없음";
  const prefs = (body.preferences || []).join(", ") || "없음";
  const excls = (body.excludes || []).join(", ") || "없음";
  const course = body.courseRecommend ? "코스 추천 포함" : "단순 목록";

  return `
당신은 한국관광공사 배리어프리 관광지 추천 에이전트입니다.

[검색 조건]
- 출발지: ${location}${dest}
- 검색 반경: ${radius}
- 사용자 유형: ${userTypes}
- 필수 시설 조건: ${conds}
- 동행자 취향: ${prefs}
- 제외 조건: ${excls}
- 결과 방식: ${course}

위 조건에 맞는 배리어프리 관광지를 조회하여 **반드시 아래 JSON 형식으로만** 응답하세요.
다른 설명, 마크다운, 코드블록 없이 순수 JSON만 출력하세요.

{
  "summary": "한 줄 요약",
  "cards": [
    {
      "contentId": "고유ID",
      "title": "장소명",
      "address": "주소",
      "mapX": 경도숫자,
      "mapY": 위도숫자,
      "distance": 거리m정수,
      "score": 0~100점수,
      "visitLevel": "안심 방문 가능 | 동행 시 방문 가능 | 부분 방문 가능 | 방문 전 확인 필요",
      "statuses": {
        "route":    "가능 | 제한적 가능 | 확인 필요 | 불가",
        "elevator": "가능 | 제한적 가능 | 확인 필요 | 불가",
        "restroom": "가능 | 제한적 가능 | 확인 필요 | 불가",
        "babycar":  "가능 | 제한적 가능 | 확인 필요 | 불가",
        "pet":      "가능 | 제한적 가능 | 확인 필요 | 불가"
      },
      "recommendReason": "추천 이유 한 문장",
      "riskFactors": ["리스크 항목"],
      "checkBeforeVisit": ["사전 확인 항목"],
      "bestFor": ["적합 대상"],
      "evidence": {
        "route":    "원문 또는 null",
        "elevator": "원문 또는 null",
        "restroom": "원문 또는 null",
        "babycar":  "원문 또는 null",
        "petName":  "반려동물명 또는 null",
        "relisMetm":"동반 제한 내용 또는 null"
      }
    }
  ],
  "excludedPlaces": [
    { "title": "제외된 장소명", "reason": "제외 이유" }
  ],
  "warnings": ["유의사항 문구"]
}
`.trim();
}

// ── 스트리밍 응답 텍스트 수집 ──────────────────────────────
async function readStreamToText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder("utf-8");
  let accumulated = "";

  if (!reader) throw new Error("스트림 리더를 초기화할 수 없습니다.");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });

    // SSE 형식(data: ...) 파싱
    const lines = chunk.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "data: [DONE]") continue;

      if (trimmed.startsWith("data:")) {
        const jsonStr = trimmed.slice(5).trim();
        try {
          const parsed = JSON.parse(jsonStr) as EnnoiaChunk;
          // 다양한 청크 구조 대응
          if (parsed.delta?.text) accumulated += parsed.delta.text;
          else if (parsed.content) accumulated += parsed.content;
          else if (parsed.text) accumulated += parsed.text;
        } catch {
          // 파싱 불가 청크는 그대로 누적
          accumulated += jsonStr;
        }
      } else {
        accumulated += trimmed;
      }
    }
  }

  return accumulated;
}

// ── 에노이아 텍스트 → 타입 정규화 ────────────────────────
function toAccessibilityStatus(val?: string): AccessibilityStatus {
  if (!val) return "확인 필요";
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

// ── JSON 추출 (마크다운 펜스 등 방어 처리) ────────────────
function extractJson(text: string): string {
  // ```json ... ``` 블록 제거
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();

  // { ... } 범위만 추출
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);

  return text.trim();
}

// ── 에노이아 응답 → BarrierFreeDashboardResponse 변환 ────
function parseEnnoiaResponse(
  rawText: string,
  body: DashboardRequestBody,
): BarrierFreeDashboardResponse {
  let parsed: EnnoiaResponseJson = {};

  try {
    const jsonStr = extractJson(rawText);
    parsed = JSON.parse(jsonStr) as EnnoiaResponseJson;
  } catch {
    // JSON 파싱 실패 시 빈 결과 반환
    return {
      summary: "에이전트 응답 파싱 실패",
      query: {
        locationText: body.locationText || "서울역",
        mapX: null,
        mapY: null,
        radius: body.radius || 2000,
        userTypes: body.userTypes || [],
        requiredConditions: body.conditions || [],
        optionalConditions: body.preferences || [],
      },
      cards: [],
      excludedPlaces: [],
      warnings: [
        "에이전트 응답을 파싱하는 중 오류가 발생했습니다. 다시 시도해 주세요.",
      ],
    };
  }

  const cards: PlaceCardData[] = (parsed.cards || []).map((c, idx) => ({
    contentId: c.contentId || String(idx + 1),
    title: c.title || "이름 없음",
    address: c.address || "주소 정보 없음",
    mapX: c.mapX || 0,
    mapY: c.mapY || 0,
    distance: c.distance || 0,
    score: Math.min(100, Math.max(0, c.score || 50)),
    visitLevel: toVisitLevel(c.visitLevel),
    statuses: {
      route: toAccessibilityStatus(c.statuses?.route),
      elevator: toAccessibilityStatus(c.statuses?.elevator),
      restroom: toAccessibilityStatus(c.statuses?.restroom),
      babycar: toAccessibilityStatus(c.statuses?.babycar),
      pet: toAccessibilityStatus(c.statuses?.pet),
    },
    recommendReason: c.recommendReason || "접근성이 우수한 관광지입니다.",
    riskFactors: c.riskFactors || [],
    checkBeforeVisit: c.checkBeforeVisit || [],
    bestFor: c.bestFor || [],
    evidence: {
      route: c.evidence?.route || null,
      elevator: c.evidence?.elevator || null,
      restroom: c.evidence?.restroom || null,
      babycar: c.evidence?.babycar || null,
      petName: c.evidence?.petName || null,
      relisMetm: c.evidence?.relisMetm || null,
    },
  }));

  return {
    summary: parsed.summary || "에노이아 에이전트 조회 완료",
    query: {
      locationText: body.locationText || "서울역",
      mapX: null,
      mapY: null,
      radius: body.radius || 2000,
      userTypes: body.userTypes || [],
      requiredConditions: body.conditions || [],
      optionalConditions: body.preferences || [],
    },
    cards,
    excludedPlaces: (parsed.excludedPlaces || []).map((p) => ({
      title: p.title || "알 수 없음",
      reason: p.reason || "조건 미충족",
    })),
    warnings: parsed.warnings || ["현장 사정에 따라 다를 수 있습니다."],
  };
}

// ── POST 핸들러 ────────────────────────────────────────────
export async function POST(request: Request) {
  let body: DashboardRequestBody = {};
  try {
    body = (await request.json()) as DashboardRequestBody;
  } catch {
    body = {};
  }

  const apiKey = process.env.ENNOIA_API_KEY;
  const project = process.env.ENNOIA_PROJECT;
  if (!apiKey || !project) {
    return NextResponse.json(
      {
        success: false,
        error: "ENNOIA_API_KEY 또는 ENNOIA_PROJECT 환경변수 누락",
      },
      { status: 500 },
    );
  }

  const prompt = buildPrompt(body);

  try {
    const ennoiaRes = await fetch(
      "https://api.ennoia.so/api/llm-orchestrator/chat/stream/d6feedac5a/1",
      {
        method: "POST",
        headers: {
          project: project,
          apiKey: apiKey,
          "Content-Type": "application/json; charset=utf-8",
          "X-ENNOIA-USER-ID": process.env.ENNOIA_USER_ID || project,
        },
        body: JSON.stringify({
          multiAgentId: "d6feedac5a",
          multiAgentVersion: "1",
          messages: [
            {
              role: "user",
              content: [{ type: "text", text: prompt }],
            },
          ],
        }),
      },
    );

    if (!ennoiaRes.ok) {
      const errText = await ennoiaRes.text();
      throw new Error(`에노이아 API 오류 ${ennoiaRes.status}: ${errText}`);
    }

    const rawText = await readStreamToText(ennoiaRes);
    const parsed = parseEnnoiaResponse(rawText, body);

    return NextResponse.json({ success: true, ...parsed });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
