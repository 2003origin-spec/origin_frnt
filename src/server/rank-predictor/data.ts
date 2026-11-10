import "server-only";

/**
 * The Rank Predictor tables (Stage 1 clean data, copied from
 * V1/percentile-predictor/data/clean/). Imported ONLY here, by server code, so
 * the tables never ship in a browser bundle (plan §6.1: not trivially scraped).
 * Updated by the yearly data PR.
 */

import jeeAdvanced from "@/lib/rank-predictor/data/jee-advanced.json";
import jeeMain from "@/lib/rank-predictor/data/jee-main.json";
import neet from "@/lib/rank-predictor/data/neet.json";
import type { RankPredictorData } from "@/lib/rank-predictor/types";

export const RANK_PREDICTOR_DATA = {
  neet,
  "jee-main": jeeMain,
  "jee-advanced": jeeAdvanced,
} as unknown as RankPredictorData;

/** The JEE Main shifts with real tables, for the form: id + dd/mm/yyyy date + shift number. */
export function rankPredictorShiftOptions(): { id: string; date: string; shift: number }[] {
  return RANK_PREDICTOR_DATA["jee-main"].years.flatMap((y) => (y.shifts ?? []).map((s) => ({ id: s.id, date: s.date, shift: s.shift })));
}
