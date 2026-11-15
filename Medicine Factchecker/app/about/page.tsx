import type { Metadata } from "next";
import { STUDY_TYPE_META, VERDICT_META } from "@/lib/constants";
import { STUDY_TYPES, VERDICTS } from "@/lib/types";
import { VerdictIcon } from "@/components/verdict-icon";

export const metadata: Metadata = { title: "서비스 소개" };

const PIPELINE = [
  ["입력 수집", "텍스트, 이미지 OCR(브라우저에서 실행, 위치 정보 포함), 영상 주요 프레임 추출과 화면 문구 OCR, 선택적 음성 전사, PDF 텍스트 추출, URL 본문 추출"],
  ["핵심 주장 추출", "AI가 광고 원문을 그대로 보존한 채 의학적 주장을 분리하고 약품·성분·질병·효과·수치를 추출합니다. '100% 완치', '부작용 없음' 같은 위험 표현은 규칙 기반 탐지기로도 함께 확인합니다."],
  ["근거 검색", "PubMed(E-utilities), ClinicalTrials.gov(API v2)를 실제로 조회하고, 식약처·의약품안전나라·질병관리청·국립암센터·WHO 등 공식 도메인으로 한정한 웹 검색을 수행합니다."],
  ["주장 검증", "AI는 검색된 출처 목록 안에서만 인용할 수 있습니다. 목록에 없는 출처는 서버가 자동으로 제거하고, 근거 없이 '진실'이나 '허위'로 판정한 주장은 '판단 불가'로 보류합니다."],
  ["결과 생성", "주장 분류 비율, 위해 가중 위험도, 근거 기반 분석 신뢰도를 계산식으로 산출합니다. AI가 임의로 신뢰도 숫자를 만들지 않습니다."],
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 pt-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">서비스 소개</h1>
        <p className="mt-2 text-muted-foreground">
          MedFact AI는 의약품, 항암제, 신약, 건강기능식품, 다이어트약 광고 속 주장을 신뢰할 수 있는 의학·과학 자료와 비교해 검증하는 AI 팩트체커입니다.
        </p>
      </header>

      <section aria-labelledby="principles">
        <h2 id="principles" className="mb-3 text-xl font-semibold">핵심 원칙</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
          <li>AI의 추측만으로 진실과 허위를 확정하지 않습니다.</li>
          <li>검증 가능한 실제 출처만 제시하며, 검색되지 않은 출처를 만들어내지 않습니다.</li>
          <li>근거가 부족하면 '판단 불가'로 표시합니다.</li>
          <li>세포실험·동물실험 결과를 사람에 대한 치료 효과로 확대 해석하지 않습니다.</li>
          <li>의료 진단이나 처방을 제공하지 않습니다.</li>
        </ul>
      </section>

      <section aria-labelledby="method">
        <h2 id="method" className="mb-3 text-xl font-semibold">분석 방법</h2>
        <ol className="space-y-3">
          {PIPELINE.map(([t, d], i) => (
            <li key={t} className="flex gap-3 rounded-xl border bg-card p-4 shadow-soft">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-teal-soft text-sm font-semibold text-teal">{i + 1}</span>
              <div>
                <p className="font-medium">{t}</p>
                <p className="text-sm text-muted-foreground">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="verdicts">
        <h2 id="verdicts" className="mb-3 text-xl font-semibold">판정 기준과 수치의 의미</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {VERDICTS.map((v) => (
            <li key={v} className="flex items-start gap-2 rounded-xl border bg-card p-3 text-sm">
              <VerdictIcon verdict={v} className={`mt-0.5 size-4 shrink-0 ${VERDICT_META[v].tw.text}`} />
              <span>
                <strong>{VERDICT_META[v].label}</strong> — {VERDICT_META[v].description}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-2 text-sm leading-relaxed">
          <p>
            <strong>주장 분류 비율</strong>은 추출된 주장 개수 중 각 판정이 차지하는 비율입니다. 광고가 진실일 확률이 아닙니다. 합계가 정확히 100%가 되도록 최대 잔여 방식으로 반올림합니다.
          </p>
          <p>
            <strong>종합 위험도</strong>는 판정된 주장에 위해 가능성 가중치(낮음 1 · 중간 2 · 높음 3)를 곱해 계산합니다. 허위 1점, 과장 0.5점이며, 위해 가능성이 높은 허위 주장이 하나라도 있으면 '높음'입니다. 판정 가능한 주장이 없으면 '판단 보류'입니다.
          </p>
          <p>
            <strong>분석 신뢰도</strong>는 판정에 인용된 실제 출처의 연구 유형과 개수로만 계산합니다. 근거가 없거나 데모 모드이면 '낮음'으로 표시됩니다.
          </p>
        </div>
      </section>

      <section aria-labelledby="levels">
        <h2 id="levels" className="mb-3 text-xl font-semibold">근거 수준 (연구 유형)</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-2 pr-2 font-medium">연구 유형</th>
              <th className="py-2 pr-2 font-medium">가중치</th>
              <th className="py-2 font-medium">해석 시 주의</th>
            </tr>
          </thead>
          <tbody>
            {STUDY_TYPES.map((t) => (
              <tr key={t} className="border-t align-top">
                <td className="py-2 pr-2">{STUDY_TYPE_META[t].label}</td>
                <td className="py-2 pr-2 tabular-nums">{STUDY_TYPE_META[t].weight}</td>
                <td className="py-2 text-muted-foreground">{STUDY_TYPE_META[t].caution ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted-foreground">연구 유형은 PubMed 출판 유형과 제목·초록 키워드로 자동 분류하므로 오분류가 있을 수 있습니다. 각 출처 카드에 분류 근거를 표시합니다.</p>
      </section>

      <section aria-labelledby="limits">
        <h2 id="limits" className="mb-3 text-xl font-semibold">한계</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
          <li>검색 결과에 관련 연구가 없으면 사실인 주장도 '판단 불가'가 될 수 있습니다.</li>
          <li>PubMed 검색은 주로 영어 문헌이며, 상위 일부 결과만 검토합니다.</li>
          <li>OCR과 음성 전사는 오인식이 있을 수 있습니다. 추출된 원문을 함께 확인하세요.</li>
          <li>영상은 일정 간격의 프레임만 분석하므로 짧게 지나가는 문구를 놓칠 수 있습니다.</li>
          <li>식약처 의약품 허가 정보는 공식 웹 검색으로만 확인하며, 공공데이터 API와 직접 연동되어 있지 않습니다.</li>
          <li>AI는 실수할 수 있습니다. 중요한 결정은 반드시 의사·약사와 상담하세요.</li>
        </ul>
      </section>

      <section id="privacy" aria-labelledby="privacy-title" className="scroll-mt-24">
        <h2 id="privacy-title" className="mb-3 text-xl font-semibold">개인정보 처리 안내</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
          <li>회원가입이 없으며 이름·연락처 등 개인정보를 수집하지 않습니다.</li>
          <li>업로드한 파일은 분석하는 동안 서버 메모리에서만 처리되고 디스크·데이터베이스에 저장되지 않습니다.</li>
          <li>영상 원본은 서버로 전송하지 않습니다. 브라우저에서 추출한 일부 프레임만 전송합니다. 음성 전사 기능을 켠 경우에만 영상 파일이 전사 서비스(OpenAI)로 전송됩니다.</li>
          <li>이미지 OCR은 사용자의 브라우저에서 실행됩니다.</li>
          <li>분석 내용은 AI 분석(Anthropic Claude)과 근거 검색(PubMed, ClinicalTrials.gov)에 필요한 범위에서만 외부 API로 전송됩니다. 검색에는 광고에서 추출한 검색어만 사용합니다.</li>
          <li>서버 로그에는 광고 내용이나 의료정보를 남기지 않고 오류 종류만 기록합니다.</li>
          <li>분석 기록은 사용자의 브라우저(localStorage)에만 저장되며, 분석 기록 페이지에서 언제든 개별 또는 전체 삭제할 수 있습니다.</li>
          <li>사용자 동의 없이 분석 자료를 공개하거나 모델 학습에 사용하지 않습니다.</li>
        </ul>
      </section>
    </div>
  );
}
