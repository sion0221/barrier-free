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
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("KTO API " + res.status);

    const data = await res.json();
    let items = data?.response?.body?.items?.item ?? [];
    if (!Array.isArray(items)) items = [items];

    const places = items.map((item: Record<string, unknown>) => ({
      contentId:     String(item.contentid ?? ""),
      contentTypeId: item.contenttypeid ? String(item.contenttypeid) : null,
      title:         String(item.title ?? ""),
      addr1:         item.addr1 ? String(item.addr1) : null,
      mapX:          item.mapx  ? parseFloat(String(item.mapx))  : null,
      mapY:          item.mapy  ? parseFloat(String(item.mapy))  : null,
      distance:      item.dist  ? parseInt(String(item.dist), 10) : null,
    }));

    return NextResponse.json({ places });
  } catch (e) {
    console.error("[barrier-free/search]", e);
    return NextResponse.json({ places: [] });
  }
}
