/**
 * rerank.ts — pure client-side re-ranking function.
 *
 * Rules (from spec):
 * - Dimensions with weight = 0 are excluded from scoring entirely (not treated as zero score).
 * - dataWarning = true when any non-zero-weighted dimension has a null score.
 * - Schools may move between tiers if fit score changes by ±15 points.
 * - No API calls, no side effects.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DimensionScores {
  prestige: number | null
  affordability: number | null
  safety: number | null
  diversity: number | null
  career_outcomes: number | null
  campus_culture: number | null
  mental_health_support: number | null
  climate: number | null
  research_opportunities: number | null
}

export type DimensionKey = keyof DimensionScores

export interface WeightVector {
  prestige: number
  affordability: number
  safety: number
  diversity: number
  career_outcomes: number
  campus_culture: number
  mental_health_support: number
  climate: number
  research_opportunities: number
}

export interface RankedSchool {
  name: string
  state: string
  probability_low: number
  probability_high: number
  probability_source: string
  fit_score: number               // original AI-assigned fit score (preserved)
  reranked_score: number          // weighted fit score from current sliders (1–100)
  dimension_scores: DimensionScores
  dimension_notes: Record<string, string>
  strengths: string[]
  gaps: string[]
  rationale: string
  dataWarning: boolean            // true if any active dimension has null score
}

export interface RerankResult {
  reach: RankedSchool[]
  target: RankedSchool[]
  likely: RankedSchool[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DIMENSION_KEYS: DimensionKey[] = [
  'prestige', 'affordability', 'safety', 'diversity', 'career_outcomes',
  'campus_culture', 'mental_health_support', 'climate', 'research_opportunities',
]

// Tier thresholds based on reranked_score (0–100)
const REACH_THRESHOLD  = 85  // >= 85 → reach (high selectivity relative to fit)
const LIKELY_THRESHOLD = 60  // <= 60 → likely

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalize weights so non-zero values sum to 100.
 * Zero-weighted dimensions stay at 0 and are excluded from the pool.
 */
export function normalizeWeights(weights: WeightVector): WeightVector {
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0)
  if (total === 0) {
    // All zero — equal weight for all (shouldn't happen in normal use)
    const eq = 100 / DIMENSION_KEYS.length
    return DIMENSION_KEYS.reduce((acc, k) => ({ ...acc, [k]: eq }), {} as WeightVector)
  }
  return DIMENSION_KEYS.reduce(
    (acc, k) => ({ ...acc, [k]: (weights[k] / total) * 100 }),
    {} as WeightVector
  )
}

/**
 * Compute a weighted fit score (1–100) for a school given current weights.
 * Dimensions with weight = 0 are excluded entirely.
 * If a non-zero-weighted dimension is null, it is excluded from scoring
 * (but dataWarning will be set).
 */
function computeWeightedScore(scores: DimensionScores, weights: WeightVector): number {
  const normalized = normalizeWeights(weights)

  let weightedSum = 0
  let activeWeight = 0

  for (const key of DIMENSION_KEYS) {
    const w = normalized[key]
    if (w === 0) continue  // excluded from scoring
    const score = scores[key]
    if (score === null) continue  // null dimension excluded from weighted avg
    weightedSum += score * w
    activeWeight += w
  }

  if (activeWeight === 0) return 50  // no active scored dimensions — neutral midpoint

  // scores are 1–10, weights sum to activeWeight portion of 100
  // Result: (weightedSum / activeWeight) gives 1–10, multiply by 10 → 1–100
  return Math.round((weightedSum / activeWeight) * 10)
}

/**
 * Determine tier based on reranked_score, with ±15 point hysteresis from original tier.
 *
 * Original tier is inferred from probability range:
 *   probability_low < 30  → reach
 *   probability_low >= 65 → likely
 *   otherwise             → target
 *
 * Schools may move tiers if reranked_score differs by ≥15 from original fit_score.
 */
function assignTier(
  school: { probability_low: number; fit_score: number; reranked_score: number },
): 'reach' | 'target' | 'likely' {
  const originalTier =
    school.probability_low < 30 ? 'reach'
    : school.probability_low >= 65 ? 'likely'
    : 'target'

  const scoreDiff = school.reranked_score - school.fit_score

  if (Math.abs(scoreDiff) < 15) return originalTier  // within hysteresis band — keep original tier

  // Score moved enough to potentially shift tier
  if (school.reranked_score >= REACH_THRESHOLD)  return 'reach'
  if (school.reranked_score <= LIKELY_THRESHOLD) return 'likely'
  return 'target'
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Rerank the school list using the given weight vector.
 *
 * @param schools - flat array of all schools (reach + target + likely combined)
 * @param weights - current slider values (0–100 each; do NOT need to be pre-normalized)
 * @returns RerankResult with schools sorted by reranked_score within each tier
 */
export function rerank(
  schools: Omit<RankedSchool, 'reranked_score' | 'dataWarning'>[],
  weights: WeightVector
): RerankResult {
  const ranked: RankedSchool[] = schools.map(school => {
    const reranked_score = computeWeightedScore(school.dimension_scores, weights)

    // dataWarning: any non-zero-weighted dimension has a null score
    const dataWarning = DIMENSION_KEYS.some(key => {
      return weights[key] > 0 && school.dimension_scores[key] === null
    })

    return { ...school, reranked_score, dataWarning }
  })

  // Assign tiers based on reranked score + probability ranges
  const result: RerankResult = { reach: [], target: [], likely: [] }
  for (const school of ranked) {
    const tier = assignTier(school)
    result[tier].push(school)
  }

  // Sort within each tier by reranked_score descending
  for (const tier of ['reach', 'target', 'likely'] as const) {
    result[tier].sort((a, b) => b.reranked_score - a.reranked_score)
  }

  return result
}

/**
 * Auto-normalize weights when one slider moves:
 * - The moved slider's new value is set exactly.
 * - All other non-zero sliders scale proportionally to maintain sum = 100.
 * - Zero-locked sliders stay at 0.
 *
 * @param current - current weight vector
 * @param changedKey - the dimension that was moved
 * @param newValue - the new value for that dimension (0–100)
 */
export function autoNormalizeWeights(
  current: WeightVector,
  changedKey: DimensionKey,
  newValue: number
): WeightVector {
  const updated = { ...current, [changedKey]: newValue }

  // Which keys can absorb the scaling? All non-zero keys except the one just moved.
  const elasticKeys = DIMENSION_KEYS.filter(k => k !== changedKey && current[k] > 0)

  const totalOthers = elasticKeys.reduce((sum, k) => sum + current[k], 0)
  const remaining = 100 - newValue

  if (elasticKeys.length === 0 || totalOthers === 0) {
    // No elastic keys to scale — just set the value and accept the imbalance
    // (UI should prevent this from happening by disabling when all others are 0)
    return updated
  }

  if (remaining <= 0) {
    // New value is 100 — all others go to 0
    for (const k of elasticKeys) updated[k] = 0
    // Also zero any other keys
    for (const k of DIMENSION_KEYS) {
      if (k !== changedKey) updated[k] = 0
    }
    updated[changedKey] = 100
    return updated
  }

  // Scale elastic keys proportionally
  const scale = remaining / totalOthers
  let runningTotal = newValue
  const elasticCopy = [...elasticKeys]

  for (let i = 0; i < elasticCopy.length; i++) {
    const k = elasticCopy[i]
    if (i === elasticCopy.length - 1) {
      // Last key absorbs rounding error
      updated[k] = Math.max(0, 100 - runningTotal)
    } else {
      const scaled = Math.round(current[k] * scale)
      updated[k] = scaled
      runningTotal += scaled
    }
  }

  return updated
}
