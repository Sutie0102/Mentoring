# MedFact AI — 의약품·건강 광고 AI 팩트체커

의약품·항암제·신약·건강기능식품·다이어트약 광고(텍스트·이미지·영상·PDF·URL)에서 의학적 주장을 추출하고,
**실제로 검색된** PubMed·ClinicalTrials.gov·공공기관 자료와 비교해 4단계(진실·과장·허위·판단 불가)로 판정합니다.

> 의료 진단이나 처방을 제공하지 않습니다. 결과는 참고용입니다.

## 기술 스택

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui 스타일 컴포넌트 · Lucide React · Framer Motion · Recharts ·
Anthropic Claude API(서버 전용) · tesseract.js(브라우저 OCR) · unpdf · PubMed E-utilities · ClinicalTrials.gov API v2 · Vitest

## 빠른 시작

```bash
cd "Medicine Factchecker"
npm install
cp .env.example .env.local      # 필요한 키를 채우세요 (없어도 데모 모드로 동작)
npm run dev                     # http://localhost:3000
```

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build && npm start` | 프로덕션 빌드·실행 |
| `npm test` | 단위 테스트 (Vitest) |
| `npm run typecheck` | 타입 검사 |

## 환경 변수 (`.env.local`, 서버 전용 — 브라우저로 노출되지 않음)

| 변수 | 필수 | 용도 |
|---|---|---|
| `ANTHROPIC_API_KEY` | 권장 | 주장 추출·비전 분석·공식기관 웹 검색·검증. 없으면 **데모(규칙 기반) 모드** |
| `AI_MODEL` | 선택 | 기본 `claude-opus-5-5` |
| `NCBI_API_KEY` / `NCBI_EMAIL` | 선택 | PubMed 요청 한도 상향 (초당 3 → 10회) |
| `OPENAI_API_KEY` | 선택 | 영상 음성 전사(Whisper). 없으면 영상은 화면 문구(OCR)만 분석 |
| `RATE_LIMIT_PER_MINUTE` | 선택 | IP당 분당 분석 요청 수 (기본 8) |

> ⚠️ 셸 환경에 `ANTHROPIC_API_KEY`가 이미 설정되어 있으면 `.env.local` 없이도 AI 모드로 동작하고 API 요금이 발생합니다.
> 데모 모드로 실행하려면: `env -u ANTHROPIC_API_KEY npm run dev`

## 동작 모드

| 모드 | 조건 | 주장 추출 | 근거 검색 | 판정 |
|---|---|---|---|---|
| **AI** | API 키 있음 | Claude (원문 보존, 비전 포함) | PubMed + ClinicalTrials.gov + 공식기관 웹 검색 | Claude + 서버 안전장치 |
| **데모** | API 키 없음 | 규칙 기반 문장 분리 | PubMed + ClinicalTrials.gov (실제 검색) | 절대적 표현만 '과장', 나머지 '판단 불가' |
| **샘플** | 홈의 "샘플 결과 미리 보기" | 사전 작성 | 2026-11-15 수동 확인한 실제 출처 | 사전 작성 (명확히 표시) |

## 분석 파이프라인

1. **입력 수집** — 텍스트 / 이미지 OCR(브라우저, 줄 단위 좌표) / 영상 프레임 8장 추출 + 화면 OCR(브라우저) / 음성 전사(선택) / PDF 텍스트(스캔본은 AI 문서 판독) / URL 본문(SSRF 방어)
2. **핵심 주장 추출** — 구조화 출력(JSON 스키마) + Zod 재검증, 위험 표현은 규칙 탐지기로 이중 확인
3. **근거 검색** — PubMed(esearch → esummary → efetch 초록), ClinicalTrials.gov, 공식 도메인 한정 웹 검색(식약처·의약품안전나라·질병관리청·국립암센터·WHO·FDA·NIH 등)
4. **주장 검증** — 모델은 출처 목록의 id만 인용 가능. 서버가 후처리:
   - 출처 풀에 없는 인용 제거
   - 근거 인용 없는 TRUE/FALSE → UNVERIFIABLE
   - 근거가 세포·동물실험뿐인 TRUE → EXAGGERATED
   - 본문 발췌 없이 제목만 확인된 출처 → '참고'로만 인정
5. **결과 생성** — 주장 분류 비율(최대 잔여 방식으로 합계 100%), 위해 가중 위험도, 근거 기반 신뢰도(연구 유형 가중치)

## 보안·개인정보

- API 키는 서버에서만 사용 (`server-only`), `/api/status`는 기능 on/off만 반환
- 입력 검증: Zod 스키마, 텍스트·파일 개수·크기 제한
- 파일: 매직 바이트로 실제 형식 확인, MIME 위장 차단, 스크립트 포함 PDF 차단
- SSRF: http/https·80/443만, 사설·루프백·링크로컬·메타데이터 IP 차단, **DNS 조회 단계에서 IP 검사**(리바인딩 방어), 리다이렉트마다 재검증, 2MB·8초 제한
- 요청 제한: IP별 슬라이딩 윈도 (서버리스에서는 인스턴스별 — 운영 시 Upstash Redis 등 권장)
- 업로드 파일은 메모리에서만 처리 후 폐기, 로그에 광고 내용 미기록
- 분석 기록은 브라우저 localStorage에만 저장, 개별·전체 삭제 가능
- 보안 헤더: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`

## 첨부 자료 활용

- **자료 A** (`1차시_사례카드_20장.pdf`): 카드 18(신약 개발 성공 확률)·19(AI 신약 개발 트렌드)를 연결한 사례 탐색 페이지 + 카드 11·12·20.
  0.02% 등 수치는 "PDF의 주장"으로 표시하고, PubMed에서 존재를 확인한 독립 자료(Wong 외 2019, Jayatunga 외 2024)를 함께 제시합니다.
  카드 19의 "AI 발굴 후보의 임상 성공률 0.02%"는 카드 18의 일반 신약 수치를 옮긴 것으로 보여 '부분 확인·주의'로 표시했습니다.
- **자료 B** (`Balanced CSV - Sheet1.pdf`, 40문장, label 0/1 각 20): 사례 탐색 → "데이터셋 실험" 탭에서 규칙 기반 기준선 분류기의
  정확도·정밀도·재현율·혼동 행렬을 보여줍니다. label은 원 작성자의 분류값이며, 4단계 판정과 동일시하지 않습니다.

## 테스트

```bash
npm test
```

통계(비율 합계 100, 위해 가중치), 판정 안전장치, SSRF(사설 IP·우회 표기), 파일 시그니처, 요청 제한, 위험 표현 규칙,
연구 유형 분류, 구조화 출력 스키마, HTML/PDF 텍스트 처리, 샘플 결과 무결성 등 72개 테스트.

수동 확인 시나리오:
1. 홈 → "샘플 결과 미리 보기" → 초록·노랑·빨강 3개 카드, 도넛·막대, 위험도 '높음'
2. 예시 문구 클릭 → 분석 시작 → 단계별 진행 표시 → 결과
3. 이미지 첨부 → OCR 상자가 이미지 위에 표시되는지 확인
4. URL에 `http://127.0.0.1` 입력 → 차단 메시지
5. 분석 기록 → 검색·삭제

## GitHub 업로드

이 폴더는 상위 폴더(`2026 동아사이언스 AI동행 멘토링`)의 Git 저장소 안에 있습니다. 두 가지 방법 중 하나를 고르세요.

**A. 기존 저장소에 함께 커밋**
```bash
cd "/Users/minseokim/Desktop/2026 동아사이언스 AI동행 멘토링"
git add "Medicine Factchecker"
git commit -m "Add MedFact AI"
git push
```

**B. 별도 저장소로 분리 (Vercel 배포에 권장)**
```bash
cd "Medicine Factchecker"
git init && git add . && git commit -m "Initial commit: MedFact AI"
gh repo create medfact-ai --private --source=. --push   # 또는 GitHub에서 저장소 생성 후 git remote add origin ... && git push -u origin main
```
`.env.local`은 `.gitignore`에 포함되어 업로드되지 않습니다. 커밋 전 `git status`로 키 파일이 없는지 확인하세요.

## Vercel 배포

1. [vercel.com](https://vercel.com) → **Add New… → Project** → GitHub 저장소 선택
2. 방법 A로 올렸다면 **Root Directory**를 `Medicine Factchecker`로 지정
3. Framework Preset: Next.js (자동 감지), Build Command `npm run build`
4. **Settings → Environment Variables**에 `ANTHROPIC_API_KEY` 등 추가 (Production·Preview)
5. Deploy

배포 시 참고:
- 서버로 보내는 파일 합계는 4MB로 제한되어 있습니다(Vercel 요청 본문 한도 4.5MB). 영상은 브라우저에서 프레임만 추출하므로 큰 영상도 분석 가능하지만, **음성 전사**는 영상 파일 자체를 올려야 해서 Vercel에서는 약 4MB 이하 영상만 가능합니다.
- `/api/analyze`는 `maxDuration = 300`초로 설정되어 있습니다. AI 분석은 보통 1~3분 걸립니다. 플랜의 함수 최대 실행 시간을 확인하세요.
- 요청 제한은 인스턴스별 메모리 방식입니다. 공개 서비스라면 Upstash Redis 기반으로 교체하세요.

## 아직 구현되지 않은 기능

- Supabase 연동(서버 측 기록 저장·파일 저장) — 현재는 개인정보 최소화를 위해 브라우저 저장만 사용
- 식약처 공공데이터 API(의약품 허가정보) 직접 연동 — 현재는 공식 도메인 웹 검색으로 대체
- 서버 측 영상 처리(ffmpeg) 및 장면 전환 기반 키프레임 선택 — 현재는 균등 간격 8프레임
- 분산 요청 제한(Redis), 사용자 계정·공유 링크
- 학습 기반 분류기 — 데이터셋 B는 규칙 기준선 평가에만 사용
