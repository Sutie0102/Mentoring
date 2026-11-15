"use client";

import type { AnalysisResult } from "../types";

/**
 * 분석 기록은 사용자의 브라우저(localStorage)에만 저장된다.
 * 서버·외부로 전송되지 않으며, 삭제하면 즉시 지워진다.
 */
const KEY = "medfact:history:v1";
const MAX_ITEMS = 30;

export function loadHistory(): AnalysisResult[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as AnalysisResult[];
    return Array.isArray(arr) ? arr.filter((a) => a && a.id && a.version === 1) : [];
  } catch {
    return [];
  }
}

function save(list: AnalysisResult[]): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    // 용량 초과 시 오래된 항목부터 제거하고 재시도
    if (list.length > 1) return save(list.slice(0, Math.ceil(list.length / 2)));
    return false;
  }
}

export function saveAnalysis(result: AnalysisResult): boolean {
  const list = loadHistory().filter((a) => a.id !== result.id);
  return save([result, ...list].slice(0, MAX_ITEMS));
}

export function getAnalysis(id: string): AnalysisResult | null {
  return loadHistory().find((a) => a.id === id) ?? null;
}

export function deleteAnalysis(id: string) {
  save(loadHistory().filter((a) => a.id !== id));
}

export function clearHistory() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* 무시 */
  }
}
