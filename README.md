## 0. 문서 목적 / 범위

### 목적

웹사이트의 “국가 선택” UI에서 **대한민국(한국)** 옵션을 자동으로:

1. 목록 상단으로 이동시키고
2. 가능하면 자동 선택하며
3. SPA/동적 렌더링 환경에서도 지속적으로 동작하도록 한다.

### 적용 범위

* 표준 HTML `<select>` 기반 국가 드롭다운
* ARIA 기반 커스텀 드롭다운(React/Vue/Headless UI 등)
* Shadow DOM 내부 컴포넌트(오픈된 shadowRoot 한정)

### 비범위(원칙)

* 로그인/결제 등 민감 흐름에서 “의도치 않은 자동 클릭”으로 문제가 생길 수 있는 사이트는 **도메인 예외 처리** 또는 “사용자 트리거 후 동작” 옵션 제공
* 캡차/봇 방지 장치 우회는 하지 않음
* 닫힌 Shadow DOM(접근 불가)은 지원 불가

---

## 1. 제품 요구사항(PRD)

### 핵심 사용자 시나리오

1. 사용자가 해외 사이트 가입/배송지 입력 시 “Country”에서 Korea를 찾기 어렵다.
2. 확장프로그램이 자동으로 Korea 항목을 상단으로 올려 즉시 보이게 한다.
3. 설정에 따라 자동으로 “Korea”까지 선택해준다(옵션).

### 기능 요구사항

* **F1. 표준 `<select>` 최적화**

  * “Korea/한국/대한민국/KR/KOR/Republic of Korea/South Korea” 매칭 옵션을 찾는다.
  * 찾으면 해당 option을 리스트 상단으로 이동한다.
  * 설정이 켜져 있으면 자동 선택 + 이벤트 디스패치로 프레임워크 상태 동기화.

* **F2. 커스텀 드롭다운(ARIA) 최적화**

  * `role="combobox"`, `role="listbox"`, `aria-haspopup="listbox"` 등으로 후보를 찾는다.
  * 열기(click/keyboard) → 리스트 항목 탐색 → 매칭 항목 클릭으로 선택 반영.

* **F3. SPA/동적 DOM 대응**

  * MutationObserver로 DOM 변경을 감지하고, debounce/queue로 과도 실행 방지.
  * 새로 추가된 노드에서 우선 탐색(전체 body 매번 스캔 최소화).

* **F4. Shadow DOM 탐색**

  * `element.shadowRoot`가 있는 오픈 Shadow DOM은 재귀적으로 탐색.

* **F5. 사용자 제어**

  * ON/OFF 토글
  * “자동 선택” ON/OFF
  * 도메인별 허용/차단 리스트(Allowlist/Blocklist)
  * 최근 동작 로그(최근 n개 URL에서 작동했는지)

### 비기능 요구사항

* 성능: 무한 루프/과도한 DOM 스캔 방지, 페이지당 CPU 점유 최소화
* 안정성: 동일 UI에 중복 처리 금지(마킹/캐시)
* 보안/프라이버시: 페이지 내용 외부 전송 금지(로컬 처리), 최소 권한

---

## 2. Manifest V3 설계

### 권한/매치

* `content_scripts.matches`: 기본은 `<all_urls>` 가능하나, 추천은:

  * 기본 allowlist 방식(사용자 설정) + 최소 범위로 시작
* Permissions(권장 최소):

  * `storage` (설정 저장)
  * `scripting` (필요 시 동적 주입, 선택)
* Host permissions:

  * `<all_urls>` 또는 사용자 설정 기반

### 구성 파일 구조(예시)

```
extension/
  manifest.json
  src/
    content/
      index.js
      detect.js
      optimizeSelect.js
      optimizeCustom.js
      shadowWalk.js
      events.js
      scheduler.js
    background/
      service_worker.js
    ui/
      options.html
      options.js
      popup.html
      popup.js
  assets/
    icon16.png ...
```

---

## 3. 설정(Options/Popup) 설계

### 설정 항목(저장: chrome.storage.sync)

* `enabled`: boolean (기본 true)
* `autoSelect`: boolean (기본 false — 안전)
* `mode`: `"safe" | "aggressive"`

  * safe: 상단 이동만(기본), 자동 클릭 최소화
  * aggressive: 자동 선택 + 커스텀UI 클릭 적극 수행
* `blocklistDomains`: string[]
* `allowlistDomains`: string[] (선택)
* `keywords`: string[] (기본 제공 + 사용자 커스텀)
* `debugLog`: boolean

### UI 요구

* popup: 빠른 토글(Enabled / AutoSelect / Mode)
* options: 도메인 관리 + 키워드 편집 + “이 사이트에서만 허용” 버튼

---

## 4. 핵심 탐지/매칭 로직

### 4.1 키워드 매칭 규칙

* 기본 키워드 집합:

  * 한국어: `한국`, `대한민국`
  * 영어: `korea`, `republic of korea`, `south korea`, `Hanguk`, `hanguk`, `Daehanminguk`
  * 코드: `kr`, `kor`, `ko-kr`, `ko_kr`
* **주의:** `North Korea`(DPRK) 오탐 방지 규칙 포함

  * `"north korea"`, `"dprk"`, `"democratic people's republic of korea"` 포함 시 제외
* 정규식 예시(개념):

  * 긍정: `/(^|\b)(republic of korea|south korea|korea|한국|대한민국|kr|kor)(\b|$)/i`
  * 부정: `/(north korea|dprk|democratic.*republic.*korea)/i`

### 4.2 “국가 선택 UI” 후보 탐색 우선순위

1. `<select>` 요소 중 name/id/class/aria-label에 `country|nation|region|shipping` 등 포함
2. 일반 `<select>` 전체(필터링 약화)
3. 커스텀 UI:

   * `[role="combobox"]`, `[role="listbox"]`, `[aria-haspopup="listbox"]`
   * class/id에 `select|dropdown|country` 포함
4. Shadow DOM 내부에도 동일 규칙 적용

---

## 5. `<select>` 처리 상세 알고리즘

### 입력

* root node(기본 document), 또는 mutation.addedNodes 기반 root들

### 단계

1. 후보 select 수집
2. 각 select에 대해:

   * options 텍스트 + value 합쳐서 매칭
   * 부정 키워드(북한) 필터
3. 매칭 option이 있으면:

   * **상단 이동:** `select.insertBefore(option, select.firstChild)`
   * **자동 선택(옵션):**

     * 기존 선택값이 이미 매칭이면 스킵
     * `select.value = option.value`
     * 아래 이벤트를 순서대로 발생(호환성):

       * `input` (가능하면)
       * `change`
     * 이벤트는 `{ bubbles: true }`
4. 중복 방지:

   * `select.dataset.countryOptimized = "1"`
   * 또는 WeakSet으로 처리한 요소 기억

### 프레임워크 동기화 보강(권장)

* React 계열에서 필요 시:

  * `const nativeSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; nativeSetter.call(select, option.value);`
  * 이후 change 이벤트

---

## 6. 커스텀 드롭다운 처리 상세 알고리즘(ARIA 기반)

### 기본 전략(안전 → 공격 순)

* Safe 모드:

  * “Korea 항목이 이미 보이는 리스트”가 있을 때만 클릭
* Aggressive 모드:

  * combobox를 열기 위한 click/keyboard 이벤트도 시도

### 단계

1. 후보 combobox/listbox 탐색
2. “열림 상태” 판단:

   * `aria-expanded="true"` or listbox DOM 존재 여부
3. 열려 있지 않으면(aggressive):

   * `element.click()` 또는 `dispatchEvent(new MouseEvent(...))`
4. 리스트 항목 탐색:

   * `[role="option"]`, `li`, `div` 등 텍스트 노드 기반
5. 항목 매칭 후 클릭:

   * `optionEl.click()` (또는 mouse events)
6. 선택 성공 검증:

   * combobox 표시 텍스트가 Korea로 바뀌었는지 확인
7. 실패 시 재시도 제한:

   * 동일 요소에 대해 N회 이상 시도 금지(예: 2회)

---

## 7. MutationObserver / 스케줄링 / 성능

### 목표

* DOM 변경이 잦은 사이트에서 **“매번 전체 문서 스캔”**을 피한다.

### 설계

* Observer: `document.body`의 `{ childList: true, subtree: true }`
* 처리 큐:

  * mutations로 들어온 `addedNodes`를 Set에 모으고
  * requestIdleCallback(가능하면) 또는 setTimeout(예: 200ms)으로 배치 처리
* Debounce:

  * 200~500ms 범위(설정 가능)
* 처리 범위:

  * 가능하면 `addedNodes` 하위만 탐색
  * 너무 작은 조각이면 부모로 확장(예: node.parentElement)

### 무한루프 방지

* 최적화로 DOM 변경이 다시 mutation을 유발할 수 있음
* 마킹(dataset/WeakSet) + “자기 작업 중 플래그” 사용:

  * `isApplying = true` 동안 observer 콜백에서 스킵하거나, queue에 넣되 중복 제거

---

## 8. Shadow DOM 처리

### 전략

* DOM traversal 시 element를 만나면:

  * `if (el.shadowRoot) walk(el.shadowRoot)`
* 주의:

  * Shadow root 내부의 select/aria도 동일하게 처리
  * 닫힌 shadow는 탐색 불가 → 로그만 남기고 종료

---

## 9. 실패/예외/안전 정책

### 안전 가드레일

* 자동 선택은 기본 OFF
* blocklist 도메인은 무조건 동작 중지
* 민감 폼 추정(로그인/카드/결제):

  * URL/path 또는 form 필드 키워드로 추정하여 safe 모드에서는 클릭 금지
  * 예: `payment`, `checkout`, `card`, `cvv` 등

### 예외 케이스

* “Korea”가 여러 개(예: South/North, Korea (Republic of), Korea, South):

  * 부정 키워드 제외 후 남은 후보 중

    * “Republic of Korea” / “South Korea” 우선
* 옵션 텍스트가 이미지/아이콘만 있는 경우:

  * value 기반 매칭 시도
* 지역/국가 혼재(Province/State):

  * select 라벨/aria-label/name에 country 관련 단서가 없으면 보수적으로 스킵(safe)

---

## 10. 로깅/디버깅

### 디버그 모드일 때만

* console.debug로:

  * 어떤 UI를 감지했는지
  * 어떤 키워드로 매칭했는지
  * 선택 성공/실패
* 개인정보 보호:

  * 폼 입력값 등 민감 데이터는 로그에 남기지 않음

---

## 11. 테스트 계획

### 단위 테스트(가능하면)

* 키워드 매칭 함수:

  * “Korea”, “South Korea”, “Republic of Korea”, “KR” ✅
  * “North Korea”, “DPRK” ❌
* select 최적화:

  * 이동 성공 / 기존 선택 유지 / 이벤트 디스패치 여부

### E2E/수동 테스트(대표 사이트 유형)

* 전통적인 서버 렌더링 HTML 폼
* React SPA + Headless UI Combobox
* 배송지 입력(국가 select) UI
* Shadow DOM 사용하는 컴포넌트(일부 쇼핑몰/디자인 시스템)

### 성능 체크

* mutation이 1초에 수십 번 발생하는 페이지에서 CPU 상승 여부
* 최적화 처리 횟수 제한 동작 여부

---

## 12. 배포/릴리즈 계획

### 크롬 웹스토어 제출 체크

* Manifest V3 준수
* 권한 최소화(특히 `<all_urls>` 필요성 설명 준비)
* 개인정보 처리방침: “데이터 외부 전송 없음” 명시

---

## 13. “개발자용 상세 스펙” 요약(한 페이지)

* Content script는 DOM 변경 감지 → 후보 UI 탐색 → Korea option 탐색 → 상단 이동/선택 → 이벤트 디스패치
* 중복 방지: dataset/WeakSet + 재시도 제한
* 모드:

  * safe: 재배치 중심, 클릭 최소
  * aggressive: 열기+선택까지 수행
* 설정: enabled/autoSelect/mode/allowlist/blocklist/keywords/debug
* Shadow DOM: 오픈 shadowRoot 재귀 탐색
* 성능: addedNodes 중심 탐색 + debounce + idle 처리

