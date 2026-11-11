/**
 * Browser calls for the college finder (signed-in only, plan §7.3). apiCall
 * adds the CSRF header and refreshes an expired session once.
 */

import { apiCall } from '@/lib/api';
import type { ChanceBand, CounsellingBody, CounsellingExam, CounsellingResultRow, CounsellingSearchInput, InstituteType } from '@/lib/counselling/types';

export type BodyMeta = {
  body: CounsellingBody;
  label: string;
  note: string | null;
  years: { year: number; rounds: { round: number; label: string; isFinal: boolean }[] }[];
  sources: { publisher: string; url: string; official: boolean; fetchedOn: string | null }[];
};

export type CounsellingMeta = {
  exam: CounsellingExam;
  bodies: BodyMeta[];
  instituteTypes: InstituteType[];
  states: string[];
  checkedOn: string | null;
  disclaimer: string;
  officialLinks: { label: string; url: string }[];
};

export type SearchResponse = {
  rows: CounsellingResultRow[];
  page: number;
  pageSize: number;
  total: number;
  counts: Record<ChanceBand, number>;
  truncated: boolean;
  searched: { body: CounsellingBody; label: string; year: number }[];
  missingRanks: string[];
  notes: string[];
  disclaimer: string;
};

export function fetchMeta(exam: CounsellingExam): Promise<CounsellingMeta> {
  return apiCall(`/assessments/counselling/meta?exam=${exam}`);
}

/** Request body as the API expects it: a typed rank is a number, a predicted one a {low, high} range. */
export type SearchRequest = Omit<CounsellingSearchInput, 'ranks'> & {
  ranks: Partial<Record<keyof CounsellingSearchInput['ranks'], number | { low: number; high: number }>>;
};

export function searchColleges(body: SearchRequest): Promise<SearchResponse> {
  return apiCall('/assessments/counselling/search', { method: 'POST', body: JSON.stringify(body) });
}
