import { NextResponse } from "next/server";
import type { BarrierFreeDashboardResponse } from "@/types";

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

function buildQuery(body: FilterBody): string {
  const location = body.locationText || body.destination || "서울역";
  const radius = (body.radius || 3000) / 1000;

  const conditionMap: Record<string, string> = {
    route:    "경사로/보행로 접근",
    elevator: "엘리베이터",
    restroom: "장애인 화장실",
    babycar:  "유모차 대여",
    pet:      "반려동물 동반",
  };
  const userTypeMap: Record<string, string> = {
    wheelchair:    "휠체어 이용자",
    senior:        "고령자",
    infant:        "영유아 동반자",
    pet_companion: "반려동물 동반자",
    general:       "일반 동행자",
  };

  const conditions = (body.conditions || []).map((c) => conditionMap[c] || c);
  const userTypes  = (body.userTypes  || []).map((t) => userTypeMap[t] || t);

  let query = `${location} 근처 반경 ${radius}km 내 배리어프리 관광지를 찾아줘.`;
  if (userTypes.length > 0)  query += ` 동행자: ${userTypes.join(", ")}.`;
  if (conditions.length > 0) query += ` 필수 조건: ${conditions.join(", ")}.`;
  if (body.preferences?.includes("pet")) query += " 반려동물 동반 가능한 곳이면 좋겠어.";
  if (body.courseRecommend) query += " 하루 코스로 추천해줘.";

  return query;
}

export async function POST(request: Request) {
  let body: FilterBody = {};
  try {
    body = (await request.json()) as FilterBody;
  } catch {
    body = {};
  }

  const apiKey  = process.env.ENNOIA_API_KEY;
  const project = process.env.ENNOIA_PROJECT;
  const hash    = process.env.ENNOIA_AGENT_HASH;

  if (!apiKey || !project || !hash) {
    console.error("[/api/tour] Ennoia 환경변수 누락:", { apiKey: !!apiKey, project: !!project, hash: !!hash });
    return NextResponse.json(
      { success: false, error: "Ennoia 환경변수가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const query = buildQuery(body);
  console.log("[/api/tour] Ennoia 요청 쿼리:", query);

  try {
    const res = await fetch("https://api.ennoia.so/api/preset/v2/chat/completions", {
      method: "POST",
      headers: {
        project,
        apiKey,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        hash,
        params: {},
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: query }],
          },
        ],
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[/api/tour] Ennoia HTTP 오류:", res.status, text.slice(0, 300));
      return NextResponse.json(
        { success: false, error: `Ennoia API 오류: ${res.status}` },
        { status: 500 }
      );
    }

    const data = await res.json();
    console.log("[/api/tour] Ennoia 원본 응답:", JSON.stringify(data).slice(0, 500));

    // Ennoia 응답에서 content 추출 (OpenAI 호환 포맷)
    const content: string =
      data?.choices?.[0]?.message?.content ??
      data?.message?.content ??
      data?.content ??
      "";

    // content가 JSON 문자열이면 파싱
    let result: BarrierFreeDashboardResponse;
    try {
      const parsed = typeof content === "string" ? JSON.parse(content) : content;
      result = {
        summary:       parsed.summary        ?? "결과를 가져왔습니다.",
        query:         parsed.query          ?? {
          locationText:       body.locationText || "서울역",
          mapX:               null,
          mapY:               null,
          radius:             body.radius || 3000,
          userTypes:          body.userTypes || [],
          requiredConditions: body.conditions || [],
          optionalConditions: body.preferences || [],
        },
        cards:          parsed.cards          ?? [],
        excludedPlaces: parsed.excludedPlaces ?? [],
        warnings:       parsed.warnings       ?? [],
      };
    } catch {
      // JSON 파싱 실패 시 텍스트 요약으로 반환
      console.warn("[/api/tour] JSON 파싱 실패, 텍스트 응답 처리");
      result = {
        summary:       typeof content === "string" ? content : "결과를 가져왔습니다.",
        query: {
          locationText:       body.locationText || "서울역",
          mapX:               null,
          mapY:               null,
          radius:             body.radius || 3000,
          userTypes:          body.userTypes || [],
          requiredConditions: body.conditions || [],
          optionalConditions: body.preferences || [],
        },
        cards:          [],
        excludedPlaces: [],
        warnings:       ["응답을 카드 형태로 파싱하지 못했습니다. 에이전트 설정을 확인하세요."],
      };
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("[/api/tour] 예외:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
