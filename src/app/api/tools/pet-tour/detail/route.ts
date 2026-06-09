import { NextResponse } from "next/server";
import { normalizeText, unwrapEnnoiaBody } from "@/lib/normalize";
import type { PetTourDetailResponse } from "@/lib/types";

const KTO_KEY = process.env.KTO_SERVICE_KEY;
const BASE = "https://apis.data.go.kr/B551011/KorPetTourService2/detailPetTour2";

export async function POST(req: Request) {
  const body = (await unwrapEnnoiaBody(req)) as {
    contentId?: string | null; title?: string | null;
    addr1?: string | null; mapX?: number | null; mapY?: number | null;
  };
  const { contentId, title } = body ?? {};

  if (!KTO_KEY) {
    console.error("[petTourDetail] KTO_SERVICE_KEY 환경변수 없음");
    return NextResponse.json({ detail: ["KTO_SERVICE_KEY 환경변수가 설정되지 않았습니다."] }, { status: 500 });
  }
  if (!contentId && !title) {
    return NextResponse.json({ detail: ["contentId 또는 title이 필요합니다."] }, { status: 422 });
  }

  try {
    const params = new URLSearchParams({
      serviceKey: KTO_KEY, MobileOS: "ETC", MobileApp: "어디GO",
      _type: "json", contentId: contentId ?? "",
    });
    const res = await fetch(`${BASE}?${params}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`KTO HTTP ${res.status}`);
    const data = await res.json() as { response?: { body?: { items?: { item?: unknown[] | unknown } } } };
    const raw = data?.response?.body?.items?.item;
    const item = (Array.isArray(raw) ? raw[0] : raw) as Record<string, string | null> | null;

    if (!item) {
      const result: PetTourDetailResponse = {
        contentId: contentId ?? null, matchType: "none", matchConfidence: 0,
        petName: null, relisMetm: null, petAllowedStatus: "확인 필요",
        evidence: { pet: "반려동물 동반여행 API에서 매칭되는 정보를 찾지 못함" },
      };
      return NextResponse.json(result);
    }

    const petName = item.acmpyPsblCpam ?? item.petName ?? null;
    const relisMetm = item.relisMetm ?? null;
    const result: PetTourDetailResponse = {
      contentId: contentId ?? null, matchType: "contentId", matchConfidence: 1.0,
      petName, relisMetm,
      petAllowedStatus: normalizeText(petName ?? relisMetm),
      evidence: { petName, relisMetm },
    };
    console.log("[petTourDetail] 완료:", contentId);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[petTourDetail] 오류:", e);
    return NextResponse.json({ detail: [`API 호출 오류: ${e instanceof Error ? e.message : e}`] }, { status: 500 });
  }
}
