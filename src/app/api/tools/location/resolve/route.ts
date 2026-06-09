import { NextResponse } from "next/server";
import { unwrapEnnoiaBody, validationError } from "@/lib/normalize";
import type { ResolveLocationRequest } from "@/lib/types";

const FALLBACK: Record<string, [number, number]> = {
  "서울역": [126.9707, 37.5547],
  "서울": [126.9784, 37.5665],
  "광화문": [126.9769, 37.5759],
  "황대": [126.9233, 37.5573],
  "홍대": [126.9233, 37.5573],
  "명동": [126.9847, 37.5636],
  "경복궁": [126.9769, 37.5796],
  "남산": [126.9882, 37.5512],
  "동대문": [127.0088, 37.5668],
  "인사동": [126.9855, 37.5744],
  "강남": [127.0276, 37.4979],
  "잠실": [127.1000, 37.5133],
  "여의도": [126.9244, 37.5219],
  "이태원": [126.9943, 37.5344],
  "북촌": [126.9845, 37.5820],
  "해운대": [129.1604, 35.1588],
  "광안리": [129.1185, 35.1531],
  "경기도": [127.0086, 37.2750],
  "경기": [127.0086, 37.2750],
  "인천": [126.7052, 37.4563],
  "강원도": [128.2098, 37.8813],
  "강원": [128.2098, 37.8813],
  "충청북도": [127.7291, 36.6357],
  "충북": [127.7291, 36.6357],
  "충청남도": [126.8007, 36.5184],
  "충남": [126.8007, 36.5184],
  "전라북도": [127.1490, 35.8242],
  "전북": [127.1490, 35.8242],
  "전라남도": [126.9890, 34.8679],
  "전남": [126.9890, 34.8679],
  "경상북도": [128.7278, 36.5760],
  "경북": [128.7278, 36.5760],
  "경상남도": [128.2132, 35.2383],
  "경남": [128.2132, 35.2383],
  "제주도": [126.5312, 33.4996],
  "제주": [126.5312, 33.4996],
  "부산": [129.0403, 35.1143],
  "부산역": [129.0403, 35.1143],
  "대전": [127.3845, 36.3504],
  "대구": [128.6014, 35.8714],
  "광주": [126.8526, 35.1595],
  "울산": [129.3114, 35.5384],
  "세종": [127.2894, 36.4800],
  "수원": [127.0286, 37.2636],
  "수원화성": [127.0286, 37.2636],
  "성남": [127.1388, 37.4449],
  "용인": [127.1776, 37.2411],
  "고양": [126.8320, 37.6584],
  "안양": [126.9568, 37.3943],
  "안산": [126.8320, 37.3219],
  "창원": [128.6811, 35.2278],
  "청주": [127.4898, 36.6424],
  "전주": [127.1490, 35.8242],
  "전주한옥마을": [127.1490, 35.8242],
  "천안": [127.1529, 36.8151],
  "포항": [129.3435, 36.0190],
  "원주": [127.9248, 37.3422],
  "춘천": [127.7292, 37.8813],
  "강릉": [128.8986, 37.7517],
  "강릉역": [128.8986, 37.7517],
  "경주": [129.2115, 35.8563],
  "경주역": [129.2115, 35.8563],
  "속초": [128.5918, 38.2070],
  "여수": [127.6622, 34.7604],
  "순천": [127.4877, 34.9506],
  "목포": [126.3928, 34.8118],
  "군산": [126.7368, 35.9678],
  "거제": [128.6212, 34.8799],
  "통영": [128.4336, 34.8544],
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

  try {
    const nominatimUrl =
      "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=kr&q=" +
      encodeURIComponent(text);
    const res = await fetch(nominatimUrl, {
      headers: { "User-Agent": "BarrierFreeApp/1.0 (tldhs123e@gmail.com)" },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return NextResponse.json({
          locationText: text,
          mapX: parseFloat(data[0].lon),
          mapY: parseFloat(data[0].lat),
          confidence: 0.8,
          source: "nominatim",
        });
      }
    }
  } catch (e) {
    console.error("[location/resolve] nominatim error:", e);
  }

  return NextResponse.json({
    locationText: text,
    mapX: null,
    mapY: null,
    confidence: 0.0,
    source: "failed",
  });
}
