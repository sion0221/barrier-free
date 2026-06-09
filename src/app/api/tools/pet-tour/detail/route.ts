import { NextResponse } from "next/server";
import { normalizeText, unwrapEnnoiaBody } from "@/lib/normalize";
import type { PetTourDetailRequest } from "@/lib/types";
import type { AccessibilityStatus } from "@/types";

export async function POST(request: Request) {
  const body = (await unwrapEnnoiaBody(request)) as PetTourDetailRequest;

  if (!body?.contentId && !body?.title) {
    return Response.json(
      { detail: ["contentId 또는 title 중 하나가 필요합니다."], body: JSON.stringify(body) },
      { status: 422 }
    );
  }

  const serviceKey =
    process.env.KTO_PET_TOUR_SERVICE_KEY ??
    process.env.KTO_BARRIER_FREE_SERVICE_KEY ??
    process.env.KTO_SERVICE_KEY;

  let petName: string | null = null;
  let relisMetm: string | null = null;
  let matchType: "contentId" | "name_address_coordinate" | "none" = "none";
  let matchConfidence = 0;

  if (serviceKey && body.contentId) {
    const params = new URLSearchParams({
      serviceKey,
      contentId: body.contentId,
      MobileOS:  "ETC",
      MobileApp: "PetTourApp",
      _type:     "json",
    });
    try {
      const url =
        "https://apis.data.go.kr/B551011/KorPetTourService2/detailPetTour2?" +
        params.toString();
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        let item = data?.response?.body?.items?.item;
        if (Array.isArray(item)) item = item[0];
        if (item && typeof item === "object") {
          petName       = item.pettursmNm ?? item.petName  ?? null;
          relisMetm     = item.relisMetm  ?? item.rlisMetm ?? null;
          matchType     = "contentId";
          matchConfidence = 1.0;
        }
      }
    } catch (e) {
      console.error("[pet-tour/detail] contentId lookup:", e);
    }
  }

  if (serviceKey && matchType === "none" && (body.title || body.mapX != null)) {
    const params = new URLSearchParams({
      serviceKey,
      numOfRows: "5",
      pageNo:    "1",
      MobileOS:  "ETC",
      MobileApp: "PetTourApp",
      _type:     "json",
    });
    if (body.mapX != null) {
      params.set("mapX", String(body.mapX));
      params.set("mapY", String(body.mapY));
      params.set("radius", "500");
    }
    try {
      const url =
        "https://apis.data.go.kr/B551011/KorPetTourService2/locationBasedList2?" +
        params.toString();
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        let items = data?.response?.body?.items?.item ?? [];
        if (!Array.isArray(items)) items = [items];
        const q = (body.title ?? "").toLowerCase();
        const match = items.find((it: Record<string, unknown>) => {
          const t = String(it.title ?? "").toLowerCase();
          return t.includes(q) || q.includes(t);
        });
        if (match) {
          petName         = match.pettursmNm ?? match.petName  ?? null;
          relisMetm       = match.relisMetm  ?? match.rlisMetm ?? null;
          matchType       = "name_address_coordinate";
          matchConfidence = 0.7;
        }
      }
    } catch (e) {
      console.error("[pet-tour/detail] location lookup:", e);
    }
  }

  let petAllowedStatus: AccessibilityStatus = "확인 필요";
  if (petName && petName.trim() !== "") {
    if (relisMetm && relisMetm.trim() !== "" && relisMetm !== "없음") {
      const s = normalizeText(relisMetm);
      petAllowedStatus = s === "확인 필요" ? "제한적 가능" : s;
    } else {
      petAllowedStatus = "가능";
    }
  }

  const NA = "정보 없음";
  return NextResponse.json({
    contentId:        body.contentId ?? null,
    matchType,
    matchConfidence,
    petName,
    relisMetm,
    petAllowedStatus,
    evidence: {
      petName:   petName   ?? NA,
      relisMetm: relisMetm ?? NA,
    },
  });
}
