import { NextResponse } from "next/server";
import { normalizeText, unwrapEnnoiaBody, validationError } from "@/lib/normalize";
import type { BarrierFreeDetailRequest } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await unwrapEnnoiaBody(request)) as BarrierFreeDetailRequest;

  if (!body?.contentId) {
    return validationError(["contentId 필드가 필요합니다."], body);
  }

  const serviceKey =
    process.env.KTO_BARRIER_FREE_SERVICE_KEY ??
    process.env.KTO_SERVICE_KEY;

  const raw = {
    route:    null as string | null,
    elevator: null as string | null,
    restroom: null as string | null,
    babycar:  null as string | null,
  };

  if (serviceKey) {
    const params = new URLSearchParams({
      serviceKey,
      contentId: body.contentId,
      MobileOS:  "ETC",
      MobileApp: "BarrierFreeApp",
      _type:     "json",
    });

    const url =
      "https://apis.data.go.kr/B551011/KorWithService2/detailWithTour2?" +
      params.toString();

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        let item = data?.response?.body?.items?.item;
        if (Array.isArray(item)) item = item[0];
        if (item && typeof item === "object") {
          raw.route    = item.route    ?? item.wheelchair ?? null;
          raw.elevator = item.elevator ?? null;
          raw.restroom = item.restroom ?? item.toilet     ?? null;
          raw.babycar  = item.babycar  ?? item.stroller   ?? null;
        }
      }
    } catch (e) {
      console.error("[barrier-free/detail]", e);
    }
  }

  const NA = "정보 없음";

  return NextResponse.json({
    contentId: body.contentId,
    route:     raw.route,
    elevator:  raw.elevator,
    restroom:  raw.restroom,
    babycar:   raw.babycar,
    normalized: {
      routeStatus:    normalizeText(raw.route),
      elevatorStatus: normalizeText(raw.elevator),
      restroomStatus: normalizeText(raw.restroom),
      babycarStatus:  normalizeText(raw.babycar),
    },
    evidence: {
      route:    raw.route    ?? NA,
      elevator: raw.elevator ?? NA,
      restroom: raw.restroom ?? NA,
      babycar:  raw.babycar  ?? NA,
    },
  });
}
