import { NextResponse } from "next/server";
import { unwrapEnnoiaBody } from "@/lib/normalize";
import type { BarrierFreeSearchResponse } from "@/lib/types";

const KTO_KEY = process.env.KTO_SERVICE_KEY;
const BASE = "https://apis.data.go.kr/B551011/KorWithService2/locationBasedList2";

export async function POST(req: Request) {
  const body = (await unwrapEnnoiaBody(req)) as { mapX?: number; mapY?: number; radius?: number; numOfRows?: number };
  const { mapX, mapY, radius = 3000, numOfRows = 10 } = body ?? {};

  if (!mapX || !mapY) {
    return NextResponse.json({ detail: ["mapX, mapY는 필수입니다."] }, { status: 422 });
  }
  if (!KTO_KEY) {
    console.error("[barrierFreeSearch] KTO_SERVICE_KEY 환경변수 없음");
    return NextResponse.json({ detail: ["KTO_SERVICE_KEY 환경변수가 설정되지 않았습니다."] }, { status: 500 });
  }

  try {
    const params = new URLSearchParams({
      serviceKey: KTO_KEY, MobileOS: "ETC", MobileApp: "어디GO",
      _type: "json", mapX: String(mapX), mapY: String(mapY),
      radius: String(radius), numOfRows: String(Math.min(numOfRows, 30)), pageNo: "1",
    });
    const res = await fetch(`${BASE}?${params}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`KTO HTTP ${res.status}`);
    const data = await res.json() as { response?: { body?: { items?: { item?: unknown[] | unknown } } } };
    const raw = data?.response?.body?.items?.item ?? [];
    const arr = (Array.isArray(raw) ? raw : [raw]) as Record<string, unknown>[];
    const places = arr.filter(Boolean).map((p) => ({
      contentId: String(p.contentid ?? ""),
      contentTypeId: p.contenttypeid ? String(p.contenttypeid) : null,
      title: String(p.title ?? ""),
      addr1: p.addr1 ? String(p.addr1) : null,
      mapX: p.mapx ? parseFloat(String(p.mapx)) : null,
      mapY: p.mapy ? parseFloat(String(p.mapy)) : null,
      distance: p.dist ? Math.round(parseFloat(String(p.dist))) : null,
    }));
    const result: BarrierFreeSearchResponse = { places };
    console.log(`[barrierFreeSearch] ${places.length}개 반환`);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[barrierFreeSearch] 오류:", e);
    return NextResponse.json({ detail: [`API 호출 오류: ${e instanceof Error ? e.message : e}`] }, { status: 500 });
  }
}
