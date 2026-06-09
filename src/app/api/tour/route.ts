import { NextResponse } from "next/server";
import type { BarrierFreeDashboardResponse } from "@/types";

export async function POST(request: Request) {
  let body: { query?: string } = {};
  try { body = await request.json(); } catch { body = {}; }

  const query = (body.query ?? "").trim();
  if (!query) {
    return NextResponse.json({ success: false, error: "검색어를 입력해 주세요." }, { status: 400 });
  }

  const apiKey  = process.env.ENNOIA_API_KEY;
  const project = process.env.ENNOIA_PROJECT;
  const hash    = process.env.ENNOIA_AGENT_HASH;

  if (!apiKey || !project || !hash) {
    console.error("[/api/tour] Ennoia 환경변수 누락:", { apiKey: !!apiKey, project: !!project, hash: !!hash });
    return NextResponse.json({ success: false, error: "Ennoia 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  console.log("[/api/tour] Ennoia 멀티에이전트 요청:", query);

  try {
    const url = `https://api.ennoia.so/api/llm-orchestrator/chat/stream/${hash}/2`;
    const res = await fetch(url, {
      method: "POST",
      headers: { project, apiKey, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ messages: [{ role: "user", content: query }] }),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[/api/tour] Ennoia HTTP 오류:", res.status, text.slice(0, 500));
      return NextResponse.json({ success: false, error: `Ennoia API 오류: ${res.status}`, detail: text.slice(0, 300) }, { status: 500 });
    }

    // SSE 스트림 수집
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";
    let buf = "";

    if (reader) {
      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (raw === "[DONE]") break outer;
          try {
            const chunk = JSON.parse(raw) as Record<string, unknown>;
            const choices = chunk?.choices as Array<Record<string, unknown>> | undefined;
            const delta =
              (choices?.[0]?.delta as Record<string, unknown>)?.content ??
              (choices?.[0]?.message as Record<string, unknown>)?.content ??
              chunk?.content ?? "";
            fullContent += String(delta ?? "");
          } catch { /* ignore */ }
        }
      }
    }

    console.log("[/api/tour] 수집 응답(앞200):", fullContent.slice(0, 200));

    const defaultQuery = {
      locationText: query,
      mapX: null as number | null,
      mapY: null as number | null,
      radius: 3000,
      userTypes: [] as string[],
      requiredConditions: [] as string[],
      optionalConditions: [] as string[],
    };

    let result: BarrierFreeDashboardResponse;
    try {
      // 모든 JSON 블록 추출 (마크다운 코드블록 + 일반 {})
      const blocks: string[] = [];
      for (const m of fullContent.matchAll(/```json\s*([\s\S]*?)```/g)) {
        blocks.push(m[1].trim());
      }
      let depth = 0, start = -1;
      for (let i = 0; i < fullContent.length; i++) {
        if (fullContent[i] === "{") { if (depth === 0) start = i; depth++; }
        else if (fullContent[i] === "}") {
          depth--;
          if (depth === 0 && start !== -1) { blocks.push(fullContent.slice(start, i + 1)); start = -1; }
        }
      }

      // 뒤에서부터 summary + cards 가진 블록 찾기
      let parsed: Record<string, unknown> | null = null;
      for (let i = blocks.length - 1; i >= 0; i--) {
        try {
          const candidate = JSON.parse(blocks[i]) as Record<string, unknown>;
          if ("summary" in candidate && "cards" in candidate) { parsed = candidate; break; }
        } catch (_e) { /* skip */ }
      }
      if (!parsed) throw new Error("no valid JSON");

      result = {
        summary: typeof parsed.summary === "string" ? parsed.summary : "결과를 가져왔습니다.",
        query: (parsed.query as typeof defaultQuery) ?? defaultQuery,
        cards: Array.isArray(parsed.cards) ? parsed.cards : [],
        excludedPlaces: Array.isArray(parsed.excludedPlaces) ? parsed.excludedPlaces : [],
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      };
    } catch (_e) {
      console.warn("[/api/tour] JSON 파싱 실패");
      result = {
        summary: "검색 결과를 파싱하지 못했습니다. 에이전트 설정을 확인하세요.",
        query: defaultQuery,
        cards: [],
        excludedPlaces: [],
        warnings: ["에이전트 응답을 카드 형태로 파싱하지 못했습니다."],
      };
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("[/api/tour] 예외:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
