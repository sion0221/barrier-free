import { NextResponse } from "next/server";
import { unwrapEnnoiaBody, validationError } from "@/lib/normalize";
import type { ResolveLocationRequest } from "@/lib/types";

const FALLBACK: Record<string, [number, number]> = {
  "서울역": [126.9707, 37.5547],
  "부산역": [129.0403, 35.1143],
  "강릉역": [128.8986, 37.7517],
  "광화문": [126.9769, 37.5759],
  "황대":       [126.9233, 37.5573],
  "명동":       [126.9847, 37.5636],
  "경복궁": [126.9769, 37.5796],
  "남산":       [126.9882, 37.5512],
  "동대문": [127.0088, 37.5668],
  "인사동": [126.9855, 37.5744],
  "해운대": [129.1604, 35.1588],
  "광안리": [129.1185, 35.1531],
  "제주":       [126.5312, 33.4996],
  "전주":       [127.1490, 35.8242],
  "경주":       [129.2115, 35.8563],
  "수원":       [127.0286, 37.2636],
  "인천":       [126.7052, 37.4563],
  "대전":       [127.3845, 36.3504],
  "대구":       [128.6014, 35.8714],
  "광주":       [126.8526, 35.1595],
};

export async function POST(request: Request) {
  const body = (await unwrapEnnoiaBody(request)) as ResolveLocationRequest;

  if (!body?.locationText) {
    return validationError(["locationText 필드가 필요합니다."], body);
  }

  const text = body.locationText.trim();

  for (const [key, [x, y]] of Object.entries(FALLBACK)) {
    if (text.includes(key)) {
      return NextResponse.json({
        locationText: text,
        mapX: x,
        mapY: y,
        confidence: 1.0,
        source: "fallback",
      });
    }
  }

  const kakaoKey = process.env.KAKAO_REST_API_KEY;
  if (kakaoKey) {
    try {
      const url =
        "https://dapi.kakao.com/v2/local/search/keyword.json?query=" +
        encodeURIComponent(text) +
        "&size=1";
      const res = await fetch(url, {
        headers: { Authorization: "KakaoAK " + kakaoKey },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        const docs = data?.documents ?? [];
        if (docs.length > 0) {
          return NextResponse.json({
            locationText: text,
            mapX: parseFloat(docs[0].x),
            mapY: parseFloat(docs[0].y),
            confidence: 0.9,
            source: "kakao_local",
          });
        }
      }
    } catch (e) {
      console.error("[location/resolve] kakao error:", e);
    }
  }

  return NextResponse.json({
    locationText: text,
    mapX: null,
    mapY: null,
    confidence: 0.0,
    source: "failed",
  });
}
