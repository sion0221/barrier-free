import { NextResponse } from "next/server";
import { unwrapEnnoiaBody, validationError } from "@/lib/normalize";
import type { BarrierFreeSearchRequest } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await unwrapEnnoiaBody(request)) as BarrierFreeSearchRequest;

  if (body.mapX == null || body.mapY == null) {
    return validationError(["mapX, mapY 필드가 필요합니다."], body);
  }

  const serviceKey =
    process.env.KTO_BARRIER_FREE_SERVICE_KEY ??
    process.env.KTO_SERVICE_KEY;

  const radius    = body.radius    ?? 3000;
  const numOfRows = Math.min(body.numOfRows ?? 10, 100);

  if (!serviceKey) {
    return NextResponse.json({ places: [] });
  }

  const params = new URLSearchParams({
    serviceKey,
    numOfRows: String(numOfRows),
    pageNo:    "1",
    MobileOS:  "ETC",
    MobileApp: "BarrierFreeApp",
    _type:     "json",
    mapX:      String(body.mapX),
    mapY:      String(body.mapY),
    radius:    String(radius),
  });

  const url =
    "https://apis.data.go.kr/B551011/TarRlteTarService/locationBasedList1?" +
    params.toString();

  try {
    console.log("[barrier-free/search] 요청:", { mapX: body.mapX, mapY: body.mapY, radius });
    const res = await fetch(url, { cache: "no-store" });
    const rawText = await res.text();

    if (!res.ok) {
      console.error("[barrier-free/search] HTTP 오류:", res.status, rawText.slice(0, 200));
      return NextResponse.json({ places: [] });
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error("[barrier-free/search] JSON 파싱 실패:", rawText.slice(0, 200));
      return NextResponse.json({ places: [] });
    }

    const header = (data as { response?: { header?: { resultCode?: string; resultMsg?: string } } })
      ?.response?.header;
    const resultCode = header?.resultCode;
    const resultMsg  = header?.resultMsg;

    if (resultCode && resultCode !== "0000") {
      console.error("[barrier-free/search] KTO 에러:", resultCode, resultMsg);
      return NextResponse.json({ places: [], error: `KTO API 오류: ${resultCode} ${resultMsg}` });
    }

    const totalCount = (data as { response?: { body?: { totalCount?: number } } })
      ?.response?.body?.totalCount ?? 0;
    console.log("[barrier-free/search] totalCount:", totalCount, "| radius:", radius);

    let items: unknown = (data as { response?: { body?: { items?: { item?: unknown } } } })
      ?.response?.body?.items?.item ?? [];
    if (!Array.isArray(items)) items = items ? [items] : [];

    const places = (items as Record<string, unknown>[]).map((item) => ({
      contentId:     String(item.contentid ?? ""),
      contentTypeId: item.contenttypeid ? String(item.contenttypeid) : null,
      title:         String(item.title ?? ""),
      addr1:         item.addr1 ? String(item.addr1) : null,
      mapX:          item.mapx  ? parseFloat(String(item.mapx))  : null,
      mapY:          item.mapy  ? parseFloat(String(item.mapy))  : null,
      distance:      item.dist  ? parseInt(String(item.dist), 10) : null,
    }));

    console.log("[barrier-free/search] 결과:", places.length, "개");
    return NextResponse.json({ places });
  } catch (e) {
    console.error("[barrier-free/search] 예외:", e);
    return NextResponse.json({ places: [] });
  }
}
