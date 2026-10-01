# SeedFit 활성 개발 컨텍스트 (ACTIVE_CONTEXT.md)

> 💡 **멀티 디바이스 인계 가이드 (Context Handoff)**  
> 다른 컴퓨터나 새 대화 세션에서 작업을 이어받을 때, **이 문서를 가장 먼저 확인**하면 이전 작업의 모든 맥락, 인프라 세팅, 결제/보안 상태, 다음 작업 목표를 0초 만에 완벽하게 복원할 수 있습니다.

---

## 1. 프로젝트 기본 정보
- **프로젝트 명**: 시드핏 (SeedFit - 시드 & 투자 자금 관리 공식 웹앱)
- **최신 앱 버전**: `v1.7.3`
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
1. **v1.7.3 하단 탭 네비게이션 바 소실 복구**:
   - `mentalCareModal` 마크업의 내부 닫는 태그 누락으로 `bottomTabBar`가 모달 내부로 중첩 파싱되어 숨겨지던 결함 완벽 해결 (DOM `div` 열림/닫힘 327개 1:1 완벽 일치).
2. **v1.6.0 ~ v1.6.4 통계 탭 고도화**:
   - 일별/월별/년별 커스텀 날짜 선택기 및 네비게이터 장착.
   - '카테고리별 교차분석' 이모티콘 제거 및 셀 경계선 겹침 보정.
   - 투자 기록 0건 시 기본 평균 투자금 0원 정상화 및 Division by Zero 원천 방어.
3. **전역 규칙 준수**:
   - 금지 단어('스마트', '베팅', '배팅') 100% 배제 및 **'투자'** 일원화.
   - 유저 대면 UI에 내부 개발 도구 명칭 노출 금지.

---

## 8. 다음 작업 로드맵 (Next Action Items)
1. **레몬스퀴즈(Lemon Squeezy) 스토어 최종 승인 확인**:
   - 심사 완료 이메일 수신 시 라이브 모드 결제 테스트.
2. **구독 결제 자동 권한 부여 (Webhook 연동)**:
   - Lemon Squeezy 웹훅을 Supabase Edge Function과 연결하여 결제 발생 시 `seedfit_user_data`의 `subscription_tier: 'pro'` 자동 승격 처리 구축.
