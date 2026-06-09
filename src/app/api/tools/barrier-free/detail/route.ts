import { NextResponse } from "next/server";
import { normalizeText, unwrapEnnoiaBody } from "@/lib/normalize";
import type { BarrierFreeDetailResponse } from "@/lib/types";

const KTO_KEY = process.env.KTO_SERVICE_KEY;
const BASE = "https://apis.data.go.kr/B551011/KorWithService2/detailWithTour2";

export async function POST(req: Request) {
  const body = (await unwrapEnnoiaBody(req)) as { contentId?: string };
  const contentId = (body?.contentId ?? "").trim();

  if (!contentId) {
    return NextResponse.json({ detail: ["contentId는 필수입니다."] }, { status: 422 });
  }
  if (!KTO_KEY) {
    console.error("[barrierFreeDetail] KTO_SERVICE_KEY 환경변수 없음");
    return NextResponse.json({ detail: ["KTO_SERVICE_KEY 환경변수가 설정되지 않았습니다."] }, { status: 500 });
  }

  try {
    const params = new URLSearchParams({
      serviceKey: KTO_KEY, MobileOS: "ETC", MobileApp: "어디GO",
      _type: "json", contentId,
    });
    const res = await fetch(`${BASE}?${params}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`KTO HTTP ${res.status}`);
    const data = await res.json() as { response?: { body?: { items?: { item?: unknown[] | unknown } } } };
    const raw = data?.response?.body?.items?.item;
    const item = (Array.isArray(raw) ? raw[0] : raw) as Record<string, string | null> ?? {};

    const route = item.route ?? item.wheelchair ?? null;
    const elevator = item.elevator ?? null;
    const restroom = item.restroom ?? item.handicapToilet ?? null;
    const babycar = item.babycar ?? item.strollerRental ?? null;

    const result: BarrierFreeDetailResponse = {
      contentId, route, elevator, restroom, babycar,
      normalized: {
        routeStatus: normalizeText(route),
        elevatorStatus: normalizeText(elevator),
        restroomStatus: normalizeText(restroom),
        babycarStatus: normalizeText(babycar),
      },
      evidence: { route, elevator, restroom, babycar },
    };
    console.log(`[barrierFreeDetail] ${contentId} 완료`);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[barrierFreeDetail] 오류:", e);
    return NextResponse.json({ detail: [`API 호출 오류: ${e instanceof Error ? e.message : e}`] }, { status: 500 });
  }
}
