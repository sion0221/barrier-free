// src/app/api/agent/chat/route.ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // 1. 프론트엔드에서 보낸 사용자 질문을 받습니다.
    const body = await request.json();

    // 2. 환경변수에서 키와 URL을 읽어옵니다.
    const ENNOIA_KEY = process.env.ENNOIA_API_KEY;
    const ENNOIA_URL = process.env.ENNOIA_AGENT_URL;

    // ★ 임시 테스트 로직: URL이 아직 등록되지 않았을 때의 가짜 응답
    if (!ENNOIA_URL || ENNOIA_URL === "") {
      return NextResponse.json({
        reply: `[테스트 모드] 서버 연결 성공!\n- 발급받으신 API 키 인식: ${ENNOIA_KEY ? "성공 ✅" : "실패 ❌"}\n- 사용자님의 질문: "${body.message}"\n\n(나중에 URL을 등록하시면 진짜 에이전트와 연결됩니다.)`,
      });
    }

    // 3. 실제 URL이 등록되었을 때의 통신 로직
    const response = await fetch(ENNOIA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENNOIA_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`에이전트 서버 에러: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Agent Proxy Error:", error);
    return NextResponse.json(
      { error: "에이전트 통신에 실패했습니다." },
      { status: 500 },
    );
  }
}
