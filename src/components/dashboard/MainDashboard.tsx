"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Accessibility, AlertTriangle, MapPin, Phone,
  Check, HelpCircle, XCircle, ChevronUp, ChevronDown,
  Settings, LogOut, Search, X,
} from "lucide-react";
import { BarrierFreeDashboardResponse, PlaceCardData, AccessibilityStatus } from "../../types";
import { BARRIER_FREE_TIPS } from "@/constants/BARRIER_FREE_TIPS";
import { Map, MapMarker, useKakaoLoader, ZoomControl } from "react-kakao-maps-sdk";

// ── 예시 쿼리 ─────────────────────────────────────────────
const EXAMPLE_QUERIES = [
  "서울역 근처 휠체어 이용 가능한 배리어프리 카페 찾아줘",
  "경복궁 주변 유모차 가능한 박물관 추천해줘",
  "해운대 근처 반려동물 동반 가능한 배리어프리 식당 찾아줘",
  "명동 인근 장애인 화장실 있는 관광지 알려줘",
];

// ── 필터 상수 ──────────────────────────────────────────────
const RADIUS_OPTIONS = ["500m", "1km", "3km", "5km", "10km"];
const USER_TYPE_OPTIONS = [
  { id: "wheelchair", label: "휠체어 이용자" },
  { id: "senior", label: "거동 불편 고령자" },
  { id: "baby", label: "영유아·유모차 동반" },
  { id: "pet", label: "반려동물 동반" },
];
const CONDITION_OPTIONS = [
  { id: "route", label: "진입로·경사로" },
  { id: "elevator", label: "엘리베이터" },
  { id: "restroom", label: "장애인 화장실" },
  { id: "babycar", label: "유모차 대여" },
];

type FilterState = {
  locationText: string;
  radius: string;
  userTypes: string[];
  conditions: string[];
  courseRecommend: boolean;
};

const DEFAULT_FILTER: FilterState = {
  locationText: "",
  radius: "3km",
  userTypes: [],
  conditions: [],
  courseRecommend: false,
};

function buildQueryFromFilter(f: FilterState): string {
  const location = f.locationText.trim() || "서울역";
  const userTypeMap: Record<string, string> = {
    wheelchair: "휠체어 이용자", senior: "거동 불편 고령자",
    baby: "영유아·유모차 동반", pet: "반려동물 동반",
  };
  const condMap: Record<string, string> = {
    route: "진입로·경사로", elevator: "엘리베이터",
    restroom: "장애인 화장실", babycar: "유모차 대여",
  };
  const userTypes = f.userTypes.map((t) => userTypeMap[t] || t);
  const conditions = f.conditions.map((c) => condMap[c] || c);
  let q = `${location} 근처 반경 ${f.radius} 내 배리어프리 관광지를 찾아줘.`;
  if (userTypes.length > 0) q += ` 동행자: ${userTypes.join(", ")}.`;
  if (conditions.length > 0) q += ` 필수 시설: ${conditions.join(", ")}.`;
  if (f.userTypes.includes("pet")) q += " 반려동물 동반 가능한 곳으로 찾아줘.";
  if (f.courseRecommend) q += " 하루 코스로 추천해줘.";
  return q;
}

// ── 하위 컴포넌트들 ──────────────────────────────────────

function VisitLevelBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    "안심 방문 가능": "bg-green-50 text-green-700 ring-1 ring-green-200",
    "동행 시 방문 가능": "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200",
    "부분 방문 가능": "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200",
    "방문 전 확인 필요": "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    "추천 제외": "bg-red-50 text-red-700 ring-1 ring-red-200",
  };
  const cls = map[level] ?? "bg-slate-50 text-slate-600 ring-1 ring-slate-200";
  return <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${cls}`}>{level}</span>;
}

function StatusChip({ status }: { status: AccessibilityStatus }) {
  switch (status) {
    case "가능": return <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full ring-1 ring-green-200"><Check className="w-3 h-3" /> 가능</span>;
    case "제한적 가능": return <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full ring-1 ring-yellow-200"><AlertTriangle className="w-3 h-3" /> 제한적</span>;
    case "확인 필요": return <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full ring-1 ring-blue-200"><HelpCircle className="w-3 h-3" /> 확인 필요</span>;
    default: return <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" /> 불가</span>;
  }
}

function FacilityRow({ label, status }: { label: string; status: AccessibilityStatus }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-500">{label}</span>
      <StatusChip status={status} />
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 22, c = 2 * Math.PI * r;
  const filled = (score / 100) * c;
  const grade = score >= 90 ? { label: "매우 좋음", color: "#16a34a", bg: "bg-green-50", text: "text-green-700" }
    : score >= 70 ? { label: "좋음", color: "#16a34a", bg: "bg-green-50", text: "text-green-700" }
    : score >= 50 ? { label: "보통", color: "#ca8a04", bg: "bg-yellow-50", text: "text-yellow-700" }
    : score >= 25 ? { label: "조금 나쁨", color: "#ea580c", bg: "bg-orange-50", text: "text-orange-700" }
    : { label: "나쁨", color: "#dc2626", bg: "bg-red-50", text: "text-red-700" };
  return (
    <div className="flex flex-col items-center gap-1 shrink-0" tabIndex={0} role="img" aria-label={`접근성 점수 ${score}점`}>
      <svg width="56" height="56" viewBox="0 0 60 60">
        <circle cx="30" cy="30" r={r} fill="none" stroke="#f1f5f9" strokeWidth="5" />
        <circle cx="30" cy="30" r={r} fill="none" stroke={grade.color} strokeWidth="5"
          strokeDasharray={`${filled} ${c - filled}`} strokeLinecap="round" transform="rotate(-90 30 30)" />
        <text x="30" y="35" textAnchor="middle" fontSize="14" fontWeight="700" fill={grade.color}>{score}</text>
      </svg>
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${grade.bg} ${grade.text}`}>{grade.label}</span>
    </div>
  );
}

function PlaceCard({ card }: { card: PlaceCardData }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-150 flex flex-col">
      <div className="w-full h-36 bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center shrink-0">
        <Accessibility className="w-10 h-10 text-green-300" />
      </div>
      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* 제목 + 방문 레벨 */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-slate-800 text-sm leading-snug line-clamp-2 flex-1">{card.title}</h3>
          <VisitLevelBadge level={card.visitLevel} />
        </div>

        {/* 주소 */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
          <span className="line-clamp-1">{card.address}</span>
        </div>

        {/* 점수 + 추천 이유 */}
        <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
          <ScoreRing score={card.score} />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400 mb-1">추천 이유</p>
            <p className="text-xs text-slate-700 leading-relaxed line-clamp-3">{card.recommendReason}</p>
          </div>
        </div>

        {/* 시설 상태 */}
        <div className="space-y-1.5 pt-1 border-t border-slate-100">
          <FacilityRow label="진입로·경사로" status={card.statuses.route} />
          <FacilityRow label="엘리베이터" status={card.statuses.elevator} />
          <FacilityRow label="장애인 화장실" status={card.statuses.restroom} />
          {card.statuses.pet !== "불가" && (
            <FacilityRow label="반려동물" status={card.statuses.pet} />
          )}
        </div>

        {/* 접기/펼치기 상세 */}
        {(card.riskFactors.length > 0 || card.checkBeforeVisit.length > 0 || card.bestFor.length > 0) && (
          <>
            <button onClick={() => setExpanded((p) => !p)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-green-700 transition cursor-pointer w-fit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded">
              {expanded ? <><ChevronUp className="w-3.5 h-3.5" /> 간략히 보기</> : <><ChevronDown className="w-3.5 h-3.5" /> 상세 보기</>}
            </button>
            {expanded && (
              <div className="space-y-2">
                {card.bestFor.length > 0 && (
                  <div className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2 space-y-0.5">
                    {card.bestFor.map((r, i) => (
                      <p key={i} className="flex items-start gap-1"><span className="shrink-0">✓</span>{r}</p>
                    ))}
                  </div>
                )}
                {card.riskFactors.length > 0 && (
                  <div className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 space-y-0.5">
                    {card.riskFactors.map((r, i) => (
                      <p key={i} className="flex items-start gap-1"><span className="shrink-0">!</span>{r}</p>
                    ))}
                  </div>
                )}
                {card.checkBeforeVisit.length > 0 && (
                  <div className="text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2 space-y-0.5">
                    {card.checkBeforeVisit.map((r, i) => (
                      <p key={i} className="flex items-start gap-1"><span className="shrink-0">📋</span>{r}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── CheckGroup ────────────────────────────────────────
function CheckGroup({ options, selected, onChange }: { options: { id: string; label: string }[]; selected: string[]; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const checked = selected.includes(opt.id);
        return (
          <label key={opt.id} tabIndex={0}
            onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onChange(opt.id); } }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium cursor-pointer transition select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${checked ? "bg-green-600 text-white border-green-600" : "bg-white text-slate-700 border-slate-200 hover:border-green-400 hover:text-green-700"}`}>
            <input type="checkbox" tabIndex={-1} className="sr-only" checked={checked} onChange={() => onChange(opt.id)} />
            {opt.label}
          </label>
        );
      })}
    </div>
  );
}

// ── FilterPanel ───────────────────────────────────────
function FilterPanel({ filter, onChange, onReset, onSearch, isLoading }: { filter: FilterState; onChange: (p: Partial<FilterState>) => void; onReset: () => void; onSearch: () => void; isLoading: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const toggle = (field: "userTypes" | "conditions", id: string) => {
    const arr = filter[field];
    onChange({ [field]: arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id] });
  };
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm divide-y divide-slate-100">
      <div className="px-5 py-4">
        <div className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-green-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
          지역 및 반경
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-500 transition">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
            <input className="w-full text-sm outline-none bg-transparent placeholder:text-slate-400"
              placeholder="예: 서울역, 경복궁" value={filter.locationText}
              onChange={(e) => onChange({ locationText: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") onSearch(); }} />
          </div>
          <div className="flex flex-wrap gap-2">
            {RADIUS_OPTIONS.map((r) => (
              <button key={r} onClick={() => onChange({ radius: r })}
                className={`px-4 py-1.5 rounded-lg border text-sm font-medium transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${filter.radius === r ? "bg-green-600 text-white border-green-600" : "bg-white text-slate-700 border-slate-200 hover:border-green-400"}`}>
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>
      {expanded && (
        <>
          <div className="px-5 py-4">
            <div className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-green-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
              사용자 유형
            </div>
            <CheckGroup options={USER_TYPE_OPTIONS} selected={filter.userTypes} onChange={(id) => toggle("userTypes", id)} />
          </div>
          <div className="px-5 py-4">
            <div className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-green-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">3</span>
              필수 시설 조건
            </div>
            <CheckGroup options={CONDITION_OPTIONS} selected={filter.conditions} onChange={(id) => toggle("conditions", id)} />
          </div>
          <div className="px-5 py-4">
            <div className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-green-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">4</span>
              코스 추천
            </div>
            <label className="inline-flex items-center gap-3 cursor-pointer select-none">
              <div role="switch" aria-checked={filter.courseRecommend} tabIndex={0}
                onClick={() => onChange({ courseRecommend: !filter.courseRecommend })}
                onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onChange({ courseRecommend: !filter.courseRecommend }); } }}
                className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${filter.courseRecommend ? "bg-green-600" : "bg-slate-200"}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${filter.courseRecommend ? "translate-x-5" : "translate-x-0.5"}`} />
              </div>
              <span className={`text-sm font-medium ${filter.courseRecommend ? "text-green-700" : "text-slate-600"}`}>
                {filter.courseRecommend ? "코스로 묶어서 추천받기" : "코스 추천 안 함"}
              </span>
            </label>
          </div>
        </>
      )}
      <button onClick={() => setExpanded((p) => !p)} aria-expanded={expanded}
        className="w-full flex items-center justify-center gap-1.5 px-5 py-2.5 text-sm text-slate-500 hover:text-green-700 hover:bg-green-50 font-medium transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500">
        {expanded ? <><ChevronUp className="w-4 h-4" /> 필터 접기</> : <><ChevronDown className="w-4 h-4" /> 필터 더 보기</>}
      </button>
      <div className="px-5 py-4 flex items-center justify-between bg-slate-50 rounded-b-xl">
        <button onClick={onReset} className="text-sm text-slate-500 hover:text-slate-800 font-medium transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded">초기화</button>
        <button onClick={onSearch} disabled={isLoading} className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500">
          {isLoading ? (<svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>) : (<Search className="w-4 h-4" />)} {isLoading ? "검색 중..." : "필터 검색"}
        </button>
      </div>
    </div>
  );
}

// ── 메인 대시보드 ──────────────────────────────────────
export default function MainDashboard() {
  const [data, setData] = useState<BarrierFreeDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentTipIdx, setCurrentTipIdx] = useState(0);
  const [tipVisible, setTipVisible] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [searchTrigger, setSearchTrigger] = useState(0);
  const profileRef = useRef<HTMLDivElement>(null);

  const [mapLoading, mapError] = useKakaoLoader({
    appkey: process.env.NEXT_PUBLIC_KAKAO_MAP_KEY as string,
    libraries: ["services", "clusterer"],
  });

  // 프로필 드롭다운 외부 클릭 닫기
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    function handleEscape(e: KeyboardEvent) { if (e.key === "Escape") setProfileOpen(false); }
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => { document.removeEventListener("mousedown", handleOutsideClick); document.removeEventListener("keydown", handleEscape); };
  }, []);

  // 검색 실행
  useEffect(() => {
    if (searchTrigger === 0) return;
    async function fetchData() {
      setIsLoading(true);
      setHasSearched(true);
      setApiError(null);
      try {
        const res = await fetch("/api/tour", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchText }),
        });
        const rawText = await res.text();
        if (!rawText) throw new Error("서버에서 빈 응답이 반환되었습니다.");
        let result: BarrierFreeDashboardResponse & { success: boolean; error?: string };
        try {
          result = JSON.parse(rawText);
        } catch {
          throw new Error(`응답 파싱 실패: ${rawText.slice(0, 80)}...`);
        }
        if (result.success) {
          setData(result);
        } else {
          setApiError(result.error || "서버에서 오류가 발생했습니다.");
        }
      } catch (error: unknown) {
        setApiError(error instanceof Error ? error.message : "알 수 없는 오류");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [searchTrigger, searchText]);

  // TIP 자동 전환
  useEffect(() => {
    const t = setInterval(() => {
      setTipVisible(false);
      setTimeout(() => { setCurrentTipIdx((p) => (p + 1) % BARRIER_FREE_TIPS.length); setTipVisible(true); }, 250);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  const cards = data?.cards ?? [];

  return (
    <div className="w-full bg-[#f9fafb] min-h-screen font-sans antialiased text-slate-800 flex flex-col">
      {/* 헤더 */}
      <header className="bg-white border-b border-slate-200 h-16 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto h-full px-6 grid grid-cols-3 items-center">
          <div />
          <div className="flex items-center justify-center gap-2.5">
            <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center shadow-sm">
              <Accessibility className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">어디GO</span>
          </div>
          <div className="flex justify-end">
            <div ref={profileRef} className="relative">
              <button onClick={() => setProfileOpen((p) => !p)}
                className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white text-sm font-bold hover:ring-2 hover:ring-green-300 hover:ring-offset-1 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500">
                김
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-40 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50">
                  <ul className="py-1">
                    <li><button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition cursor-pointer"><Settings className="w-4 h-4 text-slate-400 shrink-0" /> 프로필 수정</button></li>
                  </ul>
                  <div className="border-t border-slate-100">
                    <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition cursor-pointer"><LogOut className="w-4 h-4 shrink-0" /> 로그아웃</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full">
        <div className="space-y-5">
          {/* TIP 배너 */}
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <span className="shrink-0 text-xs font-bold text-white bg-green-600 px-2 py-0.5 rounded-md">TIP</span>
            <p className={`text-sm text-green-900 font-medium leading-snug transition-opacity duration-200 ${tipVisible ? "opacity-100" : "opacity-0"}`}>
              {BARRIER_FREE_TIPS[currentTipIdx]}
            </p>
          </div>

          {/* 자유 텍스트 검색창 */}
          <div className="bg-white border border-slate-200 rounded-xl focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-500 transition">
            <div className="flex items-start gap-3 px-4 pt-3.5 pb-2">
              <Search className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <textarea rows={2}
                className="flex-1 text-sm outline-none bg-transparent placeholder:text-slate-400 text-slate-800 resize-none leading-relaxed"
                placeholder="예: 서울역 근처 휠체어 이용 가능한 배리어프리 카페 찾아줘"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (searchText.trim()) setSearchTrigger((n) => n + 1); } }}
              />
              {searchText && (
                <button onClick={() => setSearchText("")}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer mt-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded"
                  aria-label="검색어 지우기">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between px-4 pb-3 gap-2 flex-wrap">
              <div className="flex gap-2 flex-wrap">
                {EXAMPLE_QUERIES.slice(0, 2).map((q) => (
                  <button key={q} onClick={() => setSearchText(q)}
                    className="text-xs text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-full px-2.5 py-1 transition cursor-pointer truncate max-w-[180px]">
                    {q}
                  </button>
                ))}
              </div>
              <button onClick={() => { if (searchText.trim()) setSearchTrigger((n) => n + 1); }}
                disabled={!searchText.trim() || isLoading}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 shrink-0">
                {isLoading ? (<svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>) : (<Search className="w-3.5 h-3.5" />)} {isLoading ? "검색 중..." : "검색"}
              </button>
            </div>
          </div>

          {/* 카카오 지도 */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden h-60 relative shadow-sm z-0">
            {mapLoading ? (
              <div className="w-full h-full bg-slate-50 flex items-center justify-center text-sm text-slate-500">지도를 불러오는 중...</div>
            ) : mapError ? (
              <div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center text-sm text-red-500 gap-2">
                <AlertTriangle className="w-5 h-5" /> 지도를 불러올 수 없습니다.
              </div>
            ) : (
              <Map center={{ lat: cards.length > 0 ? cards[0].mapY : 37.5547, lng: cards.length > 0 ? cards[0].mapX : 126.9707 }}
                style={{ width: "100%", height: "100%" }} level={5}>
                <ZoomControl position={"RIGHT"} />
                {cards.map((card) => (
                  <MapMarker key={card.contentId} position={{ lat: card.mapY, lng: card.mapX }} title={card.title} />
                ))}
              </Map>
            )}
          </div>

          {/* 필터 패널 */}
          <FilterPanel
            filter={filter}
            onChange={(p) => setFilter((f) => ({ ...f, ...p }))}
            onReset={() => setFilter(DEFAULT_FILTER)}
            isLoading={isLoading}
            onSearch={() => {
              const q = buildQueryFromFilter(filter);
              setSearchText(q);
              setSearchTrigger((n) => n + 1);
            }}
          />

          {/* 결과 헤더 */}
          {hasSearched && !isLoading && cards.length > 0 && (
            <h2 className="text-base font-bold text-slate-800">
              맞춤 판정 결과 <span className="ml-2 text-green-700">{cards.length}개</span>
            </h2>
          )}

          {/* 로딩 스켈레톤 */}
          {isLoading && (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => <div key={i} className="h-48 bg-white rounded-xl border border-slate-100" />)}
            </div>
          )}

          {/* 초기 상태 */}
          {!isLoading && !hasSearched && (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
              <div className="text-4xl mb-3">♿</div>
              <p className="font-semibold text-slate-500 mb-1">배리어프리 장소를 검색해 보세요</p>
              <p className="text-sm text-slate-400">위 검색창에 원하는 조건을 입력하거나 예시 쿼리를 클릭하세요.</p>
            </div>
          )}

          {/* 빈 결과 — 요약 + 경고 포함 */}
          {!isLoading && hasSearched && cards.length === 0 && !apiError && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {data?.summary && (
                <div className="bg-green-50 border-b border-green-200 px-5 py-4 text-sm text-green-900 leading-relaxed">
                  {data.summary}
                </div>
              )}
              <div className="text-center py-12">
                <div className="text-4xl mb-3">🔍</div>
                <p className="font-semibold text-slate-500 mb-1">검색 결과가 없습니다</p>
                <p className="text-sm text-slate-400">다른 키워드나 조건으로 다시 시도해 보세요.</p>
              </div>
              {data?.warnings && data.warnings.length > 0 && (
                <div className="border-t border-amber-200 bg-amber-50 px-5 py-4 space-y-1.5">
                  {data.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-800 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />{w}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 에러 */}
          {!isLoading && apiError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{apiError}</p>
            </div>
          )}

          {/* 카드 목록 — 결과 있을 때 요약+경고 포함 */}
          {!isLoading && cards.length > 0 && (
            <div className="space-y-4">
              {data?.summary && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 text-sm text-green-900 leading-relaxed">
                  {data.summary}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {cards.map((card) => (
                  <PlaceCard key={card.contentId} card={card} />
                ))}
              </div>
              {data?.warnings && data.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 space-y-1.5">
                  {data.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-800 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />{w}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <footer className="bg-white border-t border-slate-200 py-5 text-center text-xs text-slate-400">
        <p>© 2026 어디GO — 배리어프리 여행 도우미. Ennoia AI 멀티에이전트 플랫폼 사용.</p>
      </footer>
    </div>
  );
}
