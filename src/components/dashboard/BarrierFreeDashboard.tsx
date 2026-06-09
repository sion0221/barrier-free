"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Accessibility,
  AlertTriangle,
  Info,
  MapPin,
  Navigation,
  Check,
  HelpCircle,
  XCircle,
  Footprints,
  Baby,
  Dog,
  Map as MapIcon,
  ChevronUp,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { BarrierFreeDashboardResponse } from "../../types";

const BARRIER_FREE_TIPS = [
  "휠체어·유모차는 정문보다 측면 출입구가 더 편한 경우가 많아요. 방문 전 전화로 위치를 미리 확인해 보세요.",
  "장애인 전용 주차구역은 출입구와 가장 가까운 곳에 있지만, 주말엔 금방 차요. 대중교통 이용도 고려해 보세요.",
  "엘리베이터 위치는 안내 지도에 없는 경우가 있어요. 도착 후 안내데스크에 먼저 물어보시면 빠릅니다.",
  "유모차를 끌고 식당을 이용할 땐 예약 시 미리 말씀해 두시면 넓은 자리를 배정해 드리는 곳이 많아요.",
  "반려동물 동반 카페는 '실내 입장 가능'과 '테라스만 가능'이 달라요. 방문 전 SNS나 전화로 꼭 확인하세요.",
  "장애인 화장실 내부 공간이 좁은 곳도 있어요. 전동 휠체어 이용자라면 사전에 크기를 확인하는 게 좋아요.",
  "관광지 내 저상버스는 배차 간격이 길 수 있어요. 출발 전 노선 앱으로 시간표를 미리 챙겨두세요.",
  "입장료 할인은 현장에서 장애인등록증이나 복지카드를 제시해야 적용돼요. 보호자 1인 동반 할인도 함께 확인하세요.",
];

const USER_TABS = [
  { id: "wheelchair", label: "휠체어", sub: "경사로·엘리베이터 위주 판정" },
  { id: "senior", label: "고령자", sub: "이동 부담 최소화 장소 매칭" },
  { id: "baby", label: "영유아·유모차", sub: "수유시설·대여 연동 조회" },
  { id: "pet", label: "반려동물", sub: "KTO 지정 펫 전용 스크리닝" },
];

/* ── 방문 레벨 배지 색상 ── */
function VisitLevelBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    "안심 방문 가능": "bg-green-50 text-green-700 ring-1 ring-green-200",
    "동행 시 방문 가능": "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200",
    "부분 방문 가능": "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200",
    "방문 전 확인 필요": "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  };
  const cls = map[level] ?? "bg-red-50 text-red-700 ring-1 ring-red-200";
  return (
    <span
      className={`inline-block text-sm font-semibold px-2.5 py-1 rounded-full ${cls}`}
    >
      {level}
    </span>
  );
}

/* ── 접근성 상태 배지 ── */
function StatusChip({ status }: { status: string }) {
  switch (status) {
    case "가능":
      return (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full ring-1 ring-green-200">
          <Check className="w-3.5 h-3.5" />
          가능
        </span>
      );
    case "제한적 가능":
      return (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full ring-1 ring-yellow-200">
          <AlertTriangle className="w-3.5 h-3.5" />
          제한적
        </span>
      );
    case "확인 필요":
      return (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full ring-1 ring-blue-200">
          <HelpCircle className="w-3.5 h-3.5" />
          확인 필요
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
          <XCircle className="w-3.5 h-3.5" />
          불가
        </span>
      );
  }
}

/* ── 접근성 항목 셀 ── */
function FacilityCell({
  icon,
  label,
  status,
}: {
  icon: React.ReactNode;
  label: string;
  status: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 px-3 py-3 bg-white rounded-lg border border-slate-100">
      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
        {icon}
        {label}
      </span>
      <StatusChip status={status} />
    </div>
  );
}

/* ── 점수 링 ── */
function ScoreRing({ score }: { score: number }) {
  const r = 22,
    c = 2 * Math.PI * r;
  const filled = (score / 100) * c;

  const grade =
    score >= 90
      ? {
          label: "매우 좋음",
          color: "#16a34a",
          bg: "bg-green-50",
          text: "text-green-700",
        }
      : score >= 70
        ? {
            label: "좋음",
            color: "#16a34a",
            bg: "bg-green-50",
            text: "text-green-700",
          }
        : score >= 50
          ? {
              label: "보통",
              color: "#ca8a04",
              bg: "bg-yellow-50",
              text: "text-yellow-700",
            }
          : score >= 25
            ? {
                label: "조금 나쁨",
                color: "#ea580c",
                bg: "bg-orange-50",
                text: "text-orange-700",
              }
            : {
                label: "나쁨",
                color: "#dc2626",
                bg: "bg-red-50",
                text: "text-red-700",
              };

  return (
    <div className="flex flex-col items-center gap-1 shrink-0 group relative">
      <svg width="60" height="60" viewBox="0 0 60 60">
        <circle
          cx="30"
          cy="30"
          r={r}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="5"
        />
        <circle
          cx="30"
          cy="30"
          r={r}
          fill="none"
          stroke={grade.color}
          strokeWidth="5"
          strokeDasharray={`${filled} ${c - filled}`}
          strokeLinecap="round"
          transform="rotate(-90 30 30)"
        />
        <text
          x="30"
          y="35"
          textAnchor="middle"
          fontSize="14"
          fontWeight="700"
          fill={grade.color}
        >
          {score}
        </text>
      </svg>

      {/* 구간 레이블 */}
      <span
        className={`text-xs font-semibold px-2 py-0.5 rounded-md ${grade.bg} ${grade.text}`}
      >
        {grade.label}
      </span>

      {/* 호버 툴팁 — 왼쪽 방향으로 열림 */}
      <div className="absolute bottom-full mb-2 right-0 w-52 bg-white text-slate-700 text-xs rounded-xl px-3.5 py-3 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-50 shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-slate-100">
        <p className="font-bold text-slate-800 mb-0.5">종합 점수?</p>
        <p className="text-slate-500 text-[11px] mb-2.5 leading-relaxed">
          경사로·엘리베이터·화장실·편의시설 등 한국관광공사 데이터를 기반으로
          산출한 접근 용이성 점수예요.
        </p>
        <ul className="space-y-1">
          {[
            { range: "90~100", label: "매우 좋음", active: score >= 90 },
            {
              range: "70~89",
              label: "좋음",
              active: score >= 70 && score < 90,
            },
            {
              range: "50~69",
              label: "보통",
              active: score >= 50 && score < 70,
            },
            {
              range: "25~49",
              label: "조금 나쁨",
              active: score >= 25 && score < 50,
            },
            { range: "0~24", label: "나쁨", active: score < 25 },
          ].map(({ range, label, active }) => (
            <li
              key={range}
              className={`flex justify-between ${active ? "font-semibold text-slate-900" : "text-slate-500"}`}
            >
              <span>{range}점</span>
              <span>{label}</span>
            </li>
          ))}
        </ul>
        <div className="absolute bottom-[-5px] right-5 w-2.5 h-2.5 bg-white border-r border-b border-slate-100 rotate-45" />
      </div>
    </div>
  );
}

export default function BarrierFreeDashboard() {
  const [data, setData] = useState<BarrierFreeDashboardResponse | null>(null);
  const [showEvidence, setShowEvidence] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [selectedUserType, setSelectedUserType] = useState("wheelchair");
  const [currentTipIdx, setCurrentTipIdx] = useState(0);
  const [tipVisible, setTipVisible] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  /* 드롭다운 외부 클릭 시 닫기 */
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target as Node)
      ) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    async function fetchRealTourData() {
      try {
        setIsLoading(true);
        // 변경: 정적 GET 호출에서 검색 조건이나 사용자 유형을 명시한 POST 방식으로 수정
        const res = await fetch("/api/tour", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locationText: "서울역",
            requiredConditions: ["route"],
          }),
        });
        const result = await res.json();
        if (result.success) setData(result);
        else setApiError(result.error);
      } catch {
        setApiError("백엔드 서버와 통신 중 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchRealTourData();
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setTipVisible(false);
      setTimeout(() => {
        setCurrentTipIdx((p) => (p + 1) % BARRIER_FREE_TIPS.length);
        setTipVisible(true);
      }, 250);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  /* ── 로딩 스켈레톤 ── */
  if (isLoading) {
    return (
      <div className="w-full min-h-screen bg-[#f9fafb]">
        <div className="h-16 bg-white border-b border-slate-200" />
        <div className="h-12 bg-white border-b border-slate-200 mt-px" />
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-40 rounded-xl border border-slate-100 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%] animate-shimmer"
            />
          ))}
        </div>
      </div>
    );
  }

  /* ── 에러 ── */
  if (apiError || !data) {
    return (
      <div className="max-w-sm mx-auto mt-24 bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm">
        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-800 mb-1">
          데이터 불러오기 실패
        </p>
        <p className="text-xs text-slate-400 mb-5">{apiError}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition cursor-pointer"
        >
          다시 시도
        </button>
      </div>
    );
  }

  /* ── 필터링 ── */
  const filteredCards = data.cards.filter((card) => {
    if (selectedUserType === "wheelchair")
      return (
        card.statuses.route === "가능" || card.statuses.elevator === "가능"
      );
    if (selectedUserType === "senior")
      return (
        card.statuses.elevator === "가능" || card.statuses.route === "가능"
      );
    if (selectedUserType === "baby")
      return card.statuses.babycar === "가능" || card.statuses.route === "가능";
    if (selectedUserType === "pet")
      return (
        card.evidence.petName !== "정보 없음" || card.statuses.pet !== "불가"
      );
    return true;
  });

  const mapLabel: Record<string, string> = {
    wheelchair: "지체 장애 대응",
    senior: "실버 케어 대응",
    baby: "유아 동선 대응",
    pet: "반려동물 케어",
  };

  return (
    <div className="w-full bg-[#f9fafb] min-h-screen font-sans antialiased text-slate-800">
      {/* ── GNB ── */}
      <header className="bg-white border-b border-slate-200 h-14 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto h-full px-6 flex items-center justify-between">
          {/* 로고 */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center">
              <Accessibility className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold text-slate-900 tracking-tight">
              어디GO
            </span>
          </div>

          {/* 프로필 아바타 + 드롭다운 */}
          <div ref={profileRef} className="relative">
            <button
              onClick={() => setProfileOpen((prev) => !prev)}
              className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-bold hover:ring-2 hover:ring-green-300 hover:ring-offset-1 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
              aria-label="내 계정"
            >
              김
            </button>

            {/* 드롭다운 패널 */}
            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-40 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50 animate-in fade-in-0 slide-in-from-top-1 duration-150">
                <ul className="py-1">
                  <li>
                    <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer">
                      <Settings className="w-4 h-4 text-slate-400 shrink-0" />
                      프로필 수정
                    </button>
                  </li>
                </ul>
                <div className="border-t border-slate-100">
                  <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors cursor-pointer">
                    <LogOut className="w-4 h-4 shrink-0" />
                    로그아웃
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── 분류 탭 ── */}
      <nav className="bg-white border-b border-slate-200 sticky top-14 z-30">
        <div className="max-w-5xl mx-auto px-6 flex justify-center overflow-x-auto no-scrollbar">
          {USER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setSelectedUserType(tab.id);
                setShowEvidence(null);
              }}
              className={`
                relative flex items-center gap-2 px-6 py-3.5 text-sm font-semibold whitespace-nowrap
                transition-colors duration-150 border-b-2 cursor-pointer
                ${
                  selectedUserType === tab.id
                    ? "border-green-600 text-green-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── 본문 ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* ── 왼쪽: 꿀팁 + 지도 + 카드 목록 ── */}
        <div className="space-y-5">
          {/* 꿀팁 바 */}
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <span className="shrink-0 text-xs font-bold text-white bg-green-600 px-2 py-0.5 rounded-md">
              TIP
            </span>
            <p
              className={`text-base text-green-900 font-medium leading-snug transition-opacity duration-250 ${tipVisible ? "opacity-100" : "opacity-0"}`}
            >
              {BARRIER_FREE_TIPS[currentTipIdx]}
            </p>
          </div>

          {/* 지도 플레이스홀더 */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 h-44 flex flex-col items-center justify-center gap-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5 text-slate-600 text-sm font-medium">
                <MapIcon className="w-4 h-4" />
                Kakao Map API — {mapLabel[selectedUserType]}
              </div>
              <MapPin className="w-5 h-5 text-green-500 animate-bounce" />
            </div>
          </div>

          {/* 결과 헤더 */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800">
              맞춤 판정 결과
              <span className="ml-2 text-green-700 font-bold">
                {filteredCards.length}개
              </span>
            </h2>
            <span className="text-sm text-slate-600">
              {USER_TABS.find((t) => t.id === selectedUserType)?.sub}
            </span>
          </div>

          {/* 카드 목록 */}
          {filteredCards.length > 0 ? (
            <div className="space-y-4">
              {filteredCards.map((card) => {
                const open = showEvidence === card.contentId;
                return (
                  <article
                    key={card.contentId}
                    className="bg-white border border-slate-200 rounded-xl hover:border-green-300 transition-colors"
                  >
                    {/* 카드 헤더 */}
                    <div className="px-5 py-4 flex items-start justify-between gap-4 border-b border-slate-100">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <h3 className="text-lg font-bold text-slate-900 truncate">
                            {card.title}
                          </h3>
                          <VisitLevelBadge level={card.visitLevel} />
                        </div>
                        <p className="text-sm text-slate-600 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          {card.address}
                          <span className="ml-2 flex items-center gap-0.5 text-slate-500">
                            <Navigation className="w-3.5 h-3.5" />
                            {card.distance}m
                          </span>
                        </p>
                      </div>
                      <ScoreRing score={card.score} />
                    </div>

                    {/* 편의시설 그리드 */}
                    <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <FacilityCell
                        icon={<Footprints className="w-4 h-4" />}
                        label="진입로/경사로"
                        status={card.statuses.route}
                      />
                      <FacilityCell
                        icon={<Accessibility className="w-4 h-4" />}
                        label="엘리베이터"
                        status={card.statuses.elevator}
                      />
                      <FacilityCell
                        icon={<Accessibility className="w-4 h-4" />}
                        label="장애인 화장실"
                        status={card.statuses.restroom}
                      />
                      <FacilityCell
                        icon={<Baby className="w-4 h-4" />}
                        label="유모차 대여"
                        status={card.statuses.babycar}
                      />
                      <FacilityCell
                        icon={<Dog className="w-4 h-4" />}
                        label="반려동물"
                        status={card.statuses.pet}
                      />
                    </div>

                    {/* 추천 근거 + 리스크 */}
                    <div className="px-5 py-4 space-y-3">
                      <div>
                        <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                          추천 근거
                        </p>
                        <p className="text-base text-slate-700 leading-relaxed">
                          {card.recommendReason}
                        </p>
                      </div>

                      {card.riskFactors.length > 0 && (
                        <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3">
                          <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4" />
                            방문 전 확인 필요
                          </p>
                          <ul className="space-y-1">
                            {card.riskFactors.map((risk, i) => (
                              <li
                                key={i}
                                className="text-sm text-red-700 flex items-start gap-1.5"
                              >
                                <span className="mt-2 w-1 h-1 bg-red-400 rounded-full shrink-0" />
                                {risk}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 원문 근거 토글 */}
                      <button
                        onClick={() =>
                          setShowEvidence(open ? null : card.contentId)
                        }
                        className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-green-700 font-medium transition-colors cursor-pointer"
                      >
                        <Info className="w-4 h-4" />
                        오픈 API 원문 근거
                        {open ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>

                      {open && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 animate-in fade-in-50 duration-200">
                          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest border-b border-slate-200 pb-2">
                            OpenAPI 데이터 정보
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-slate-700">
                            {[
                              ["진입로", card.evidence.route],
                              ["엘리베이터", card.evidence.elevator],
                              ["화장실", card.evidence.restroom],
                              ["유모차대여", card.evidence.babycar],
                              ["동반제한", card.evidence.relisMetm],
                            ].map(([k, v]) => (
                              <div key={k} className="flex gap-1.5 text-sm">
                                <span className="font-semibold text-slate-700 shrink-0">
                                  {k}:
                                </span>
                                <span className="text-slate-600">
                                  {v || "정보 없음"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl py-16 text-center">
              <p className="text-base text-slate-600">
                선택하신 조건에 맞는 장소가 없습니다.
              </p>
              <p className="text-sm text-slate-500 mt-1">
                다른 카테고리를 선택해 보세요.
              </p>
            </div>
          )}
        </div>

        {/* ── 오른쪽 사이드바 ── */}
        <aside className="space-y-4">
          {/* 제외 장소 */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
              <XCircle className="w-4 h-4 text-slate-600" />
              조건 미충족 장소
            </h3>
            {data.excludedPlaces.length > 0 ? (
              <div className="space-y-2">
                {data.excludedPlaces.map((place, i) => (
                  <div
                    key={i}
                    className="p-3 bg-slate-50 rounded-lg border border-slate-100"
                  >
                    <p className="text-sm font-semibold text-slate-700 mb-0.5">
                      {place.title}
                    </p>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {place.reason}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">제외된 장소가 없습니다.</p>
            )}
          </div>

          {/* 면책 고지 */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <h3 className="text-base font-bold text-amber-800 flex items-center gap-1.5 mb-3">
              <Info className="w-4 h-4 text-amber-600" />
              서비스 안내
            </h3>
            <ul className="space-y-2">
              {data.warnings.map((w, i) => (
                <li
                  key={i}
                  className="text-sm text-amber-800 leading-relaxed flex items-start gap-1.5"
                >
                  <span className="mt-2 w-1 h-1 bg-amber-500 rounded-full shrink-0" />
                  {w}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
