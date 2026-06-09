import { NextResponse } from "next/server";
import { unwrapEnnoiaBody } from "@/lib/normalize";
import type { ResolveLocationResponse } from "@/lib/types";

const FALLBACK: Record<string, { mapX: number; mapY: number }> = {
  "서울역": { mapX: 126.9707, mapY: 37.5547 },
  "경복궁": { mapX: 126.9770, mapY: 37.5796 },
  "명동": { mapX: 126.9858, mapY: 37.5636 },
  "강남역": { mapX: 127.0276, mapY: 37.4979 },
  "홍대": { mapX: 126.9240, mapY: 37.5574 },
  "이태원": { mapX: 126.9944, mapY: 37.5349 },
  "여의도": { mapX: 126.9246, mapY: 37.5219 },
  "인사동": { mapX: 126.9854, mapY: 37.5743 },
  "광화문": { mapX: 126.9769, mapY: 37.5758 },
  "잠실": { mapX: 127.1005, mapY: 37.5133 },
  "동대문": { mapX: 127.0095, mapY: 37.5707 },
  "남대문": { mapX: 126.9756, mapY: 37.5597 },
  "북촌": { mapX: 126.9822, mapY: 37.5814 },
  "부산역": { mapX: 129.0403, mapY: 35.1149 },
  "해운대": { mapX: 129.1604, mapY: 35.1587 },
  "제주": { mapX: 126.5312, mapY: 33.4996 },
  "대구역": { mapX: 128.6250, mapY: 35.8798 },
  "대전역": { mapX: 127.4349, mapY: 36.3324 },
  "인천공항": { mapX: 126.4512, mapY: 37.4602 },
  "수원": { mapX: 127.0286, mapY: 37.2636 },
};

export async function POST(req: Request) {
  const body = (await unwrapEnnoiaBody(req)) as { locationText?: string };
  const locationText = (body?.locationText ?? "").trim();

  if (!locationText) {
    return NextResponse.json({ detail: ["locationText는 필수입니다."] }, { status: 422 });
  }

  for (const [key, coord] of Object.entries(FALLBACK)) {
    if (locationText.includes(key)) {
      const result: ResolveLocationResponse = {
        locationText, mapX: coord.mapX, mapY: coord.mapY, confidence: 1.0, source: "fallback",
      };
      console.log("[resolveLocation] fallback:", key, result);
      return NextResponse.json(result);
    }
  }

  const kakaoKey = process.env.KAKAO_REST_API_KEY;
  if (kakaoKey) {
    try {
      const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(locationText)}&size=1`;
      const res = await fetch(url, { headers: { Authorization: `KakaoAK ${kakaoKey}` } });
      if (res.ok) {
        const data = await res.json() as { documents?: { x: string; y: string }[] };
        const doc = data?.documents?.[0];
        if (doc?.x && doc?.y) {
          const result: ResolveLocationResponse = {
            locationText, mapX: parseFloat(doc.x), mapY: parseFloat(doc.y), confidence: 0.9, source: "kakao_local",
          };
          console.log("[resolveLocation] kakao:", result);
          return NextResponse.json(result);
        }
      }
    } catch (e) {
      console.warn("[resolveLocation] Kakao 오류:", e);
    }
  }

  console.warn("[resolveLocation] 좌표 변환 실패:", locationText);
  return NextResponse.json({ locationText, mapX: null, mapY: null, confidence: 0, source: "failed" } as ResolveLocationResponse);
}
