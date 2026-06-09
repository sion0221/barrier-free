"use client";

import { useState, useEffect, useRef } from "react";
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
  Search,
  X,
  RotateCcw,
} from "lucide-react";

import { BarrierFreeDashboardResponse, PlaceCardData } from "../../types";
import { BARRIER_FREE_TIPS } from "@/constants/BARRIER_FREE_TIPS";

// 카카오맵 컴포넌트 임포트
import {
  Map,
  MapMarker,
  useKakaoLoader,
  ZoomControl,
} from "react-kakao-maps-sdk";

// ── 상수 ──────────────────────────────────────────────────
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
  { id: "pet", label: "반려동물 허용" },
];
const PREFERENCE_OPTIONS = [
  { id: "indoor", label: "실내 시설" },
  { id: "outdoor", label: "야외 공간" },
  { id: "cafe", label: "카페·식당" },
  { id: "tourist", label: "관광지·박물관" },
  { id: "park", label: "공원·산책로" },
  { id: "shopping", label: "쇼핑몰" },
];
const EXCLUDE_OPTIONS = [
  { id: "noStair", label: "계단 구간 제외" },
  { id: "noParking", label: "주차 불가 제외" },
  { id: "noPet", label: "반려동물 불가 제외" },
  { id: "noRestroom", label: "화장실 없는 곳 제외" },
];

type FilterState = {
  locationText: string;
  destination: string;
  radius: string;
  userTypes: string[];
  conditions: string[];
  preferences: string[];
  excludes: string[];
  courseRecommend: boolean;
};

const DEFAULT_FILTER: FilterState = {
  locationText: "서울역",
  destination: "",
  radius: "1km",
  userTypes: ["wheelchair"],
  conditions: [],
  preferences: [],
  excludes: [],
  courseRecommend: false,
};

// ── 하위 컴포넌트들 ──────────────────────────────────────

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

function StatusChip({ status }: { status: string }) {
  switch (status) {
    case "가능":
      return (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full ring-1 ring-green-200">
          <Check className="w-3.5 h-3.5" /> 가능
        </span>
      );
    case "제한적 가능":
      return (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full ring-1 ring-yellow-200">
          <AlertTriangle className="w-3.5 h-3.5" /> 제한적
        </span>
      );
    case "확인 필요":
      return (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full ring-1 ring-blue-200">
          <HelpCircle className="w-3.5 h-3.5" /> 확인 필요
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
          <XCircle className="w-3.5 h-3.5" /> 불가
        </span>
      );
  }
}

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
        {icon} {label}
      </span>
      <StatusChip status={status} />
    </div>
  );
}

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
    <div
      className="flex flex-col items-center gap-1 shrink-0 group relative"
      tabIndex={0}
      role="img"
      aria-label="접근성 점수"
    >
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
      <span
        className={`text-xs font-semibold px-2 py-0.5 rounded-md ${grade.bg} ${grade.text}`}
      >
        {grade.label}
      </span>
      <div className="absolute bottom-full mb-2 right-0 w-52 bg-white text-slate-700 text-xs rounded-xl px-3.5 py-3 leading-relaxed opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 pointer-events-none z-50 shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-slate-100">
        <p className="font-bold text-slate-800 mb-0.5">접근성 종합 점수란?</p>
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

function CheckGroup({
  options,
  selected,
  onChange,
}: {
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const checked = selected.includes(opt.id);
        return (
          <label
            key={opt.id}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                onChange(opt.id);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium cursor-pointer transition select-none ${checked ? "bg-green-600 text-white border-green-600" : "bg-white text-slate-700 border-slate-200 hover:border-green-400 hover:text-green-700"} focus-visible:outline-none focus-visible:border-green-500 focus-visible:ring-2 focus-visible:ring-green-500`}
          >
            <input
              type="checkbox"
              tabIndex={-1}
              className="sr-only"
              checked={checked}
              onChange={() => onChange(opt.id)}
            />
            {opt.label}
          </label>
        );
      })}
    </div>
  );
}

function FilterPanel({
  filter,
  onChange,
  onReset,
  onSearch,
}: {
  filter: FilterState;
  onChange: (patch: Partial<FilterState>) => void;
  onReset: () => void;
  onSearch: () => void;
}) {
  const [expanded, setExpanded] = useState<boolean>(false);
  const toggle = (
    field: keyof Pick<
      FilterState,
      "userTypes" | "conditions" | "preferences" | "excludes"
    >,
    id: string,
  ) => {
    const arr = filter[field] as string[];
    onChange({
      [field]: arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id],
    });
  };

  const sections = [
    {
      num: 1,
      title: "지역 및 출발·도착지",
      content: (
        <div className="flex flex-col gap-2">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              출발지 (지역명 또는 주소)
            </label>
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-500 transition">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                className="w-full text-sm outline-none bg-transparent placeholder:text-slate-400"
                placeholder="예: 서울역, 경복궁"
                value={filter.locationText}
                onChange={(e) => onChange({ locationText: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              도착지 (선택)
            </label>
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-500 transition">
              <Navigation className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                className="w-full text-sm outline-none bg-transparent placeholder:text-slate-400"
                placeholder="예: 남산타워"
                value={filter.destination}
                onChange={(e) => onChange({ destination: e.target.value })}
              />
            </div>
          </div>
        </div>
      ),
    },
    {
      num: 2,
      title: "검색 반경",
      tooltip: "출발지 기준으로 검색할 거리 범위예요.",
      content: (
        <div className="flex flex-wrap gap-2">
          {RADIUS_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => onChange({ radius: r })}
              className={`px-4 py-1.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${filter.radius === r ? "bg-green-600 text-white border-green-600" : "bg-white text-slate-700 border-slate-200 hover:border-green-400 hover:text-green-700"} focus-within:outline-none focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-500 transition`}
            >
              {r}
            </button>
          ))}
        </div>
      ),
    },
    {
      num: 3,
      title: "사용자 유형",
      tooltip: "방문자 특성을 선택하면 맞춤 장소를 추천해요.",
      content: (
        <CheckGroup
          options={USER_TYPE_OPTIONS}
          selected={filter.userTypes}
          onChange={(id) => toggle("userTypes", id)}
        />
      ),
    },
    {
      num: 4,
      title: "선택 조건",
      tooltip: "검색 결과에 반드시 포함돼야 하는 시설이에요.",
      content: (
        <CheckGroup
          options={CONDITION_OPTIONS}
          selected={filter.conditions}
          onChange={(id) => toggle("conditions", id)}
        />
      ),
    },
    {
      num: 5,
      title: "동행자 취향",
      tooltip: "함께 가는 동행자 특성에 맞는 조건을 고르세요.",
      content: (
        <CheckGroup
          options={PREFERENCE_OPTIONS}
          selected={filter.preferences}
          onChange={(id) => toggle("preferences", id)}
        />
      ),
    },
    {
      num: 6,
      title: "제외 조건",
      tooltip: "이 조건에 해당하는 장소는 결과에서 빠져요.",
      content: (
        <CheckGroup
          options={EXCLUDE_OPTIONS}
          selected={filter.excludes}
          onChange={(id) => toggle("excludes", id)}
        />
      ),
    },
    {
      num: 7,
      title: "코스 추천",
      tooltip: "여러 장소를 하나의 코스로 묶어 추천받아요.",
      content: (
        <label className="inline-flex items-center gap-3 cursor-pointer select-none">
          <div
            role="switch"
            aria-checked={filter.courseRecommend}
            tabIndex={0}
            onClick={() =>
              onChange({ courseRecommend: !filter.courseRecommend })
            }
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                onChange({ courseRecommend: !filter.courseRecommend });
              }
            }}
            className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 transition ${filter.courseRecommend ? "bg-green-600" : "bg-slate-200"}`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${filter.courseRecommend ? "translate-x-5.5" : "translate-x-0.5"}`}
            />
          </div>
          <span
            className={`text-sm font-medium ${filter.courseRecommend ? "text-green-700" : "text-slate-600"}`}
          >
            {filter.courseRecommend
              ? "코스로 묶어서 추천받기"
              : "코스 추천 안 함"}
          </span>
        </label>
      ),
    },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm divide-y divide-slate-100">
      {sections.filter(({ num }) => num === 1 || expanded).map(({ num, title, tooltip, content }) => (
        <div key={num} className="px-5 py-4">
          <div className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-green-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
              {num}
            </span>
            {title}
            {tooltip && (
              <div className="relative group ml-auto">
                <button
                  className="w-5 h-5 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-1"
                  aria-label={`${title} 안내`}
                >
                  <Info className="w-3 h-3 text-slate-500" />
                </button>
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 w-60 bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-600 leading-relaxed opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 pointer-events-none z-50 shadow-[0_4px_20px_rgba(0,0,0,0.10)]">
                  {tooltip}
                  <div className="absolute top-1/2 -translate-y-1/2 left-[-5px] w-2.5 h-2.5 bg-white border-l border-b border-slate-200 rotate-45" />
                </div>
              </div>
            )}
          </div>
          {content}
        </div>
      ))}
      <button
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
        aria-controls="filter-sections"
        className="w-full flex items-center justify-center gap-1.5 px-5 py-2.5 text-sm text-slate-500 hover:text-green-700 hover:bg-green-50 font-medium transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 border-t border-slate-100"
      >
        {expanded ? (
          <><ChevronUp className="w-4 h-4" /> 필터 접기</>
        ) : (
          <><ChevronDown className="w-4 h-4" /> 필터 더 보기</>
        )}
      </button>
      <div className="px-5 py-4 flex items-center justify-between bg-slate-50 rounded-b-xl">
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-1 transition rounded"
        >
          <RotateCcw className="w-4 h-4" /> 초기화
        </button>
        <button
          onClick={onSearch}
          className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
        >
          <Search className="w-4 h-4" /> 검색하기
        </button>
      </div>
    </div>
  );
}

// ── 메인 대시보드 ──────────────────────────────────────
export default function MainDashboard() {
  const [data, setData] = useState<BarrierFreeDashboardResponse | null>(null);
  const [showEvidence, setShowEvidence] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [currentTipIdx, setCurrentTipIdx] = useState<number>(0);
  const [tipVisible, setTipVisible] = useState<boolean>(true);
  const [profileOpen, setProfileOpen] = useState<boolean>(false);
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [searchTrigger, setSearchTrigger] = useState<number>(0);
  const profileRef = useRef<HTMLDivElement>(null);

  const [mapLoading, mapError] = useKakaoLoader({
    appkey: process.env.NEXT_PUBLIC_KAKAO_MAP_KEY as string,
    libraries: ["services", "clusterer"],
  });

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node))
        setProfileOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setProfileOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (searchTrigger === 0) return; // 초기 마운트 시 자동 fetch 안 함

    async function fetchData() {
      try {
        setIsLoading(true);
        setHasSearched(true);
        setApiError(null);

        const res = await fetch("/api/tour", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locationText: filter.locationText,
            destination: filter.destination,
            radius:
              parseInt(filter.radius) *
              (filter.radius.endsWith("km") ? 1000 : 1),
            userTypes: filter.userTypes,
            conditions: filter.conditions,
            preferences: filter.preferences,
            excludes: filter.excludes,
            courseRecommend: filter.courseRecommend,
          }),
        });

        // 1. JSON 변환 전에 일단 텍스트 원본으로 받습니다.
        const rawText = await res.text();

        // 2. 브라우저 콘솔(F12)에 원본 응답을 무조건 출력합니다. (원인 분석용)
        console.log("🚨 백엔드(/api/tour) 응답 원본 데이터:", rawText);

        // 3. 데이터가 아예 비어있으면 에러 처리
        if (!rawText) {
          throw new Error(
            "서버에서 빈 응답이 반환되었습니다. (백엔드 에러 또는 Timeout)",
          );
        }

        // 4. 안전하게 JSON으로 파싱 시도
        let result;
        try {
          result = JSON.parse(rawText) as BarrierFreeDashboardResponse & {
            success: boolean;
            error?: string;
          };
        } catch (parseError) {
          console.error("JSON 파싱 에러 상세:", parseError);
          throw new Error(
            `데이터 형태가 올바르지 않습니다. (응답 앞부분: ${rawText.slice(0, 50)}...)`,
          );
        }

        // 5. 파싱 성공 시 데이터 적용
        if (result.success) {
          setData(result);
        } else {
          setApiError(
            result.error || "데이터 처리 중 서버에서 오류가 발생했습니다.",
          );
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "알 수 없는 오류가 발생했습니다.";
        setApiError(`[에러] ${errorMessage}`);
      } finally {
        setIsLoading(false);
      }
    }

    // 첫 렌더링 시 또는 검색 버튼 클릭 시 호출
    fetchData();
  }, [searchTrigger]);

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

  const activeFilterCount = [
    filter.conditions.length > 0,
    filter.preferences.length > 0,
    filter.excludes.length > 0,
    filter.courseRecommend,
    filter.radius !== "1km",
    filter.userTypes.length > 0 &&
      !(filter.userTypes.length === 1 && filter.userTypes[0] === "wheelchair"),
  ].filter(Boolean).length;

  // 로딩 스켈레톤 (검색 중일 때만)
  const loadingSkeleton = isLoading && (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-40 bg-white rounded-xl border border-slate-100"
        />
      ))}
    </div>
  );

  const filteredCards = data?.cards ?? [];

  return (
    <div className="w-full bg-[#f9fafb] min-h-screen font-sans antialiased text-slate-800 flex flex-col">
      <header className="bg-white border-b border-slate-200 h-16 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto h-full px-6 grid grid-cols-3 items-center">
          <div />
          <div className="flex items-center justify-center gap-2.5">
            <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center shadow-sm">
              <Accessibility className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              어디GO
            </span>
          </div>
          <div className="flex justify-end">
            <div ref={profileRef} className="relative">
              <button
                onClick={() => setProfileOpen((p) => !p)}
                className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white text-sm font-bold hover:ring-2 hover:ring-green-300 hover:ring-offset-1 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
              >
                김
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-40 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50 animate-in fade-in-0 slide-in-from-top-1 duration-150">
                  <ul className="py-1">
                    <li>
                      <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus:bg-slate-50">
                        <Settings className="w-4 h-4 text-slate-400 shrink-0" />{" "}
                        프로필 수정
                      </button>
                    </li>
                  </ul>
                  <div className="border-t border-slate-100">
                    <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors cursor-pointer focus:outline-none focus:bg-red-50">
                      <LogOut className="w-4 h-4 shrink-0" /> 로그아웃
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 flex-1 w-full">
        <div className="space-y-5">
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

          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-500 transition">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              className="flex-1 text-sm outline-none bg-transparent placeholder:text-slate-400 text-slate-800"
              placeholder="지역명 또는 장소를 입력하세요"
              value={filter.locationText}
              onChange={(e) =>
                setFilter((f) => ({ ...f, locationText: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") setSearchTrigger((n) => n + 1);
              }}
            />
            {filter.locationText && (
              <button
                onClick={() => setFilter((f) => ({ ...f, locationText: "" }))}
                className="text-slate-400 hover:text-slate-600 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-1 transition rounded"
                aria-label="검색어 지우기"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* 카카오 지도 렌더링 영역 */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden h-64 relative shadow-sm z-0">
            {mapLoading ? (
              <div className="w-full h-full bg-slate-50 flex items-center justify-center text-sm text-slate-500 font-medium">
                지도를 불러오는 중입니다...
              </div>
            ) : mapError ? (
              <div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center text-sm text-red-500 font-medium gap-2">
                <AlertTriangle className="w-5 h-5" />
                지도를 불러올 수 없습니다. API 키 설정을 확인하세요.
              </div>
            ) : (
              <Map
                center={{
                  lat:
                    filteredCards.length > 0 ? filteredCards[0].mapY : 37.5547,
                  lng:
                    filteredCards.length > 0 ? filteredCards[0].mapX : 126.9707,
                }}
                style={{ width: "100%", height: "100%" }}
                level={5}
              >
                <ZoomControl position={"RIGHT"} />
                {filteredCards.map((card) => (
                  <MapMarker
                    key={card.contentId}
                    position={{ lat: card.mapY, lng: card.mapX }}
                    title={card.title}
                  />
                ))}
              </Map>
            )}
          </div>

          <FilterPanel
            filter={filter}
            onChange={(patch) => setFilter((f) => ({ ...f, ...patch }))}
            onReset={() => setFilter(DEFAULT_FILTER)}
            onSearch={() => setSearchTrigger((n) => n + 1)}
          />

          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800">
              맞춤 판정 결과{" "}
              <span className="ml-2 text-green-700 font-bold">
                {filteredCards.length}개
              </span>
            </h2>
          </div>

          {loadingSkeleton}

          {!isLoading && !hasSearched && (
            <div className="bg-white border border-slate-200 rounded-xl py-16 text-center">
              <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-base font-semibold text-slate-600">
                검색 조건을 설정하고 검색해 보세요
              </p>
              <p className="text-sm text-slate-400 mt-1">
                위 필터에서 출발지와 사용자 유형을 선택한 후 검색하기를
                눌러주세요.
              </p>
            </div>
          )}

          {!isLoading && hasSearched && apiError && (
            <div className="bg-red-50 border border-red-200 rounded-xl py-10 text-center px-6">
              <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">
                데이터를 불러올 수 없습니다
              </p>
            </div>
          )}

          {!isLoading &&
            hasSearched &&
            !apiError &&
            filteredCards.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-xl py-16 text-center">
                <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-base text-slate-600">
                  조건에 맞는 장소 데이터가 없습니다.
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  다른 조건으로 다시 검색해 보세요.
                </p>
              </div>
            )}

          {!isLoading &&
            hasSearched &&
            !apiError &&
            filteredCards.length > 0 && (
              <div className="space-y-4">
                {filteredCards.map((card) => {
                  const open = showEvidence === card.contentId;
                  return (
                    <article
                      key={card.contentId}
                      className="bg-white border border-slate-200 rounded-xl hover:border-green-300 transition-colors"
                    >
                      <div className="px-5 py-4 flex items-start justify-between gap-4 border-b border-slate-100">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <h3 className="text-lg font-bold text-slate-900 truncate">
                              {card.title}
                            </h3>
                            <VisitLevelBadge level={card.visitLevel} />
                          </div>
                          <p className="text-sm text-slate-600 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />{" "}
                            {card.address}
                            <span className="ml-2 flex items-center gap-0.5 text-slate-500">
                              <Navigation className="w-3.5 h-3.5" />{" "}
                              {card.distance}m
                            </span>
                          </p>
                        </div>
                        <ScoreRing score={card.score} />
                      </div>

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
                              <AlertTriangle className="w-4 h-4" /> 방문 전 확인
                              필요
                            </p>
                            <ul className="space-y-1">
                              {card.riskFactors.map((risk, i) => (
                                <li
                                  key={i}
                                  className="text-sm text-red-700 flex items-start gap-1.5"
                                >
                                  <span className="mt-2 w-1 h-1 bg-red-400 rounded-full shrink-0" />{" "}
                                  {risk}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <button
                          onClick={() =>
                            setShowEvidence(open ? null : card.contentId)
                          }
                          className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-green-700 font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-1 transition rounded"
                        >
                          <Info className="w-4 h-4" /> 오픈 API 원문 근거{" "}
                          {open ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                        {open && (
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 animate-in fade-in-50 duration-200">
                            <p className="text-xs font-bold text-slate-600 uppercase tracking-widest border-b border-slate-200 pb-2">
                              한국관광공사 OpenAPI 수집 레코드
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                              {[
                                ["진입로", card.evidence.route],
                                ["엘리베이터", card.evidence.elevator],
                                ["화장실", card.evidence.restroom],
                                ["유모차대여", card.evidence.babycar],
                                ["반려동물명", card.evidence.petName],
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
            )}
        </div>

        <aside className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-5">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-1">
              <XCircle className="w-4 h-4 text-red-500" /> 조건 미충족 장소
              <div className="relative group ml-auto">
                <button
                  className="w-5 h-5 flex items-center justify-center transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-1"
                  aria-label="조건 미충족 장소 안내"
                >
                  <Info className="w-4 h-4 text-red-500" />
                </button>
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 w-60 bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-600 leading-relaxed opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 pointer-events-none z-50 shadow-[0_4px_20px_rgba(0,0,0,0.10)]">
                  <p className="font-bold text-slate-800 mb-1.5">
                    조건 미충족 장소란?
                  </p>
                  <p className="mb-2">
                    현재 선택하신 사용자 유형의 최소 접근 조건을 충족하지 못한
                    장소예요.
                  </p>
                  <ul className="space-y-1 text-slate-500">
                    <li className="flex items-start gap-1.5">
                      <span className="mt-1 w-1 h-1 bg-slate-400 rounded-full shrink-0" />{" "}
                      경사로·엘리베이터가 없는 경우
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="mt-1 w-1 h-1 bg-slate-400 rounded-full shrink-0" />{" "}
                      장애인 화장실 정보가 불가인 경우
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="mt-1 w-1 h-1 bg-slate-400 rounded-full shrink-0" />{" "}
                      반려동물 동반이 명시적으로 불가한 경우
                    </li>
                  </ul>
                  <div className="absolute top-1/2 -translate-y-1/2 left-[-5px] w-2.5 h-2.5 bg-white border-l border-b border-slate-200 rotate-45" />
                </div>
              </div>
            </h3>
            {data?.excludedPlaces && data.excludedPlaces.length > 0 ? (
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
              <p className="text-sm text-slate-600 mt-3">제외된 장소가 없습니다.</p>
            )}
          </div>

        </aside>
      </div>

      <footer className="border-t border-slate-200 bg-white w-full">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-center text-xs text-slate-400">
          © 2026 Team NOPE · 어디GO
        </div>
      </footer>
    </div>
  );
}