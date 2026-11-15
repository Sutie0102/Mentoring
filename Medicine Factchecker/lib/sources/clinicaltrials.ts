import "server-only";
import type { Source } from "../types";

interface CtStudy {
  protocolSection?: {
    identificationModule?: { nctId?: string; briefTitle?: string; officialTitle?: string };
    statusModule?: { overallStatus?: string; startDateStruct?: { date?: string }; lastUpdatePostDateStruct?: { date?: string } };
    sponsorCollaboratorsModule?: { leadSponsor?: { name?: string } };
    designModule?: { studyType?: string; phases?: string[]; enrollmentInfo?: { count?: number } };
    conditionsModule?: { conditions?: string[] };
    armsInterventionsModule?: { interventions?: { name?: string; type?: string }[] };
    descriptionModule?: { briefSummary?: string };
  };
  hasResults?: boolean;
}

const STATUS_KO: Record<string, string> = {
  RECRUITING: "모집 중",
  COMPLETED: "완료",
  ACTIVE_NOT_RECRUITING: "진행 중(모집 종료)",
  NOT_YET_RECRUITING: "모집 전",
  TERMINATED: "조기 종료",
  WITHDRAWN: "철회",
  SUSPENDED: "중단",
  UNKNOWN: "상태 미상",
};

export async function searchClinicalTrials(query: string, pageSize = 3): Promise<Source[]> {
  const url = `https://clinicaltrials.gov/api/v2/studies?format=json&pageSize=${pageSize}&query.term=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000), cache: "no-store", headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`ClinicalTrials.gov HTTP ${res.status}`);
  const data = (await res.json()) as { studies?: CtStudy[] };
  const out: Source[] = [];
  for (const s of data.studies ?? []) {
    const p = s.protocolSection;
    const nct = p?.identificationModule?.nctId;
    if (!nct) continue;
    const status = p?.statusModule?.overallStatus ?? "UNKNOWN";
    const phases = (p?.designModule?.phases ?? []).filter((x) => x !== "NA").join(", ") || "해당 없음";
    const interventions = (p?.armsInterventionsModule?.interventions ?? []).map((i) => i.name).filter(Boolean).join(", ");
    const snippet = [
      `상태: ${STATUS_KO[status] ?? status}`,
      `단계: ${phases}`,
      `연구 유형: ${p?.designModule?.studyType ?? "미상"}`,
      p?.designModule?.enrollmentInfo?.count ? `대상자 수: ${p.designModule.enrollmentInfo.count}` : null,
      `대상 질환: ${(p?.conditionsModule?.conditions ?? []).join(", ") || "미상"}`,
      interventions ? `중재: ${interventions}` : null,
      `결과 게시 여부: ${s.hasResults ? "예" : "아니오"}`,
      p?.descriptionModule?.briefSummary ? `요약: ${p.descriptionModule.briefSummary.slice(0, 900)}` : null,
    ]
      .filter(Boolean)
      .join(" | ");
    out.push({
      id: `ctgov:${nct}`,
      provider: "clinicaltrials",
      title: p?.identificationModule?.briefTitle ?? nct,
      publisher: `ClinicalTrials.gov · ${p?.sponsorCollaboratorsModule?.leadSponsor?.name ?? "후원기관 미상"}`,
      date: p?.statusModule?.lastUpdatePostDateStruct?.date ?? p?.statusModule?.startDateStruct?.date ?? null,
      url: `https://clinicaltrials.gov/study/${nct}`,
      studyType: "trial_registry",
      studyTypeBasis: "ClinicalTrials.gov 등록 정보 (결과 입증 자료 아님)",
      snippet,
    });
  }
  return out;
}
