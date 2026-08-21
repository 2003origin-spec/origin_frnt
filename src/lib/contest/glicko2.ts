/**
 * ORBIT rating — Glicko-2 (plan Phase 7, locked V1 model). Pure, no I/O.
 *
 * A contest is one rating period. To stay O(N) at 1M players (a round-robin is
 * O(N²)), each player plays ONE virtual game against the FIELD: opponent rating
 * = the field's mean, and the score = the player's percentile (rank 1 → ~1.0,
 * last → ~0.0). This is the standard "outcome = standing vs the field" reduction
 * the plan calls for.
 *
 * Constants are locked V1 defaults (configurable later): seed rating 1000, RD
 * 350, volatility 0.06, system τ 0.5. The internal Glicko-2 scale is centered on
 * the seed rating (the 173.7178 factor = 400/ln(10) is unchanged; only the
 * center shifts from the chess default 1500 to our 1000). Provisional is DERIVED
 * from a high RD (not a stored flag).
 */

export const ORBIT_DEFAULT_RATING = 1000;
export const ORBIT_DEFAULT_RD = 350;
export const ORBIT_DEFAULT_VOLATILITY = 0.06;
export const ORBIT_TAU = 0.5;
const SCALE = 173.7178; // 400 / ln(10)

/** RD at/above which a rating is still provisional (not yet "established").
 *  Tuned so a player becomes established after ~2–3 contests (RD falls from the
 *  350 seed to ~200 over three periods), matching the PRD's provisional window. */
export const ORBIT_PROVISIONAL_RD = 210;

/** Below this field size, cap the per-contest rating swing (small-field guard). */
export const SMALL_FIELD_THRESHOLD = 10;
export const SMALL_FIELD_MAX_SWING = 80;

export interface Glicko2State {
  rating: number;
  rd: number;
  volatility: number;
}

export interface ContestOutcome {
  /** Mean rating of the field (the virtual opponent's rating). */
  fieldMeanRating: number;
  /** Mean RD of the field (the virtual opponent's RD). */
  fieldMeanRd: number;
  /** Player's score for the period, 0..1 (their percentile / 100). */
  score: number;
  /** Field size, for the small-field guardrail. */
  fieldSize: number;
}

function toGlicko2(state: Glicko2State): { mu: number; phi: number; sigma: number } {
  return {
    mu: (state.rating - ORBIT_DEFAULT_RATING) / SCALE,
    phi: state.rd / SCALE,
    sigma: state.volatility,
  };
}

function fromGlicko2(mu: number, phi: number, sigma: number): Glicko2State {
  return {
    rating: ORBIT_DEFAULT_RATING + SCALE * mu,
    rd: SCALE * phi,
    volatility: sigma,
  };
}

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function expectedScore(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

/** Solve for the new volatility σ' via Glickman's Illinois-algorithm. */
function newVolatility(phi: number, sigma: number, v: number, delta: number): number {
  const a = Math.log(sigma * sigma);
  const tau = ORBIT_TAU;
  const f = (x: number): number => {
    const ex = Math.exp(x);
    const num = ex * (delta * delta - phi * phi - v - ex);
    const den = 2 * (phi * phi + v + ex) * (phi * phi + v + ex);
    return num / den - (x - a) / (tau * tau);
  };

  let A = a;
  let B: number;
  const d2 = delta * delta;
  const phi2v = phi * phi + v;
  if (d2 > phi2v) {
    B = Math.log(d2 - phi2v);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) k += 1;
    B = a - k * tau;
  }

  let fA = f(A);
  let fB = f(B);
  let iter = 0;
  while (Math.abs(B - A) > 1e-6 && iter < 100) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }
    B = C;
    fB = fC;
    iter += 1;
  }
  return Math.exp(A / 2);
}

/**
 * Apply one contest (as a single virtual game vs the field) to a player's
 * rating. Returns the new state. A no-op guardrail is the caller's job (a
 * no-show doesn't call this). Applies the small-field swing cap.
 */
export function applyContest(state: Glicko2State, outcome: ContestOutcome): Glicko2State {
  const { mu, phi, sigma } = toGlicko2(state);
  const opp = toGlicko2({ rating: outcome.fieldMeanRating, rd: outcome.fieldMeanRd, volatility: sigma });

  const gPhiJ = g(opp.phi);
  const E = expectedScore(mu, opp.mu, opp.phi);
  const v = 1 / (gPhiJ * gPhiJ * E * (1 - E));
  const delta = v * gPhiJ * (outcome.score - E);

  const sigmaPrime = newVolatility(phi, sigma, v, delta);
  const phiStar = Math.sqrt(phi * phi + sigmaPrime * sigmaPrime);
  const phiPrime = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muPrime = mu + phiPrime * phiPrime * gPhiJ * (outcome.score - E);

  let next = fromGlicko2(muPrime, phiPrime, sigmaPrime);

  // Small-field guardrail: with a tiny field, cap how far the rating can move in
  // one contest so a 3-person event can't produce wild swings.
  if (outcome.fieldSize < SMALL_FIELD_THRESHOLD) {
    const swing = next.rating - state.rating;
    if (Math.abs(swing) > SMALL_FIELD_MAX_SWING) {
      next = { ...next, rating: state.rating + Math.sign(swing) * SMALL_FIELD_MAX_SWING };
    }
  }

  // RD never exceeds the seed (an idle player's uncertainty is bounded).
  next.rd = Math.min(next.rd, ORBIT_DEFAULT_RD);
  return next;
}

/** A first-ever rating. */
export function seedRating(): Glicko2State {
  return {
    rating: ORBIT_DEFAULT_RATING,
    rd: ORBIT_DEFAULT_RD,
    volatility: ORBIT_DEFAULT_VOLATILITY,
  };
}

/** Provisional until the rating deviation drops below the threshold. */
export function isProvisional(rd: number): boolean {
  return rd > ORBIT_PROVISIONAL_RD;
}

/** The 8 ORBIT tiers (thresholds configurable later). */
export const ORBIT_TIERS: Array<[number, string]> = [
  [0, "Explorer"],
  [800, "Challenger"],
  [1000, "Contender"],
  [1200, "Advanced"],
  [1400, "Expert"],
  [1600, "Elite"],
  [1800, "Master"],
  [2000, "Origin Legend"],
];

export function orbitTier(rating: number): string {
  let name = ORBIT_TIERS[0][1];
  for (const [threshold, tier] of ORBIT_TIERS) {
    if (rating >= threshold) name = tier;
  }
  return name;
}
