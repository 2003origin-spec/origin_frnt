/**
 * Home (dashboard) entry to the Rank Predictor — the links, as plain data so
 * the flag rules can be unit-tested (tests/unit/rank-predictor/home-section.test.ts).
 *
 * Why it is on home: a visitor gets 2 free checks a day on the landing page.
 * After login there is no limit, so the signed-in home has to offer the way
 * back in; before this the only entries were Explore, the Tests hub and a
 * full-length mock's result page.
 *
 * Flags follow the pages themselves: /rank-predictor needs `rankPredictor`,
 * /rank-predictor/colleges needs `rankPredictor` AND `collegeCounselling`.
 */

export type RankPredictorHomeLink = {
  id: "predictor" | "colleges";
  href: "/rank-predictor" | "/rank-predictor/colleges";
  title: string;
  blurb: string;
};

export function rankPredictorHomeLinks(flags: { rankPredictor: boolean; collegeCounselling: boolean }): RankPredictorHomeLink[] {
  if (!flags.rankPredictor) return [];
  const links: RankPredictorHomeLink[] = [
    {
      id: "predictor",
      href: "/rank-predictor",
      title: "What rank would your marks get?",
      blurb: "NEET, JEE Main and JEE Advanced. Free, with no daily limit.",
    },
  ];
  if (flags.collegeCounselling) {
    links.push({
      id: "colleges",
      href: "/rank-predictor/colleges",
      title: "Find colleges for your rank",
      blurb: "JoSAA, CSAB, MCC and state seats, from past closing ranks.",
    });
  }
  return links;
}
