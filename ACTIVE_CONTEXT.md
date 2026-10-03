# SeedFit 활성 개발 컨텍스트 (ACTIVE_CONTEXT.md)

> 💡 **멀티 디바이스 인계 가이드 (Context Handoff)**  
> 다른 컴퓨터나 새 대화 세션에서 작업을 이어받을 때, **이 문서를 가장 먼저 확인**하면 이전 작업의 모든 맥락, 인프라 세팅, 결제/보안 상태, 다음 작업 목표를 0초 만에 완벽하게 복원할 수 있습니다.

---

## 1. 프로젝트 기본 정보
- **프로젝트 명**: 시드핏 (SeedFit - 시드 & 투자 자금 관리 공식 웹앱)
- **최신 앱 버전**: `v1.8.1`
- **공식 서비스 도메인**: [https://seedfit.pro/](https://seedfit.pro/)
- **GitHub 저장소**: `ArchistJJ/SeedFit` (`main` 브랜치 기준)
- **호스팅 플랫폼**: GitHub Pages (Custom Domain `seedfit.pro`, CNAME 연동)
- **HTTPS 보안 상태**: Let's Encrypt 정식 TLS 인증서 발급 완료 (`seedfit.pro`, `www.seedfit.pro`), `https_enforced: true` (보안 접속 강제 활성화)

---

## 2. 도메인 및 DNS 설정 (Hosting.kr)
- **호스팅케이알 공식 네임서버(`ns1.hosting.co.kr`) 및 통신사 전파 완료 (5개 레코드)**:
  - **A 레코드 4개**: `@` $\rightarrow$ `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (TTL 180)
  - **CNAME 레코드 1개**: `www` $\rightarrow$ `archistjj.github.io` (TTL 180)
- **통신사 검증**: KT, SKT, LGU+, Google(8.8.8.8), Cloudflare(1.1.1.1) 전 서버 정상 IP 반환 확인 완료.

---

## 3. 정기구독 결제 시스템 (Lemon Squeezy)
- **스토어 심사 상태**:
  - 신청 완료 (Application received), 2FA 활성화, 은행 계좌 연결 완료.
  - 심사관 우선 승인을 위한 상세 영문 회신(Expedite Reply) 발송 완료.
- **등록된 공식 구독 상품**:
  - **상품명**: `SeedFit Pro`
  - **가격 / 주기**: **`$7.77 / month`** (월간 정기구독)
  - **세금 카테고리**: `Software as a service (SaaS) - personal use`
  - **상태**: `✓ Published` (발행 완료)
  - **공식 결제 링크**: `https://seedfit.lemonsqueezy.com/checkout/buy/1ae381b5-3605-427c-b11d-dbac560468f8`
- **앱 내 결제 UI 연동 (v1.7.2 ~ v1.7.3)**:
  - 설정(Settings) 탭에 Apple HIG 스타일의 **`SEEDFIT PRO` 멤버십 카드** 신설.
  - **`subscriptionModal`**: 월 $7.77 가격 및 4대 핵심 혜택(클라우드 실시간 동기화, 교차분석 매트릭스, 뇌동·추격 투자 방어 멘탈 가드, 무제한 챌린지 프로젝트) 안내.
  - **로그인 사용자 자동 주입**: 결제 클릭 시 로그인 계정의 `email`, `name`, `custom[user_id]` 파라미터를 결제창 URL에 자동 동기화하여 이메일 재입력 없이 원클릭 결제 지원.
  - Lemon Squeezy 공식 In-App Overlay 라이브러리(`lemon.js`) 연동.

---

## 4. 클라우드 데이터베이스 및 백엔드 보안 (Supabase)
- **데이터베이스 URL**: `https://qeuiqvisuscvkgjvqxpe.supabase.co`
- **테이블**: `seedfit_user_data`
- **PostgreSQL Row Level Security (RLS) 보안 잠금 구축 (v1.7.1)**:
  - `anon` 사용자의 `DELETE` 권한 전면 박탈 $\rightarrow$ 외부 악의적 데이터베이스 삭제 공격 원천 차단.
  - `SELECT`, `INSERT`, `UPDATE`는 오직 클라이언트가 전달한 단일 세션 키(`x-seedfit-user`)와 레코드의 `user_id`가 일치할 때만 인가.
  - 외부에서 `SELECT *` 덤프 공격 시 빈 배열 `[]`만 반환되어 사용자 정보 유출 0건.
  - **8개 시나리오 보안 자동화 테스트 100% 통과 확인**.

---

## 5. 소셜 로그인 설정 (Kakao & Google)
- **카카오 개발자 콘솔 (Kakao Developers)**:
  - JavaScript SDK 도메인: `https://seedfit.pro`, `https://www.seedfit.pro`, `https://archistjj.github.io`
  - Redirect URI: `https://seedfit.pro/`, `https://www.seedfit.pro/`, `https://archistjj.github.io/j-app/`
- **구글 클라우드 콘솔 (Google Cloud Console)**:
  - 승인된 JavaScript 원본: `https://seedfit.pro`, `https://www.seedfit.pro`, `https://archistjj.github.io`
  - 승인된 Redirect URI: `https://seedfit.pro/`, `https://seedfit.pro`, `https://www.seedfit.pro/`, `https://archistjj.github.io/j-app/`

---

## 6. 로컬 1급 보안 파일 격리 (.gitignore 준수)
- 파일명: `AUTH_CREDENTIALS_LOCAL.md` (로컬 PC 전용 보관 문서)
- 보관 항목:
  1. 구글 OAuth 클라이언트 ID & 클라이언트 보안 비밀번호 (`GOCSPX-...`)
  2. 카카오 JavaScript 키
  3. Supabase DB 마스터 비밀번호 및 Anon Key
  4. **Lemon Squeezy 2단계 인증(2FA) 비상 백업 코드 8개**
- `.gitignore`에 등록되어 GitHub 커밋 및 푸시가 100% 원천 차단됨.

---

## 7. 최근 해결된 주요 UI/UX 이슈
1. **v1.8.0 마스터 관리자 권한 체계 & 결제·구독 비즈니스 대시보드(관리 탭) 구축**:
   - 관리자 계정 감지 시 모든 Pro 기능(통계·분석 탭 무제한, 프로젝트 무제한 생성, 멘탈 가드 커스텀 등) 100% 영구 무료 프리패스 부여 (`isUserPro() === true` 자동 보장).
   - 관리자 활성화 시 하단 탭 바에 5번째 탭 `[관리]`가 즉시 동적 노출되며, 일반/게스트 사용자에게는 완벽히 숨김 처리.
   - 비즈니스 대시보드: 현재 구독수, 총 가입수, 가입 후 구독 전환율(%), 매달 발생하는 구독료(MRR, ₩9,900원 기준), 최근 6개월 월별 가입/구독 변동 막대 차트 및 상세 통계 테이블 탑재.
   - 실시간 회원 및 구독자 관리: Supabase `seedfit_user_data` 실시간 쿼리, 관리자 원클릭 플랜 승격/해지(`Free` ↔ `Pro`), 실제 DB 모드 ↔ 데모 시뮬레이션 모드 토글 지원.
2. **v1.7.9 새 프로젝트 생성 후 상세 화면 진입 대신 프로젝트 목록 뷰 유지 및 토스트 안내**:
   - 신규 프로젝트 생성 후 강제로 상세 화면으로 진입하지 않고 `selectedProjectId = null`을 유지하여, 생성된 프로젝트 카드가 포함된 전체 목록 화면에 머무르도록 UX 개선 및 성공 토스트 알림 추가.
2. **v1.7.8 프로젝트 목록 및 상세 화면 내 프로젝트 삭제 기능 구현**:
   - `window.deleteProject(projectId)` 로직 탑재: 삭제 전 안전 확인 다이얼로그(`confirm`) 제공 및 프로젝트에 포함된 투자 기록은 일반 기록으로 안전 보존(`r.projectId = null`)하여 데이터 무손실 보장.
   - 프로젝트 목록 카드 우측 상단에 미니멀한 휴지통 삭제 버튼 배치 (`event.stopPropagation()`).
   - 프로젝트 상세 화면 상단 잔고 카드 위에도 '프로젝트 삭제' 버튼 배치로 열람 중 즉시 삭제 지원.
2. **v1.7.7 멘탈 가드 연패 기준 커스텀 및 통계·분석 Pro 전용화 & 프로젝트 추가 구독 가드 고도화**:
   - **멘탈 가드 연패 기준 커스텀**: 사용자가 2/3/4/5연패를 직접 선택할 수 있는 버튼 그룹 탑재 및 하단 자동 감지 조건 설명이 `• ${cnt}회 연속 미적중(${cnt}연패) 발생 시`로 실시간 동적 변경되도록 연동. 실제 연패 판정 로직과 모달 알림에도 반영.
   - **통계·분석 탭 전면 Pro 전용화**: 무료 사용자는 기록이 통계에 반영되지 않고 기본 화면(0원/0%)으로 유지되며, 일별/월별 선택 버튼 위에 '프로 버전을 구독해야 이용이 가능합니다' 안내 배너와 `[PRO 구독하기 →]` 버튼 탑재. 기간/날짜/필터 조작 시에도 Pro 모달 가드 연동.
   - **프로젝트 무료 1개 제한 및 구독 안내**: 무료 사용자는 1개 프로젝트만 이용 가능하며, 추가 생성 시도 시 모달 상단에 `프로 플랜을 구독해야 추가 프로젝트를 생성할 수 있습니다.` 동적 배너와 구독 버튼을 명확히 제공.
2. **v1.7.6 로그인 모달 소개 문구 줄바꿈 가독성 개선**:
   - 로그인 모달 상단의 서비스 소개 문구("체계적인 시드 자금 관리와 감정 제어로 자산을 안전하게 성장시키세요.")에서 마지막 어절 끝 글자('요.')만 다음 줄로 떨어지는 Widow/Orphan 현상을 해결하기 위해 `break-keep` 클래스 적용 및 의미 단위 자연스러운 2줄 개행(`체계적인 시드 자금 관리와 감정 제어로<br>자산을 안전하게 성장시키세요.`) 적용.
2. **v1.7.5 유료 구독 시스템에 맞춘 Pro 4대 핵심 기능 잠금 및 가드(Paywall) 구현**:
   - **무제한 챌린지 프로젝트 가드**: 무료 사용자는 1개 프로젝트까지 운영 가능하며, 2개 이상 추가 생성 시도시 Pro 업그레이드 모달 안내 및 차단.
   - **카테고리별 정밀 교차분석 매트릭스 잠금**: 3×3 교차분석 테이블에 블러 효과 및 Glassmorphism Pro 잠금 오버레이(`SEEDFIT PRO 전용`) 탑재, 클릭 시 Pro 구독 모달 오픈. 셀 터치 필터링에도 Pro 가드 연동.
   - **뇌동·추격 투자 방어 멘탈 가드 & 쿨다운 잠금**: 멘탈 알림 토글, 쿨다운 세션 시작 시 Pro 멤버십 가드 적용. 설정 탭 멘탈 카드에 `PRO` 뱃지 및 토글 연동.
   - **실시간 클라우드 자동 동기화 차별화**: Pro 사용자에게만 백그라운드 클라우드 전송 허용. 설정 탭 프로필 카드에서 무료 사용자는 `로컬 보존 모드 (클라우드 Pro)` 및 `[Pro 연동]` 유도 버튼 제공.
2. **v1.7.4 프로 구독 오류 해결, 이모티콘 전면 배제 및 레몬스퀴즈 결제창 뷰포트 최적화**:
   - **구독 상태 임의 변경 결함 원천 해결**: '구독 상태 새로고침' 버튼에 연결되어 있던 위험한 데모용 토글 함수(`toggleProStatusForDemo`)를 전면 영구 삭제. '다음에 하기'와 분리하고, Supabase `seedfit_user_data`의 `subscription_tier`를 실제로 확인하는 정직한 `refreshSubscriptionStatus()`로 교체.
   - **로그아웃 및 동기화 보안 보강**: `logoutSeedFit` 시 `SEEDFIT_IS_PRO`를 즉시 `false`로 리셋하고, `syncFromCloud`에서 클라우드 구독 티어를 정직하게 동기화.
   - **구독 관련 이모티콘 전면 배제**: `subscriptionModal` 및 설정 탭 `SEEDFIT PRO` 멤버십 카드의 모든 이모티콘(👑, ☁️, 📊, 🛡️, 🎯, ✨)을 전면 제거하고 세련된 미니멀 인디케이터로 정돈.
   - **레몬스퀴즈 결제창 가독성 및 닫기 버튼 뷰포트 최적화**: 결제 URL에 `media=0`, `logo=0`, `desc=0`, `discount=0`, `dark` 파라미터를 추가하여 불필요한 거대 썸네일/로고/설명을 배제하고 카드 결제 폼이 한눈에 쏙 들어오도록 콤팩트화. `.lemonsqueezy-overlay`에 safe-area 여백 및 모달 팝업 CSS를 강제 적용하여 모바일 상단 노치에 닫기(X) 버튼이 가려지지 않고 손쉽게 탭할 수 있도록 완벽 개선.
3. **v1.7.3 하단 탭 네비게이션 바 소실 복구**:
   - `mentalCareModal` 마크업의 내부 닫는 태그 누락으로 `bottomTabBar`가 모달 내부로 중첩 파싱되어 숨겨지던 결함 완벽 해결 (DOM `div` 열림/닫힘 326개 1:1 완벽 일치).
4. **v1.6.0 ~ v1.6.4 통계 탭 고도화**:
   - 일별/월별/년별 커스텀 날짜 선택기 및 네비게이터 장착.
   - '카테고리별 교차분석' 이모티콘 제거 및 셀 경계선 겹침 보정.
   - 투자 기록 0건 시 기본 평균 투자금 0원 정상화 및 Division by Zero 원천 방어.
5. **전역 규칙 준수**:
   - 금지 단어('스마트', '베팅', '배팅') 100% 배제 및 **'투자'** 일원화.
   - 유저 대면 UI에 내부 개발 도구 명칭 노출 금지.

---

## 8. 다음 작업 로드맵 (Next Action Items)
1. **레몬스퀴즈(Lemon Squeezy) 스토어 최종 승인 확인**:
   - 심사 완료 이메일 수신 시 라이브 모드 결제 테스트.
2. **구독 결제 자동 권한 부여 (Webhook 연동)**:
   - Lemon Squeezy 웹훅을 Supabase Edge Function과 연결하여 결제 발생 시 `seedfit_user_data`의 `subscription_tier: 'pro'` 자동 승격 처리 구축.
