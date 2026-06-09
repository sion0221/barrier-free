# Ennoia Barrier-Free Chatbot Tool API Schema

이 문서는 배리어프리(무장애) 및 반려동물 여행 챗봇 서비스의 **백엔드 API 규격 및 스키마 정의서**입니다. 프론트엔드와 백엔드의 데이터 포맷 통일을 위해 활용해 주세요.
---

## 📌 공통 타입 (Common Types)

### 1. `AccessibilityStatus`
관광지의 편의시설 이용 가능 상태 또는 반려동물 동반 가능 여부 상태를 정의합니다.
* **타입**: `String (Literal)`
* **가능한 값**:
  * `"가능"` : 이용 혹은 동반에 제약이 없음
  * `"제한적 가능"` : 보호자 동반, 전용 케이지 사용 등 조건부 이용 가능
  * `"확인 필요"` : 데이터 미비 혹은 현장 확인이 필요한 상태
  * `"불가"` : 이용 혹은 동반이 불가함

### 2. `VisitLevel`
관광지의 편의시설 상태 점수와 필수 조건 충족 여부에 따라 결정되는 **종합 권장 방문 등급**입니다.
* **타입**: `String (Literal)`
* **가능한 값**:
  * `"안심 방문 가능"` : 점수가 매우 높고 핵심적인 편의시설이 완비된 상태
  * `"동행 시 방문 가능"` : 보행로 경사 등이 급하여 보조자의 도움이 필요한 상태
  * `"부분 방문 가능"` : 일부 시설만 이용할 수 있어 제한적으로 추천하는 상태
  * `"방문 전 확인 필요"` : 최신 정보나 현장 사정에 대해 유선/홈페이지 확인을 적극 권장하는 상태
  * `"추천 제외"` : 사용자의 필수 조건이 결여되어 있거나 위험 요인이 존재하여 배제된 상태

---

## 🚀 API Endpoint 목록

| 기능 | HTTP Method | Path | 설명 |
| :--- | :--- | :--- | :--- |
| **위치 좌표 변환** | `POST` | `/tools/location/resolve` | 한국어 지명(명칭)을 위/경도 좌표로 변환 |
| **무장애 관광지 검색** | `POST` | `/tools/barrier-free/search` | 특정 좌표 반경 내 무장애 관광지 목록 검색 |
| **무장애 시설 상세** | `POST` | `/tools/barrier-free/detail` | 특정 관광지의 배리어프리 상세 정보 및 정규화 상태 조회 |
| **반려동물 동반 상세** | `POST` | `/tools/pet-tour/detail` | 특정 관광지의 반려동물 동반 가능 조건 및 규정 상세 조회 |
| **장애 적합성 채점** | `POST` | `/tools/accessibility/score` | 필수 조건 및 시설 상태를 기반으로 점수 및 위험 요소 채점 |

---

## 🔍 상세 API 스키마 정의

### 1. 위치 좌표 변환 (Location Resolve)
* **Endpoint**: `POST /tools/location/resolve`
* **설명**: 사용자가 입력한 검색 지명(텍스트)을 카카오 로컬 API 및 사전 정의된 Fallback 테이블을 통해 `(mapX, mapY)` 위경도 좌표로 매핑합니다.

#### Request Schema (`ResolveLocationRequest`)
```json
{
  "locationText": "서울역"
}
```
| 필드명 | 타입 | 필수 여부 | 설명 |
| :--- | :--- | :---: | :--- |
| `locationText` | `string` | Y | 검색하고자 하는 위치명 (최소 1자 이상) |

#### Response Schema (`ResolveLocationResponse`)
```json
{
  "locationText": "서울역",
  "mapX": 126.9707,
  "mapY": 37.5547,
  "confidence": 1.0,
  "source": "fallback"
}
```
| 필드명 | 타입 | 설명 |
| :--- | :--- | :--- |
| `locationText` | `string` | 최종 검색에 사용된 위치명 |
| `mapX` | `float \| null` | 경도 (Longitude, x 좌표). 검색 실패 시 `null` |
| `mapY` | `float \| null` | 위도 (Latitude, y 좌표). 검색 실패 시 `null` |
| `confidence` | `float` | 결과의 신뢰도 수치 (0.0 ~ 1.0) |
| `source` | `string` | 결과 좌표 획득 경로 (`"fallback"`, `"kakao_local"`, `"failed"`) |

---

### 2. 무장애 관광지 검색 (Barrier-Free Search)
* **Endpoint**: `POST /tools/barrier-free/search`
* **설명**: 기준 좌표 주변 반경 내의 무장애 편의시설 정보가 있는 관광지를 가까운 거리 순으로 검색합니다.

#### Request Schema (`BarrierFreeSearchRequest`)
```json
{
  "mapX": 126.9707,
  "mapY": 37.5547,
  "radius": 3000,
  "numOfRows": 10
}
```
| 필드명 | 타입 | 기본값 | 범위 | 설명 |
| :--- | :--- | :---: | :---: | :--- |
| `mapX` | `float` | - | - | 중심 좌표의 경도 (x) |
| `mapY` | `float` | - | - | 중심 좌표의 위도 (y) |
| `radius` | `integer` | `3000` | `>= 1` | 검색 반경 범위 (단위: 미터) |
| `numOfRows` | `integer` | `10` | `1 ~ 500` | 검색 결과 수 (속도 최적화를 위해 서버 내부적으로 상한 제어 가능) |

#### Response Schema (`BarrierFreeSearchResponse`)
```json
{
  "places": [
    {
      "contentId": "250364",
      "contentTypeId": "12",
      "title": "남산서울타워",
      "addr1": "서울특별시 용산구 남산공원길 105",
      "mapX": 126.9882,
      "mapY": 37.5512,
      "distance": 1580
    }
  ]
}
```
* **`places`**: `list[BarrierFreePlace]`의 형태로 여러 개가 반환됩니다.
##### `BarrierFreePlace` 개별 필드
| 필드명 | 타입 | 설명 |
| :--- | :--- | :--- |
| `contentId` | `string` | 한국관광공사(KTO) 콘텐츠 ID |
| `contentTypeId`| `string \| null` | 관광 타입 코드 (예: 관광지, 숙박, 음식점 등) |
| `title` | `string` | 관광지 혹은 장소의 명칭 |
| `addr1` | `string \| null` | 기본 주소 |
| `mapX` | `float \| null` | 관광지 경도 (x) |
| `mapY` | `float \| null` | 관광지 위도 (y) |
| `distance` | `integer \| null`| 요청 중심 위치로부터의 거리 (단위: 미터) |

---

### 3. 무장애 상세 정보 조회 (Barrier-Free Detail)
* **Endpoint**: `POST /tools/barrier-free/detail`
* **설명**: 개별 무장애 관광지의 배리어프리 관련 세부 텍스트 및 정규화된 4단계 이용 가능성 상태를 조회합니다.

#### Request Schema (`BarrierFreeDetailRequest`)
```json
{
  "contentId": "250364"
}
```
| 필드명 | 타입 | 필수 여부 | 설명 |
| :--- | :--- | :---: | :--- |
| `contentId` | `string` | Y | 조회할 관광지의 KTO 콘텐츠 ID |

#### Response Schema (`BarrierFreeDetailResponse`)
```json
{
  "contentId": "250364",
  "route": "대부분 평탄한 경사로로 휠체어 진입 가능",
  "elevator": "엘리베이터가 설치되어 있어 전망대 이동 용이",
  "restroom": "장애인 전용 화장실 구분 설치됨",
  "babycar": "유모차 대여소 보유",
  "normalized": {
    "routeStatus": "가능",
    "elevatorStatus": "가능",
    "restroomStatus": "가능",
    "babycarStatus": "가능"
  },
  "evidence": {
    "route": "대부분 평탄한 경사로로 휠체어 진입 가능",
    "elevator": "엘리베이터가 설치되어 있어 전망대 이동 용이",
    "restroom": "장애인 전용 화장실 구분 설치됨",
    "babycar": "유모차 대여소 보유"
  }
}
```
##### `BarrierFreeDetailResponse` 주요 필드
| 필드명 | 타입 | 설명 |
| :--- | :--- | :--- |
| `contentId` | `string` | 요청된 콘텐츠 ID |
| `route` | `string \| null` | 보행로 편의 정보 원본 설명문 |
| `elevator` | `string \| null` | 엘리베이터 편의 정보 원본 설명문 |
| `restroom` | `string \| null` | 장애인 화장실 편의 정보 원본 설명문 |
| `babycar` | `string \| null` | 유모차 이용/대여 편의 정보 원본 설명문 |
| `normalized` | `BarrierFreeNormalized`| 원본 설명을 기반으로 정규화된 4단계 상태 구조체 |
| `evidence` | `BarrierFreeEvidence` | 정규화 판정 근거로 보관되는 원본 필드 구조체 |

##### `normalized` (`BarrierFreeNormalized`) 구조체
* **타입**: 모두 **`AccessibilityStatus`** (`"가능"`, `"제한적 가능"`, `"확인 필요"`, `"불가"`)
* `routeStatus` : 접근로/보행로 상태 판정 결과
* `elevatorStatus` : 엘리베이터 설비 상태 판정 결과
* `restroomStatus` : 장애인 화장실 설비 상태 판정 결과
* `babycarStatus` : 유모차 이용/대여 상태 판정 결과

---

### 4. 반려동물 동반 상세 정보 조회 (Pet Tour Detail)
* **Endpoint**: `POST /tools/pet-tour/detail`
* **설명**: KTO 반려동물 동반 관광 API를 통해 특정 관광지의 반려동물 허용 수준, 동반 가능 제한 조건, 규정 설명을 매칭하여 반환합니다.

#### Request Schema (`PetTourDetailRequest`)
```json
{
  "contentId": "250364",
  "title": "남산서울타워",
  "addr1": "서울특별시 용산구 남산공원길 105",
  "mapX": 126.9882,
  "mapY": 37.5512
}
```
* **매칭 우선순위**:
  1. `contentId`가 존재할 경우 우선 검색합니다.
  2. ID 조회 실패 시 `title`, `addr1`, `mapX`, `mapY`를 이용해 유사 명칭 및 지리 정보를 교차 검증하는 백업 매칭을 수행합니다.

| 필드명 | 타입 | 필수 여부 | 설명 |
| :--- | :--- | :---: | :--- |
| `contentId` | `string \| null` | 선택 | 검색 기준 관광지 콘텐츠 ID |
| `title` | `string \| null` | 선택 | 관광지 명칭 |
| `addr1` | `string \| null` | 선택 | 관광지 기본 주소 |
| `mapX` | `float \| null` | 선택 | 관광지 경도 (x) |
| `mapY` | `float \| null` | 선택 | 관광지 위도 (y) |

#### Response Schema (`PetTourDetailResponse`)
```json
{
  "contentId": "250364",
  "matchType": "contentId",
  "matchConfidence": 1.0,
  "petName": "소형견 (10kg 미만)",
  "relisMetm": "규정: 실내 공간 케이지 필수, 장소: 야외 공원 구역",
  "petAllowedStatus": "제한적 가능",
  "evidence": {
    "acmpyType": "소형견",
    "petLimit": "10kg 미만",
    "acmpyRgs": "실내 공간 케이지 필수",
    "acmpyPlace": "야외 공원 구역"
  }
}
```
##### `PetTourDetailResponse` 주요 필드
| 필드명 | 타입 | 설명 |
| :--- | :--- | :--- |
| `contentId` | `string \| null` | 매칭 완료된 최종 반려동물 콘텐츠 ID (없을 시 `null`) |
| `matchType` | `string (Literal)`| 매칭 방식 (`"contentId"`, `"name_address_coordinate"`, `"none"`) |
| `matchConfidence`| `float` | 매칭의 신뢰성 수치 (0.0 ~ 1.0) |
| `petName` | `string \| null` | 동반 가능한 반려동물 범위 텍스트 |
| `relisMetm` | `string \| null` | 관련 동반 규정 및 허용 공간에 대한 전체 설명문 |
| `petAllowedStatus`| `AccessibilityStatus`| 반려동물 동반 가능 여부 상태 (`"가능"`, `"제한적 가능"`, `"확인 필요"`, `"불가"`) |
| `evidence` | `dict[str, str \| null]`| KTO 반려동물 동반 상세 API 응답 원본 필드 맵 |

---

## 5. 무장애 적합성 채점 (Accessibility Score)
* **Endpoint**: `POST /tools/accessibility/score`
* **설명**: 사용자의 선택 조건(필수 조건)과 대상지의 상세 편의시설별 상태를 비교하여 배리어프리 점수(0~100점) 및 권장 등급을 매깁니다.

#### Request Schema (`ScoreAccessibilityRequest`)
```json
{
  "requiredConditions": ["경사로", "장애인 화장실"],
  "statuses": {
    "route": "가능",
    "elevator": "가능",
    "restroom": "제한적 가능",
    "babycar": "불가",
    "pet": "확인 필요"
  }
}
```
* **`requiredConditions`**: `list[string]` 형태로 넘길 수도 있으며, 프레임워크 호환성을 위해 `dict[string, string]` 형태로 key 목록을 추출해서 사용할 수도 있도록 양방향 지원을 합니다.
* **`statuses`**: 관광지의 각 편의시설의 정규화/원본 상태를 맵핑한 JSON 딕셔너리입니다. `route`, `elevator`, `restroom`, `babycar`, `pet` 키값을 가질 수 있습니다.

| 필드명 | 타입 | 설명 |
| :--- | :--- | :--- |
| `requiredConditions` | `list[string] \| dict[string, string]` | 사용자가 챗봇을 통해 요청한 필수 여행 조건 리스트 (예: `"경사로"`, `"장애인 화장실"`, `"반려동물 동반"`) |
| `statuses` | `dict[string, string]` | 관광지의 `route`, `elevator`, `restroom`, `babycar`, `pet` 상태값 맵 |

#### Response Schema (`ScoreAccessibilityResponse`)
```json
{
  "score": 85,
  "visitLevel": "동행 시 방문 가능",
  "riskFactors": [
    "장애인 화장실이 제한적으로 가능하여 사전에 확인이 필요합니다."
  ],
  "bestFor": [
    "휠체어 사용자",
    "유모차 이용 동반 가족"
  ],
  "excluded": false,
  "excludeReason": null
}
```
##### `ScoreAccessibilityResponse` 주요 필드
| 필드명 | 타입 | 설명 |
| :--- | :--- | :--- |
| `score` | `integer` | 최종 환산 점수 (0 ~ 100 점) |
| `visitLevel` | `VisitLevel` | 방문 권장 등급 (`"안심 방문 가능"`, `"동행 시 방문 가능"` 등) |
| `riskFactors` | `list[string]` | 주의해야 할 장애 및 이동 관련 위험/불편 요소 목록 |
| `bestFor` | `list[string]` | 해당 장소가 이동 편의상 추천하기에 가장 적절한 타겟층 목록 |
| `excluded` | `boolean` | 필수 조건의 미충족이나 위험 수치 미달 등으로 인한 추천 배제 여부 |
| `excludeReason` | `string \| null` | 추천 배제 사유 (정상일 시 `null`) |

---

## 🛠️ 연동 시 유의 사항 (Tip)

1. **에러 핸들링 (422 Unprocessable Entity)**
   * 백엔드는 Pydantic 스키마 검증이 실패할 경우, 자세한 검증 오류 사유를 `{"detail": [...], "body": "요청본"}` 포맷의 422 상태 코드로 응답하도록 커스터마이징되어 있습니다.
   * `statuses` 객체의 필드 이름은 카오스 방지를 위해 `routeStatus`가 아닌 **`route`**, `elevatorStatus`가 아닌 **`elevator`**와 같이 원본 축약된 키로 전달해야 에러가 발생하지 않습니다.
   * `requiredConditions`에 딕셔너리 값이 오더라도 오류를 내는 대신 리스트 키값으로 변환(Fallback)하는 유연성을 제공합니다.

2. **CORS 및 미들웨어 처리**
   * Ennoia AX 플랫폼과의 호환성을 위해 들어오는 JSON body 중 단일 키 `"value"`에 래핑된 하위 JSON 문자열을 자동으로 언팩하는 특수 미들웨어(`UnpackEnnoiaASGIMiddleware`)가 설정되어 있습니다. 프론트엔드에서는 일반적인 JSON 전송과 래핑된 전송 모두 동일하게 백엔드로 보낼 수 있습니다.
