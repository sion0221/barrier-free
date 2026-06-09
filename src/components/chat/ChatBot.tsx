"use client";

import React, { useState, useEffect, useRef } from "react";
import { Accessibility, Send, X, MessageCircle } from "lucide-react";

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<
    { role: "user" | "agent"; content: string }[]
  >([
    {
      role: "agent",
      content: "안녕하세요! 어떤 동행자와 함께 어디로 여행을 떠나시나요?",
    },
  ]);

  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 접근성: 열릴 때 포커스, ESC 닫기, 외부 클릭 닫기
  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    const handleClick = (e: MouseEvent) => {
      if (chatRef.current && !chatRef.current.contains(e.target as Node))
        setIsOpen(false);
    };

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.addEventListener("mousedown", handleClick);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [isOpen]);

  // ★ Ennoia 에이전트와 통신하는 핵심 로직 ★
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isTyping) return;

    const userMsg = inputMessage;
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setInputMessage("");
    setIsTyping(true);

    try {
      // Ennoia 에이전트 API 호출 (에이전트가 내부적으로 위의 5개 Tool을 사용하여 답변 생성)
      const res = await fetch("/api/agent/chat", {
        // Ennoia 에이전트와 통신하는 서버 경로
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });

      const data = await res.json();

      // Ennoia 답변 처리 (응답 포맷에 맞춰 data.reply 또는 data.message 사용)
      setMessages((prev) => [
        ...prev,
        { role: "agent", content: data.reply || "정보를 찾을 수 없습니다." },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "agent", content: "에이전트 연결에 실패했습니다." },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {isOpen && (
        <div
          ref={chatRef}
          className="fixed bottom-24 right-6 z-50 w-[360px] flex flex-col bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden h-[560px] font-sans"
        >
          {/* 헤더 (기존 디자인 유지) */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center shrink-0">
                <Accessibility className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">
                  Barrier-Free AI 가이드
                </p>
                <p className="text-[11px] text-slate-400 font-medium">
                  Ennoia Agent 작동중
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-700"
            >
              <X size={16} />
            </button>
          </div>

          {/* 대화 영역 (동적 렌더링) */}
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 bg-[#f9fafb]">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "items-end gap-2"}`}
              >
                {msg.role === "agent" && (
                  <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center mb-0.5">
                    <Accessibility size={14} className="text-white" />
                  </div>
                )}
                <div
                  className={`px-4 py-3 text-sm leading-relaxed max-w-[82%] ${msg.role === "user" ? "bg-green-600 text-white rounded-2xl rounded-br-sm" : "bg-white border border-slate-200 rounded-2xl rounded-bl-sm shadow-sm text-slate-800"}`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
          </div>

          {/* 입력창 (접근성 반영) */}
          <div className="px-4 py-3.5 border-t border-slate-100 bg-white">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="질문을 입력하세요..."
                className="flex-1 px-4 py-2.5 rounded-xl border text-black border-slate-200 text-sm outline-none focus:border-green-500 bg-slate-50"
              />
              <button
                onClick={handleSendMessage}
                className="bg-green-600 p-2.5 rounded-xl"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-md bg-green-600 flex items-center justify-center"
      >
        {isOpen ? (
          <X className="text-white" />
        ) : (
          <MessageCircle className="text-white" />
        )}
      </button>
    </>
  );
}
