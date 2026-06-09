# 어디가 Barrier-Free Agent 설계서

> 관광 약자와 동행자를 위한 **AI 접근성 판정·여행 조율 챗봇** 개발용 Agent 문서  
> Ennoia AX 플랫폼에서 Agent, Tool, RAG, 응답 정책을 구성하기 위한 기준 문서입니다.

---

## 0. 프로젝트 요약

### 서비스명

**어디가 Barrier-Free**

### 한 줄 소개

한국관광공사 무장애 여행 정보와 반려동물 동반여행 데이터를 기반으로, 관광 약자와 동행자의 조건을 함께 고려해 **방문 가능성, 접근성 리스크, 추천 이유, 대체 코스**를 제공하는 AI 배리어프리 여행 조율 서비스입니다.

### 핵심 차별점

기존 서비스가 장소별 시설 정보를 단순 제공하는 데 그친다면, 본 서비스는 API 데이터를 AI가 해석하여 다음 질문에 답합니다.

> “이 장소가 내 상황에서 실제로 갈 수 있는 곳인가?”

따라서 본 서비스의 핵심은 **정보 검색**이 아니라 **방문 가능성 판정과 동행 조율**입니다.

---

## 1. 개발 목표

### 1차 MVP 목표

사용자가 자연어로 조건을 입력하면, 주변 관광지를 조회하고 장소별 무장애 정보와 반려동물 정보를 결합하여 다음 결과를 제공합니다.

- 추천 장소 리스트
- 접근성 점수
- 방문 적합도 판정
- 경사로 / 엘리베이터 / 장애인 화장실 / 유모차 대여 상태
- 반려동물 동반 가능 여부
- 추천 이유
- 접근성 리스크
- 방문 전 확인사항
- API 원문 근거

### 예시 사용자 질문

```text
서울역 근처에서 휠체어로 갈 수 있고 장애인 화장실 있는 곳 추천해줘. 강아지도 데려갈 수 있으면 좋겠어.
```

### 예시 서비스 결과

```text
요청 조건을 기준으로 서울역 반경 3km 내 관광지를 확인했습니다.

추천 장소: A 관광지
접근성 점수: 87점
방문 적합도: 안심 방문 가능
경사로: 가능
엘리베이터: 가능
장애인 화장실: 가능
유모차 대여: 확인 필요
반려동물 동반: 제한적 가능

추천 이유:
주출입구 접근성과 장애인 화장실 정보가 확인되어 휠체어 이용자에게 적합합니다.

방문 전 확인:
반려동물 실내 동반 여부와 유모차 대여 여부는 현장 확인이 필요합니다.
```

---

## 2. 시스템 역할 분리

### 전체 아키텍처

```text
사용자
  ↓
Frontend Dashboard / Chat UI
  ↓
Backend API Server
  ↓
Ennoia Agent Workflow
  ↓
Backend Tool API
  ↓
한국관광공사 OpenAPI
```

### 역할 구분

| 영역     | 역할                                                                          |
| -------- | ----------------------------------------------------------------------------- |
| Ennoia   | 자연어 이해, Agent Workflow, RAG, 방문 적합도 판단, 추천 이유 생성, 답변 검증 |
| Backend  | 공공 API 호출, API Key 보관, 응답 정규화, 점수 계산, 캐싱, DB 저장, 장소 매칭 |
| Frontend | 챗봇 입력, 장소 카드, 접근성 대시보드, 지도, 필터 UI                          |

### 중요한 설계 원칙

Ennoia가 공공 API를 직접 호출하기보다, 백엔드에서 Tool API를 만들고 Ennoia가 해당 Tool을 호출하는 구조를 권장합니다.

이유는 다음과 같습니다.

- 공공데이터 API Key 노출 방지
- API 응답 정규화 가능
- 호출 실패 / 빈 응답 / 인코딩 오류 처리 가능
- 캐싱으로 응답 속도 개선 가능
- 장소 매칭 로직 관리 가능
- Ennoia Agent가 판단과 설명에 집중 가능

---

## 3. 사용 데이터 소스

## 3.1 한국관광공사 무장애 여행 정보 API

### 사용 목적

관광 약자가 실제 방문 가능성을 판단할 수 있도록 장소별 접근성 정보를 가져옵니다.

### 핵심 필드

| 사용자 요구               | API 필드   | 설명                                                        |
| ------------------------- | ---------- | ----------------------------------------------------------- |
| 경사로 / 진입로 확인      | `route`    | 주출입구 턱, 경사로 설치, 평탄한 진입 가능 여부 관련 텍스트 |
| 엘리베이터 확인           | `elevator` | 엘리베이터, 휠체어 리프트, 진입 구역 확보 여부 관련 텍스트  |
| 장애인 화장실 확인        | `restroom` | 장애인 전용 화장실, 손잡이, 진입로, 위치 정보 관련 텍스트   |
| 유모차 / 휠체어 대여 확인 | `babycar`  | 유모차 또는 휠체어 대여 가능 여부, 대여처 관련 텍스트       |

### 주요 흐름

```text
locationBasedList 계열 API
  → 사용자 위치 또는 목적지 좌표 기준 관광지 목록 조회
  → contentId 확보
  → detailWithTour 계열 API
  → route / elevator / restroom / babycar 조회
```

> 실제 엔드포인트명은 공공데이터포털 Swagger 화면에서 최종 확인해야 합니다.  
> 문서 또는 버전에 따라 `locationBasedList4`, `detailWithTour2`, `detailWithTour4`처럼 명칭이 달라질 수 있습니다.

---

## 3.2 한국관광공사 반려동물 동반여행 서비스 API

### 사용 목적

반려동물 동반 조건이 있는 사용자에게 장소별 동반 가능 여부와 제한사항을 제공합니다.

### 핵심 필드

| 사용자 요구            | API 필드      | 설명                                    |
| ---------------------- | ------------- | --------------------------------------- |
| 동반 가능 동물         | `petName`     | 동반 가능한 반려동물 종류 또는 크기     |
| 필수 준비물 / 제한사항 | `relisMetm`   | 목줄, 케이지, 배변봉투, 동반 제한 등    |
| 기타 이용 조건         | API 상세 필드 | 전용 구역, 실내 가능 여부, 추가 요금 등 |

### 주요 흐름

```text
무장애 관광지 목록에서 contentId 확보
  → detailPetTour 계열 API 호출
  → petName / relisMetm 등 반려동물 정보 조회
  → 무장애 정보와 결합
```

### 주의사항

무장애 API의 `contentId`와 반려동물 API의 `contentId`가 항상 1:1로 매칭된다고 가정하면 안 됩니다.

따라서 다음 매칭 전략을 사용합니다.

| 단계     | 방식                               |
| -------- | ---------------------------------- |
| 1차 매칭 | `contentId` 직접 매칭              |
| 2차 매칭 | 장소명 + 주소 + 좌표 근접도 매칭   |
| 실패 시  | 반려동물 정보는 `확인 필요`로 표시 |

---

## 4. 사용자 유형 정의

서비스는 “관광 약자”를 하나의 그룹으로 처리하지 않고, 사용자 유형별로 다른 우선순위를 적용합니다.

| 사용자 유형     | 주요 관심 조건                                         | 우선순위  |
| --------------- | ------------------------------------------------------ | --------- |
| 휠체어 이용자   | 경사로, 엘리베이터, 장애인 화장실, 평탄한 이동 동선    | 매우 높음 |
| 고령자          | 이동 거리, 계단 여부, 휴식 가능성, 화장실 접근성       | 높음      |
| 영유아 동반자   | 유모차 대여, 엘리베이터, 화장실, 수유/휴식 가능성      | 높음      |
| 반려동물 동반자 | 동반 가능 여부, 목줄/케이지 조건, 실내 제한, 추가 요금 | 높음      |
| 일반 동행자     | 취향, 사진 명소, 음식점, 체험 활동, 이동 편의          | 중간      |
| 복합 동행자     | 위 조건이 2개 이상 결합된 상황                         | 매우 높음 |

---

## 5. 접근성 상태 정규화 정책

무장애 API의 핵심 필드는 대부분 텍스트입니다.  
따라서 원문을 그대로 노출하지 않고, 사용자가 이해하기 쉬운 상태값으로 정규화합니다.

### 상태값

| 상태          | 의미                                            |
| ------------- | ----------------------------------------------- |
| `가능`        | 해당 시설 또는 조건이 명확히 확인됨             |
| `제한적 가능` | 일부 가능하지만 보조, 문의, 조건, 제한이 필요함 |
| `확인 필요`   | 정보가 없거나 불명확하여 현장 확인이 필요함     |
| `불가`        | 해당 조건이 명확히 불가능하거나 미설치로 확인됨 |

### 정규화 키워드 기준

| 상태        | 키워드 예시                                                 |
| ----------- | ----------------------------------------------------------- |
| 가능        | 있음, 설치, 가능, 이용 가능, 대여 가능, 구비, 마련          |
| 제한적 가능 | 일부, 보조 필요, 문의, 제한, 사전 예약, 조건부, 보호자 동반 |
| 확인 필요   | 정보 없음, 미확인, 확인 필요, 문의 필요, 빈 값, null        |
| 불가        | 없음, 불가, 미설치, 이용 불가, 대여 불가                    |

### 정규화 예시

```json
{
  "field": "route",
  "rawText": "주출입구에 경사로가 설치되어 있으며 휠체어 접근 가능",
  "status": "가능",
  "evidence": "주출입구에 경사로가 설치되어 있으며 휠체어 접근 가능"
}
```

### 백엔드 정규화 함수 예시

```javascript
function normalizeAccessibilityText(text) {
  if (!text || text.trim() === "") {
    return "확인 필요";
  }

  const positiveKeywords = [
    "있음",
    "설치",
    "가능",
    "이용 가능",
    "대여 가능",
    "구비",
    "마련",
  ];
  const limitedKeywords = [
    "일부",
    "보조",
    "문의",
    "제한",
    "사전",
    "조건부",
    "보호자",
  ];
  const negativeKeywords = ["없음", "불가", "미설치", "이용 불가", "대여 불가"];

  if (negativeKeywords.some((keyword) => text.includes(keyword))) {
    return "불가";
  }

  if (limitedKeywords.some((keyword) => text.includes(keyword))) {
    return "제한적 가능";
  }

  if (positiveKeywords.some((keyword) => text.includes(keyword))) {
    return "가능";
  }

  return "확인 필요";
}
```

> MVP에서는 규칙 기반 정규화를 먼저 적용하고, 이후 Ennoia Agent가 문맥을 보완 판단하는 구조로 확장합니다.

---

## 6. 접근성 점수 정책

### 기본 가중치

| 항목                 |  점수 |
| -------------------- | ----: |
| 경사로 / 진입로      |  25점 |
| 엘리베이터 / 리프트  |  20점 |
| 장애인 화장실        |  25점 |
| 유모차 / 휠체어 대여 |  15점 |
| 반려동물 동반        |  15점 |
| 총점                 | 100점 |

### 상태별 반영 비율

| 상태        | 반영 비율 |
| ----------- | --------: |
| 가능        |      100% |
| 제한적 가능 |       60% |
| 확인 필요   |       30% |
| 불가        |        0% |

### 계산 예시

```text
경사로: 가능 → 25점
엘리베이터: 확인 필요 → 6점
장애인 화장실: 가능 → 25점
유모차 대여: 불가 → 0점
반려동물 동반: 제한적 가능 → 9점

총점: 65점
```

---

## 7. 방문 적합도 판정 정책

서비스는 단순히 가능 / 불가능으로 판단하지 않습니다.  
사용자가 실제로 여행 결정을 내릴 수 있도록 5단계 방문 적합도를 제공합니다.

| 방문 적합도         | 기준                                                       |
| ------------------- | ---------------------------------------------------------- |
| `안심 방문 가능`    | 필수 조건이 대부분 `가능`이고 주요 리스크가 낮음           |
| `동행 시 방문 가능` | 핵심 조건은 충족하지만 일부 보조 또는 동행자 도움이 필요함 |
| `부분 방문 가능`    | 일부 구역, 일부 시설, 일부 조건에서만 이용 가능함          |
| `방문 전 확인 필요` | 정보가 부족하거나 핵심 조건이 불명확함                     |
| `추천 제외`         | 사용자의 필수 조건을 명확히 충족하지 못함                  |

### 필수 조건 불충족 처리

사용자가 명시한 필수 조건이 `불가`인 경우, 해당 장소는 원칙적으로 추천 목록에서 제외합니다.

단, 대체 장소가 너무 적을 경우 다음처럼 별도 섹션에 표시할 수 있습니다.

```text
조건 미충족으로 추천 제외된 장소
- B 관광지: 장애인 화장실 정보가 없음
- C 관광지: 반려동물 동반 불가
```

---

## 8. Ennoia Agent 구성

## 8.1 RequestParserAgent

### 역할

사용자의 자연어 요청에서 위치, 조건, 사용자 유형, 필수 조건, 선택 조건, 동행자 취향을 추출합니다.

### 입력 예시

```text
부모님은 오래 걷기 힘들고, 동생은 강아지를 데려가고 싶어. 서울역 근처에서 하루 코스 추천해줘.
```

### 출력 예시

```json
{
  "locationText": "서울역",
  "mapX": null,
  "mapY": null,
  "radius": 3000,
  "userTypes": ["senior", "pet_companion", "general_companion"],
  "requiredConditions": ["restroom", "low_walking_burden"],
  "optionalConditions": ["route", "elevator", "pet_allowed"],
  "petRequired": true,
  "companionPreferences": ["short_distance", "photo_spot"],
  "excludeConditions": [],
  "needsCourse": true
}
```

### System Prompt

```text
너는 관광 약자와 동행자를 위한 여행 조건 분석 에이전트다.

사용자의 문장에서 다음 정보를 추출한다.
- 지역명 또는 좌표
- 검색 반경
- 사용자 유형: 휠체어 이용자, 고령자, 영유아 동반자, 반려동물 동반자, 일반 동행자
- 필수 조건: 경사로, 엘리베이터, 장애인 화장실, 유모차 대여, 반려동물 동반, 짧은 이동 거리
- 선택 조건
- 동행자 취향
- 제외 조건
- 코스 추천 필요 여부

출력은 JSON으로만 한다.
사용자가 말하지 않은 정보는 추정하지 말고 null 또는 false로 둔다.
사용자의 안전과 관련된 조건은 선택 조건보다 필수 조건으로 우선 분류한다.
```

---

## 8.2 DataCollectorAgent

### 역할

RequestParserAgent의 구조화 결과를 바탕으로 백엔드 Tool API를 호출하여 장소 후보와 상세 데이터를 수집합니다.

### 호출 순서

```text
1. resolveLocation
2. searchBarrierFreePlaces
3. getBarrierFreeDetail
4. getPetTourDetail
5. matchPlaceData
6. scoreAccessibility
```

### System Prompt

```text
너는 배리어프리 관광 데이터를 수집하는 데이터 조회 에이전트다.

사용자의 위치와 조건에 따라 필요한 Tool을 순서대로 호출한다.
장소 후보는 먼저 무장애 위치기반 관광지 조회 결과에서 가져온다.
각 장소의 contentId를 기준으로 무장애 상세 정보를 조회한다.
반려동물 조건이 있거나 사용자가 반려동물 동반을 언급한 경우에만 반려동물 상세 정보를 조회한다.

Tool 응답이 비어 있거나 매칭에 실패한 경우 해당 항목을 임의로 채우지 말고 "확인 필요" 상태로 유지한다.

**중요**: `scoreAccessibility` Tool을 호출할 때 `statuses` 객체의 키값은 반드시 `route`, `elevator`, `restroom`, `babycar`, `pet` 중 하나여야 한다. `routeStatus`나 `elevatorStatus`처럼 임의로 이름을 변경하지 마라.
```

---

## 8.3 AccessibilityJudgeAgent

### 역할

수집된 API 원문과 정규화 결과를 근거로 장소별 방문 적합도를 판단합니다.

### System Prompt

```text
너는 무장애 관광 접근성 판정 에이전트다.

입력된 API 원문, 정규화 상태, 접근성 점수만 근거로 장소의 방문 적합도를 판단한다.
API에 없는 정보는 절대 생성하지 않는다.

각 항목은 다음 중 하나로 분류한다.
- 가능
- 제한적 가능
- 확인 필요
- 불가

최종 방문 적합도는 다음 중 하나로 분류한다.
- 안심 방문 가능
- 동행 시 방문 가능
- 부분 방문 가능
- 방문 전 확인 필요
- 추천 제외

각 판단에는 반드시 원문 근거를 포함한다.
사용자의 필수 조건을 충족하지 못하는 장소는 추천 제외로 분류한다.
정보가 부족한 경우 단정하지 말고 방문 전 확인 필요로 분류한다.
```

---

## 8.4 CompanionCoordinatorAgent

### 역할

관광 약자의 접근성 조건과 일반 동행자의 취향을 함께 고려하여 공통 일정과 선택 일정을 조율합니다.

### 사용 상황

다음 조건 중 하나 이상이 있을 때 사용합니다.

- 사용자 질문에 동행자가 등장함
- 사용자 유형이 2개 이상임
- 관광 약자 조건과 일반 여행 취향이 동시에 존재함
- 코스 추천 또는 일정 추천을 요청함

### 조율 방식

| 구분      | 처리 방식                                              |
| --------- | ------------------------------------------------------ |
| 공통 일정 | 접근성 점수가 높고 모두가 이동 가능한 장소 우선        |
| 선택 일정 | 일반 동행자의 취향을 반영하되, 재합류가 쉬운 장소 중심 |
| 대체 장소 | 필수 조건 미충족 장소를 접근성 높은 장소로 대체        |
| 재합류    | 이동 부담이 적은 중간 지점 또는 접근성 좋은 장소 추천  |

### System Prompt

```text
너는 관광 약자와 동행자가 함께 만족할 수 있는 여행 코스를 조율하는 에이전트다.

항상 관광 약자의 안전과 접근성 조건을 최우선으로 고려한다.
그다음 일반 동행자의 취향을 선택 일정 또는 보조 일정으로 반영한다.

공통 일정은 다음 기준으로 구성한다.
- 접근성 점수가 높은 장소
- 장애인 화장실 또는 휴식 가능성이 확인된 장소
- 이동 부담이 낮은 장소
- 반려동물 조건이 필요한 경우 반려동물 상태가 가능 또는 제한적 가능인 장소

동행자의 취향이 접근성 조건과 충돌하면, 무리하게 하나의 일정으로 합치지 말고 공통 일정과 선택 일정을 분리한다.
API에 없는 이동 시간이나 시설 정보를 임의로 생성하지 않는다.
```

---

## 8.5 AnswerComposerAgent

### 역할

프론트엔드 대시보드가 바로 사용할 수 있는 JSON 응답을 생성합니다.

### System Prompt

```text
너는 관광 약자와 동행자를 위한 배리어프리 여행 챗봇이다.

응답은 사용자가 바로 이해할 수 있는 대시보드 카드 형태의 JSON으로 작성한다.

각 장소마다 다음 정보를 포함한다.
- 장소명
- 주소
- 좌표
- 접근성 점수
- 방문 적합도
- 경사로 / 진입로 상태
- 엘리베이터 상태
- 장애인 화장실 상태
- 유모차 / 휠체어 대여 상태
- 반려동물 동반 상태
- 추천 이유
- 리스크
- 방문 전 확인사항
- API 원문 근거

정보가 부족한 항목은 "확인 필요"로 표시한다.
API 원문에 없는 내용을 임의로 생성하지 않는다.
사용자의 안전과 관련된 내용은 단정하지 않는다.
```

---

## 8.6 VerifierAgent

### 역할

최종 답변이 API 원문과 정책을 위반하지 않았는지 검증합니다.

### 검증 규칙

```text
1. API 원문에 없는 정보는 생성하지 않는다.
2. 정보가 없는 항목은 "확인 필요"로 표시한다.
3. 사용자가 명시한 필수 조건이 불가인 장소는 추천하지 않는다.
4. 사용자 안전과 관련된 내용은 단정하지 않는다.
5. 각 추천 장소마다 원문 근거가 있어야 한다.
6. 반려동물 정보 매칭이 실패한 경우 "확인 필요"로 표시한다.
7. 장소명, 주소, contentId, 좌표가 없는 장소는 추천하지 않는다.
```

### System Prompt

```text
너는 배리어프리 관광 추천 결과를 검증하는 에이전트다.

최종 응답이 다음 조건을 만족하는지 확인한다.
- 모든 추천 이유가 API 원문 또는 정규화 결과에 근거하는가
- 정보가 없는 항목을 가능하다고 단정하지 않았는가
- 필수 조건을 충족하지 못하는 장소가 추천 목록에 포함되지 않았는가
- 방문 전 확인이 필요한 항목이 누락되지 않았는가
- 반려동물 정보가 없을 때 "확인 필요"로 표시되었는가

문제가 있으면 수정된 JSON을 반환한다.
문제가 없으면 원본 JSON을 반환한다.
```

---

## 9. Backend Tool API 명세

Ennoia가 호출할 백엔드 Tool API 명세입니다.

---

## 9.1 `resolveLocation`

### 설명

지역명 또는 장소명을 좌표로 변환합니다.

### Endpoint

```http
POST /tools/location/resolve
```

### Request

```json
{
  "locationText": "서울역"
}
```

### Response

```json
{
  "locationText": "서울역",
  "mapX": 126.9707,
  "mapY": 37.5547,
  "confidence": 0.95,
  "source": "kakao_local_or_internal"
}
```

---

## 9.2 `searchBarrierFreePlaces`

### 설명

사용자 좌표와 반경을 기준으로 주변 무장애 관광지 목록을 조회합니다.

### Endpoint

```http
POST /tools/barrier-free/search
```

### Request

```json
{
  "mapX": 126.9707,
  "mapY": 37.5547,
  "radius": 3000,
  "numOfRows": 10
}
```

### Response

```json
{
  "places": [
    {
      "contentId": "123456",
      "contentTypeId": "12",
      "title": "A 관광지",
      "addr1": "서울특별시 중구 ...",
      "mapX": 126.971,
      "mapY": 37.555,
      "distance": 820
    }
  ]
}
```

---

## 9.3 `getBarrierFreeDetail`

### 설명

`contentId`를 기준으로 무장애 상세정보를 조회합니다.

### Endpoint

```http
POST /tools/barrier-free/detail
```

### Request

```json
{
  "contentId": "123456"
}
```

### Response

```json
{
  "contentId": "123456",
  "route": "주출입구에 경사로가 설치되어 있으며 휠체어 접근 가능",
  "elevator": "엘리베이터 있음",
  "restroom": "장애인 화장실 있음",
  "babycar": "유모차 대여 정보 없음",
  "normalized": {
    "routeStatus": "가능",
    "elevatorStatus": "가능",
    "restroomStatus": "가능",
    "babycarStatus": "확인 필요"
  },
  "evidence": {
    "route": "주출입구에 경사로가 설치되어 있으며 휠체어 접근 가능",
    "elevator": "엘리베이터 있음",
    "restroom": "장애인 화장실 있음",
    "babycar": "유모차 대여 정보 없음"
  }
}
```

---

## 9.4 `getPetTourDetail`

### 설명

`contentId` 또는 장소명 / 주소 / 좌표를 기준으로 반려동물 동반 정보를 조회합니다.

### Endpoint

```http
POST /tools/pet-tour/detail
```

### Request

```json
{
  "contentId": "123456",
  "title": "A 관광지",
  "addr1": "서울특별시 중구 ...",
  "mapX": 126.971,
  "mapY": 37.555
}
```

### Response

```json
{
  "contentId": "123456",
  "matchType": "contentId",
  "matchConfidence": 1.0,
  "petName": "소형견 가능",
  "relisMetm": "목줄 착용 필수, 배변봉투 지참",
  "petAllowedStatus": "제한적 가능",
  "evidence": {
    "petName": "소형견 가능",
    "relisMetm": "목줄 착용 필수, 배변봉투 지참"
  }
}
```

### 매칭 실패 시 Response

```json
{
  "contentId": "123456",
  "matchType": "none",
  "matchConfidence": 0,
  "petAllowedStatus": "확인 필요",
  "petName": null,
  "relisMetm": null,
  "evidence": {
    "pet": "반려동물 동반여행 API에서 매칭되는 정보를 찾지 못함"
  }
}
```

---

## 9.5 `scoreAccessibility`

### 설명

무장애 정규화 결과와 반려동물 상태를 기준으로 접근성 점수와 방문 적합도를 계산합니다.

### Endpoint

```http
POST /tools/accessibility/score
```

### Request

```json
{
  "requiredConditions": ["route", "restroom"],
  "statuses": {
    "route": "가능",
    "elevator": "가능",
    "restroom": "가능",
    "babycar": "확인 필요",
    "pet": "제한적 가능"
  }
}
```

### Response

```json
{
  "score": 87,
  "visitLevel": "안심 방문 가능",
  "riskFactors": [
    "유모차 대여 여부는 현장 확인이 필요합니다.",
    "반려동물은 목줄 착용 등 제한사항이 있을 수 있습니다."
  ],
  "bestFor": ["휠체어 이용자", "영유아 동반자"],
  "excluded": false,
  "excludeReason": null
}
```

---

## 10. Ennoia Workflow

### 기본 추천 Workflow

```text
User Message
  ↓
RequestParserAgent
  ↓
resolveLocation Tool
  ↓
searchBarrierFreePlaces Tool
  ↓
getBarrierFreeDetail Tool
  ↓
getPetTourDetail Tool
  ↓
scoreAccessibility Tool
  ↓
AccessibilityJudgeAgent
  ↓
AnswerComposerAgent
  ↓
VerifierAgent
  ↓
Dashboard JSON Response
```

### 동행 조율 Workflow

사용자가 동행자, 가족, 부모님, 아이, 강아지, 친구, 코스 추천 등을 언급하면 CompanionCoordinatorAgent를 추가합니다.

```text
User Message
  ↓
RequestParserAgent
  ↓
DataCollectorAgent
  ↓
AccessibilityJudgeAgent
  ↓
CompanionCoordinatorAgent
  ↓
AnswerComposerAgent
  ↓
VerifierAgent
  ↓
Dashboard JSON Response
```

---

## 11. 최종 응답 JSON Schema

Frontend는 이 JSON을 받아 카드, 태그, 지도, 상세 모달로 렌더링합니다.

```json
{
  "summary": "요청하신 조건을 기준으로 서울역 반경 3km 내 관광지를 확인했습니다.",
  "query": {
    "locationText": "서울역",
    "mapX": 126.9707,
    "mapY": 37.5547,
    "radius": 3000,
    "userTypes": ["wheelchair_user", "pet_companion"],
    "requiredConditions": ["route", "restroom"],
    "optionalConditions": ["elevator", "babycar", "pet_allowed"]
  },
  "cards": [
    {
      "contentId": "123456",
      "title": "A 관광지",
      "address": "서울특별시 중구 ...",
      "mapX": 126.971,
      "mapY": 37.555,
      "distance": 820,
      "score": 87,
      "visitLevel": "안심 방문 가능",
      "statuses": {
        "route": "가능",
        "elevator": "가능",
        "restroom": "가능",
        "babycar": "확인 필요",
        "pet": "제한적 가능"
      },
      "recommendReason": "주출입구 접근성과 장애인 화장실 정보가 확인되어 휠체어 이용자에게 적합합니다.",
      "riskFactors": [
        "유모차 대여 여부는 현장 확인이 필요합니다.",
        "반려동물 실내 동반 여부는 현장 확인이 필요합니다."
      ],
      "checkBeforeVisit": [
        "유모차 또는 휠체어 대여 가능 여부",
        "반려동물 동반 가능 구역"
      ],
      "bestFor": ["휠체어 이용자", "반려동물 동반자"],
      "evidence": {
        "route": "주출입구에 경사로가 설치되어 있으며 휠체어 접근 가능",
        "elevator": "엘리베이터 있음",
        "restroom": "장애인 화장실 있음",
        "babycar": "유모차 대여 정보 없음",
        "petName": "소형견 가능",
        "relisMetm": "목줄 착용 필수, 배변봉투 지참"
      }
    }
  ],
  "excludedPlaces": [
    {
      "title": "B 관광지",
      "reason": "사용자가 필수 조건으로 요청한 장애인 화장실 정보가 불가로 확인됨"
    }
  ],
  "warnings": [
    "공공데이터 정보는 현장 상황과 다를 수 있으므로 방문 전 확인이 필요합니다.",
    "정보가 없는 항목은 가능으로 단정하지 않고 확인 필요로 표시했습니다."
  ]
}
```

---

## 12. 응답 정책

### 반드시 지켜야 할 규칙

1. API 원문에 없는 정보는 생성하지 않습니다.
2. 정보가 부족하면 `확인 필요`로 표시합니다.
3. 사용자 안전과 관련된 정보는 단정하지 않습니다.
4. 추천 이유에는 반드시 근거를 포함합니다.
5. 필수 조건이 `불가`인 장소는 추천에서 제외합니다.
6. 반려동물 정보 매칭 실패 시 `확인 필요`로 표시합니다.
7. 사용자의 현재 위치는 필요 이상 저장하지 않습니다.
8. 의료적 조언, 법적 책임 판단, 시설 안전 보장 표현은 사용하지 않습니다.

### 금지 표현

```text
완전히 안전합니다.
무조건 이용 가능합니다.
반드시 문제없이 방문할 수 있습니다.
현장 확인 없이 방문해도 됩니다.
```

### 권장 표현

```text
API 정보 기준으로 접근성이 확인됩니다.
현장 상황에 따라 달라질 수 있어 방문 전 확인이 필요합니다.
해당 항목은 정보가 없어 확인 필요로 분류했습니다.
보호자 또는 동행자와 함께 방문하는 것을 권장합니다.
```

---

## 13. RAG Knowledge Base 문서 구성

Ennoia RAG에는 실시간 관광지 데이터 전체를 넣지 않습니다.  
실시간 데이터는 API Tool로 조회하고, RAG에는 판단 기준과 답변 정책을 넣습니다.

### 권장 문서 목록

```text
docs/
  ├─ 01_accessibility_field_dictionary.md
  ├─ 02_pet_tour_field_dictionary.md
  ├─ 03_normalization_policy.md
  ├─ 04_visit_level_policy.md
  ├─ 05_scoring_policy.md
  ├─ 06_response_policy.md
  ├─ 07_user_type_priority.md
  └─ 08_test_scenarios.md
```

### 문서별 내용

| 문서                                   | 내용                                            |
| -------------------------------------- | ----------------------------------------------- |
| `01_accessibility_field_dictionary.md` | `route`, `elevator`, `restroom`, `babycar` 의미 |
| `02_pet_tour_field_dictionary.md`      | `petName`, `relisMetm` 의미                     |
| `03_normalization_policy.md`           | 가능 / 제한적 가능 / 확인 필요 / 불가 기준      |
| `04_visit_level_policy.md`             | 방문 적합도 5단계 기준                          |
| `05_scoring_policy.md`                 | 접근성 점수 계산 기준                           |
| `06_response_policy.md`                | 답변 생성, 금지 표현, 확인 필요 처리            |
| `07_user_type_priority.md`             | 사용자 유형별 우선순위                          |
| `08_test_scenarios.md`                 | 대표 테스트 질문과 기대 결과                    |

---

## 14. 테스트 시나리오

### Test 1. 휠체어 이용자

```text
서울역 근처에서 휠체어로 갈 수 있고 장애인 화장실 있는 관광지 추천해줘.
```

검증 포인트:

- `route`, `restroom`이 필수 조건으로 추출되는가
- 경사로와 화장실 정보가 없는 장소를 추천하지 않는가
- 엘리베이터 정보가 없으면 확인 필요로 표시하는가

---

### Test 2. 영유아 동반자

```text
부산역 근처에서 유모차 끌고 갈 수 있는 실내 관광지 찾아줘.
```

검증 포인트:

- `babycar`, `elevator`, `route`가 우선 조건으로 처리되는가
- 유모차 대여 정보가 없을 때 확인 필요로 표시하는가

---

### Test 3. 반려동물 동반자

```text
강아지랑 같이 갈 수 있고 엘리베이터 있는 곳 추천해줘.
```

검증 포인트:

- 반려동물 API가 호출되는가
- `petName`, `relisMetm`이 요약되는가
- 매칭 실패 시 반려동물 상태를 확인 필요로 표시하는가

---

### Test 4. 복합 동행자

```text
부모님은 오래 걷기 힘들고, 동생은 강아지를 데려가고 싶어. 서울에서 하루 코스 추천해줘.
```

검증 포인트:

- 고령자 + 반려동물 동반자 + 일반 동행자로 분류되는가
- 접근성 높은 공통 일정과 선택 일정이 분리되는가
- 무리한 이동 또는 API에 없는 이동 시간을 생성하지 않는가

---

### Test 5. 정보 부족 상황

```text
장애인 화장실이 있는지 확실한 곳만 추천해줘.
```

검증 포인트:

- `restroom`이 `가능`인 장소만 추천하는가
- `확인 필요` 장소를 추천에서 제외하거나 별도 표시하는가

---

## 15. 개발 우선순위

### 1단계: 공공 API 검증

- 무장애 여행 정보 API 활용신청
- 반려동물 동반여행 API 활용신청
- Swagger 또는 Postman으로 실제 응답 확인
- 서울역 / 부산역 / 강릉역 기준 샘플 응답 20개 확보
- `route`, `elevator`, `restroom`, `babycar` 실제 값 확인
- `contentId` 기준 반려동물 정보 매칭 가능 여부 확인

### 2단계: 백엔드 Tool API 구현

- `resolveLocation`
- `searchBarrierFreePlaces`
- `getBarrierFreeDetail`
- `getPetTourDetail`
- `scoreAccessibility`

### 3단계: 정규화 / 점수화 구현

- 텍스트 상태 정규화
- 접근성 점수 계산
- 방문 적합도 판정
- 추천 제외 조건 적용

### 4단계: Ennoia Agent 구성

- RAG 문서 업로드
- Agent별 System Prompt 등록
- Tool API 연결
- Workflow 구성
- 테스트 질문 실행

### 5단계: Frontend 대시보드 연결

- 챗봇 입력창
- 장소 카드 UI
- 접근성 상태 태그
- 지도 마커
- 원문 근거 보기 모달
- 확인 필요 / 리스크 영역

---

## 16. 환경변수 예시

```env
# 한국관광공사 공공데이터 API
KTO_BARRIER_FREE_SERVICE_KEY=your_barrier_free_service_key
KTO_PET_TOUR_SERVICE_KEY=your_pet_tour_service_key

# 지도 / 위치 변환
KAKAO_REST_API_KEY=your_kakao_rest_api_key
VITE_KAKAO_JS_KEY=your_kakao_javascript_key

# Ennoia
ENNOIA_API_KEY=your_ennoia_api_key
ENNOIA_WORKSPACE_ID=your_workspace_id
ENNOIA_AGENT_ID=your_agent_id

# Optional
TMAP_APP_KEY=your_tmap_app_key
KMA_SERVICE_KEY=your_weather_service_key
```

---

## 17. 로그 설계

Agent가 어떤 근거로 추천했는지 추적할 수 있어야 합니다.

### 저장할 로그

| 로그                    | 목적             |
| ----------------------- | ---------------- |
| 사용자 원문 질문        | 요청 분석 개선   |
| 추출된 조건 JSON        | 파서 정확도 검증 |
| 호출한 Tool 목록        | Agent 동작 추적  |
| API 원문 응답           | 판단 근거 보존   |
| 정규화 결과             | 점수화 검증      |
| 최종 추천 결과          | 추천 품질 분석   |
| 제외된 장소와 이유      | 신뢰성 확보      |
| VerifierAgent 수정 내역 | 환각 방지 검증   |

### 개인정보 주의

- 사용자 실시간 위치는 필요한 범위에서만 사용합니다.
- 위치 로그 저장 시 익명화 또는 좌표 반올림 처리를 고려합니다.
- 전화번호, 주민등록번호, 건강정보 등 민감정보는 저장하지 않습니다.

---

## 18. MVP 완료 기준

아래 조건을 만족하면 1차 MVP 완료로 봅니다.

- 사용자가 자연어로 위치와 조건을 입력할 수 있음
- 위치 기반 관광지 10개 이상 조회 가능
- 각 장소의 무장애 상세정보 조회 가능
- `route`, `elevator`, `restroom`, `babycar` 정규화 가능
- 반려동물 정보 조회 또는 확인 필요 처리 가능
- 접근성 점수 계산 가능
- 방문 적합도 5단계 판정 가능
- 추천 이유와 리스크 생성 가능
- API 원문 근거 표시 가능
- Ennoia Workflow에서 Agent와 Tool이 정상 작동
- 최종 응답이 Frontend에서 바로 사용할 수 있는 JSON 구조로 반환됨

---

## 19. 발표용 핵심 문장

```text
본 서비스는 공공데이터를 단순히 보여주는 챗봇이 아니라, 관광 약자와 동행자의 조건을 함께 고려해 실제 방문 가능성을 판정하는 AI 배리어프리 여행 조율 서비스입니다.
```

```text
경사로, 엘리베이터, 장애인 화장실, 유모차 대여, 반려동물 동반 조건을 API 원문 기반으로 분석하고, 정보가 부족한 항목은 가능으로 단정하지 않고 확인 필요로 표시합니다.
```

```text
관광 약자 개인만을 위한 추천이 아니라, 고령자·장애인·영유아·반려동물 동반자와 일반 동행자가 함께 갈 수 있는 코스를 조율한다는 점에서 차별화됩니다.
```

---

## 20. 최종 구현 방향 요약

```text
1. 공공 API 응답 확인
2. 백엔드 Tool API 구현
3. 접근성 정규화 / 점수화 정책 구현
4. Ennoia RAG에 판단 기준 문서 등록
5. Ennoia Agent Workflow 구성
6. Agent가 백엔드 Tool을 호출하도록 연결
7. 최종 응답을 Dashboard JSON으로 고정
8. Frontend에서 카드 / 지도 / 리스크 대시보드로 시각화
```

서비스의 핵심은 다음 한 문장으로 정리됩니다.

> **공공데이터를 해석해 관광 약자와 동행자의 실제 방문 가능성을 판정하는 AI 서비스**
