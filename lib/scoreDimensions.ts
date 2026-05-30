/**
 * scoreDimensions.ts
 *
 * Scores all nine fit dimensions for a given school + student profile.
 * Returns scores 1–10, or null where data is unavailable.
 * Climate score is relative to student preference, not absolute.
 * Affordability score is relative to student's budget ceiling.
 */

export interface SchoolData {
  id: string
  name: string
  state: string
  type: 'public' | 'private'
  size: number
  setting: 'urban' | 'suburban' | 'rural'
  carnegie_class: string
  acceptance_rate: number
  acceptance_rate_source: string
  sat_25: number | null
  sat_75: number | null
  act_25: number | null
  act_75: number | null
  net_price_0_30k: number | null
  net_price_30_48k: number | null
  net_price_48_75k: number | null
  net_price_75_110k: number | null
  median_earnings_6yr: number | null
  pell_grant_pct: number | null
  graduation_rate: number | null
  student_faculty_ratio: number | null
  clery_crimes_per_1000: number | null
  us_news_rank: number | null
  climate_avg_temp_f: number | null
  culture_summary: string | null
  mental_health_summary: string | null
  culture_data_type: 'curated' | 'verified' | null
  mental_health_data_type: 'curated' | 'verified' | null
}

export interface StudentPreferences {
  budget_ceiling: '<10k' | '10-25k' | '25-50k' | '50k+' | 'need_max_aid' | null
  climate_preference: 'warm' | 'mild' | 'cold' | 'no_preference' | null
  school_size_preference: 'small' | 'medium' | 'large' | 'no_preference' | null
  location_type: 'urban' | 'suburban' | 'rural' | 'no_preference' | null
  first_gen: boolean | null
  income_bracket?: '<30k' | '30-48k' | '48-75k' | '75-110k' | '110k+' | null
}

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

export interface DimensionNotes {
  prestige?: string
  affordability?: string
  safety?: string
  diversity?: string
  career_outcomes?: string
  campus_culture?: string
  mental_health_support?: string
  climate?: string
  research_opportunities?: string
  [key: string]: string | undefined
}

/**
 * Clamps a value between 1 and 10, rounded to nearest integer.
 */
function clamp(val: number): number {
  return Math.max(1, Math.min(10, Math.round(val)))
}

/**
 * Score Prestige (1–10) based on US News rank and acceptance rate.
 * Null if both rank and acceptance rate are missing.
 */
function scorePrestige(school: SchoolData): { score: number | null; note: string | null } {
  if (school.us_news_rank === null && school.acceptance_rate === null) {
    return { score: null, note: 'limited_data' }
  }

  let score = 5 // default mid

  if (school.us_news_rank !== null) {
    if (school.us_news_rank <= 5) score = 10
    else if (school.us_news_rank <= 10) score = 9
    else if (school.us_news_rank <= 20) score = 8
    else if (school.us_news_rank <= 30) score = 7
    else if (school.us_news_rank <= 50) score = 6
    else if (school.us_news_rank <= 75) score = 5
    else if (school.us_news_rank <= 100) score = 4
    else if (school.us_news_rank <= 150) score = 3
    else score = 2
  } else if (school.acceptance_rate !== null) {
    // Fall back to acceptance rate if no rank
    if (school.acceptance_rate < 0.05) score = 10
    else if (school.acceptance_rate < 0.10) score = 8
    else if (school.acceptance_rate < 0.20) score = 6
    else if (school.acceptance_rate < 0.40) score = 4
    else score = 2
  }

  const note = school.us_news_rank
    ? `US News rank #${school.us_news_rank}; acceptance rate ${Math.round((school.acceptance_rate || 0) * 100)}% (${school.acceptance_rate_source})`
    : `Acceptance rate ${Math.round((school.acceptance_rate || 0) * 100)}% (${school.acceptance_rate_source})`

  return { score: clamp(score), note }
}

/**
 * Score Affordability (1–10) relative to student's budget and income bracket.
 * Higher score = more affordable.
 * Null if net price data is unavailable.
 */
function scoreAffordability(
  school: SchoolData,
  prefs: StudentPreferences
): { score: number | null; note: string | null } {
  // Determine which net price bracket to use
  const bracket = prefs.income_bracket

  let netPrice: number | null = null
  let bracketLabel = ''

  if (bracket === '<30k' && school.net_price_0_30k !== null) {
    netPrice = school.net_price_0_30k
    bracketLabel = 'families earning <$30k'
  } else if (bracket === '30-48k' && school.net_price_30_48k !== null) {
    netPrice = school.net_price_30_48k
    bracketLabel = 'families earning $30–48k'
  } else if (bracket === '48-75k' && school.net_price_48_75k !== null) {
    netPrice = school.net_price_48_75k
    bracketLabel = 'families earning $48–75k'
  } else if (bracket === '75-110k' && school.net_price_75_110k !== null) {
    netPrice = school.net_price_75_110k
    bracketLabel = 'families earning $75–110k'
  } else if (bracket === '110k+') {
    // Use sticker price proxy — no net price data for >$110k
    // Use net_price_75_110k as lower bound estimate
    netPrice = school.net_price_75_110k
    bracketLabel = 'families earning >$110k (estimated from available bracket data)'
  } else {
    // No bracket specified — use middle bracket as proxy
    netPrice = school.net_price_48_75k ?? school.net_price_30_48k ?? school.net_price_75_110k
    bracketLabel = 'mid-income families (estimated)'
  }

  if (netPrice === null) {
    return { score: null, note: 'limited_data' }
  }

  // Budget ceiling comparison
  let budgetCap: number | null = null
  if (prefs.budget_ceiling === '<10k') budgetCap = 10000
  else if (prefs.budget_ceiling === '10-25k') budgetCap = 25000
  else if (prefs.budget_ceiling === '25-50k') budgetCap = 50000
  else if (prefs.budget_ceiling === '50k+') budgetCap = 70000
  else if (prefs.budget_ceiling === 'need_max_aid') budgetCap = 5000

  let score: number
  if (budgetCap !== null) {
    // Score relative to budget cap
    const ratio = netPrice / budgetCap
    if (ratio <= 0.3) score = 10
    else if (ratio <= 0.5) score = 9
    else if (ratio <= 0.7) score = 8
    else if (ratio <= 0.9) score = 7
    else if (ratio <= 1.0) score = 6
    else if (ratio <= 1.2) score = 5
    else if (ratio <= 1.5) score = 4
    else if (ratio <= 2.0) score = 3
    else score = 1
  } else {
    // No budget specified — score on absolute net price scale
    if (netPrice < 5000) score = 10
    else if (netPrice < 10000) score = 9
    else if (netPrice < 15000) score = 8
    else if (netPrice < 20000) score = 7
    else if (netPrice < 25000) score = 6
    else if (netPrice < 35000) score = 5
    else if (netPrice < 45000) score = 4
    else if (netPrice < 55000) score = 3
    else score = 2
  }

  const note = `Average net price $${netPrice.toLocaleString()}/yr for ${bracketLabel} (College Scorecard 2023)`
  return { score: clamp(score), note }
}

/**
 * Score Safety (1–10) based on Clery Act crimes per 1000 students.
 * Higher score = safer (fewer crimes reported).
 * Null if Clery data unavailable.
 */
function scoreSafety(school: SchoolData): { score: number | null; note: string | null } {
  if (school.clery_crimes_per_1000 === null) {
    return { score: null, note: 'limited_data' }
  }

  const c = school.clery_crimes_per_1000
  let score: number
  if (c <= 0.5) score = 10
  else if (c <= 1.0) score = 9
  else if (c <= 1.5) score = 8
  else if (c <= 2.0) score = 7
  else if (c <= 2.5) score = 6
  else if (c <= 3.0) score = 5
  else if (c <= 4.0) score = 4
  else if (c <= 5.0) score = 3
  else score = 2

  const note = `${c} Clery Act reported crimes per 1,000 students (Clery Act data 2022)`
  return { score: clamp(score), note }
}

/**
 * Score Diversity (1–10) based on Pell grant % (socioeconomic proxy).
 * Null if Pell data unavailable.
 */
function scoreDiversity(school: SchoolData): { score: number | null; note: string | null } {
  if (school.pell_grant_pct === null) {
    return { score: null, note: 'limited_data' }
  }

  const p = school.pell_grant_pct
  let score: number
  if (p >= 0.40) score = 10
  else if (p >= 0.35) score = 9
  else if (p >= 0.30) score = 8
  else if (p >= 0.25) score = 7
  else if (p >= 0.20) score = 6
  else if (p >= 0.15) score = 5
  else if (p >= 0.12) score = 4
  else score = 3

  const note = `${Math.round(p * 100)}% of students receive Pell grants (College Scorecard 2023)`
  return { score: clamp(score), note }
}

/**
 * Score Career Outcomes (1–10) based on median earnings at 6 years and graduation rate.
 * Null if earnings data unavailable.
 */
function scoreCareerOutcomes(school: SchoolData): { score: number | null; note: string | null } {
  if (school.median_earnings_6yr === null) {
    return { score: null, note: 'limited_data' }
  }

  const e = school.median_earnings_6yr
  let score: number
  if (e >= 90000) score = 10
  else if (e >= 80000) score = 9
  else if (e >= 70000) score = 8
  else if (e >= 65000) score = 7
  else if (e >= 60000) score = 6
  else if (e >= 55000) score = 5
  else if (e >= 50000) score = 4
  else score = 3

  // Adjust slightly for graduation rate (proxy for degree completion)
  if (school.graduation_rate !== null) {
    if (school.graduation_rate < 0.70) score -= 1
    else if (school.graduation_rate >= 0.92) score += 1
  }

  const gradNote = school.graduation_rate
    ? `; ${Math.round(school.graduation_rate * 100)}% 6-year graduation rate (College Scorecard 2023)`
    : ''
  const note = `Median earnings $${e.toLocaleString()} at 6 years post-enrollment (College Scorecard 2023)${gradNote}`
  return { score: clamp(score), note }
}

/**
 * Score Campus Culture (1–10).
 * This dimension is curated data only — always returns score 5 (neutral) with a note
 * that full scoring is based on curated summary. The AI will interpret the culture_summary
 * in context of the student's stated preferences.
 * Null if no culture summary available.
 */
function scoreCampusCulture(school: SchoolData): { score: number | null; note: string | null } {
  if (!school.culture_summary) {
    return { score: null, note: 'limited_data' }
  }

  // We return null here intentionally — the AI will score this in context
  // of the student profile based on the culture_summary text.
  // Pre-scoring with a neutral 5 would be misleading.
  return { score: null, note: school.culture_summary }
}

/**
 * Score Mental Health Support (1–10).
 * Curated data only — returns null with summary for AI interpretation.
 * Null if no mental health summary available.
 */
function scoreMentalHealthSupport(school: SchoolData): { score: number | null; note: string | null } {
  if (!school.mental_health_summary) {
    return { score: null, note: 'limited_data' }
  }

  return { score: null, note: school.mental_health_summary }
}

/**
 * Score Climate (1–10) relative to student preference.
 * Warm preference: higher score for higher temps.
 * Cold preference: higher score for lower temps.
 * Mild: score highest in 55–65°F range.
 * No preference: always returns 7 (climate doesn't differentiate).
 * Null if climate data unavailable.
 */
function scoreClimate(
  school: SchoolData,
  prefs: StudentPreferences
): { score: number | null; note: string | null } {
  if (school.climate_avg_temp_f === null) {
    return { score: null, note: 'limited_data' }
  }

  const temp = school.climate_avg_temp_f
  const pref = prefs.climate_preference

  let score: number

  if (!pref || pref === 'no_preference') {
    score = 7
  } else if (pref === 'warm') {
    if (temp >= 70) score = 10
    else if (temp >= 65) score = 9
    else if (temp >= 60) score = 8
    else if (temp >= 55) score = 6
    else if (temp >= 50) score = 4
    else score = 2
  } else if (pref === 'cold') {
    if (temp <= 45) score = 10
    else if (temp <= 50) score = 9
    else if (temp <= 55) score = 7
    else if (temp <= 60) score = 5
    else if (temp <= 65) score = 3
    else score = 1
  } else {
    // mild: optimal around 55–65°F
    const deviation = Math.abs(temp - 60)
    if (deviation <= 5) score = 10
    else if (deviation <= 10) score = 8
    else if (deviation <= 15) score = 6
    else if (deviation <= 20) score = 4
    else score = 2
  }

  const note = `Average annual temperature ${temp}°F (NOAA climate data)`
  return { score: clamp(score), note }
}

/**
 * Score Research Opportunities (1–10) based on Carnegie classification,
 * student-faculty ratio, and school type.
 * Null if Carnegie classification unavailable.
 */
function scoreResearchOpportunities(school: SchoolData): { score: number | null; note: string | null } {
  if (!school.carnegie_class) {
    return { score: null, note: 'limited_data' }
  }

  let score = 5

  // Carnegie classification base score
  if (school.carnegie_class === 'R1') score = 9
  else if (school.carnegie_class === 'R2') score = 7
  else if (school.carnegie_class.startsWith('Bac')) score = 6 // Liberal arts colleges
  else score = 5

  // Adjust for student-faculty ratio (lower = more access)
  if (school.student_faculty_ratio !== null) {
    if (school.student_faculty_ratio <= 5) score += 1
    else if (school.student_faculty_ratio >= 20) score -= 1
  }

  // Small private schools (LACs) often have better undergrad research access despite not being R1
  if (school.size < 2500 && school.type === 'private') {
    score += 1
  }

  const sfRatioNote = school.student_faculty_ratio
    ? `; ${school.student_faculty_ratio}:1 student-faculty ratio`
    : ''
  const note = `Carnegie classification: ${school.carnegie_class}${sfRatioNote} (Carnegie Classification 2021)`
  return { score: clamp(score), note }
}

/**
 * Main scoring function. Returns dimension scores and notes for a school + student preferences.
 */
export function scoreDimensions(
  school: SchoolData,
  prefs: StudentPreferences
): { scores: DimensionScores; notes: DimensionNotes } {
  const prestige = scorePrestige(school)
  const affordability = scoreAffordability(school, prefs)
  const safety = scoreSafety(school)
  const diversity = scoreDiversity(school)
  const careerOutcomes = scoreCareerOutcomes(school)
  const campusCulture = scoreCampusCulture(school)
  const mentalHealth = scoreMentalHealthSupport(school)
  const climate = scoreClimate(school, prefs)
  const research = scoreResearchOpportunities(school)

  const scores: DimensionScores = {
    prestige: prestige.score,
    affordability: affordability.score,
    safety: safety.score,
    diversity: diversity.score,
    career_outcomes: careerOutcomes.score,
    campus_culture: campusCulture.score,
    mental_health_support: mentalHealth.score,
    climate: climate.score,
    research_opportunities: research.score,
  }

  const notes: DimensionNotes = {}
  if (prestige.note) notes.prestige = prestige.note
  if (affordability.note) notes.affordability = affordability.note
  if (safety.note) notes.safety = safety.note
  if (diversity.note) notes.diversity = diversity.note
  if (careerOutcomes.note) notes.career_outcomes = careerOutcomes.note
  if (campusCulture.note) notes.campus_culture = campusCulture.note
  if (mentalHealth.note) notes.mental_health_support = mentalHealth.note
  if (climate.note) notes.climate = climate.note
  if (research.note) notes.research_opportunities = research.note

  return { scores, notes }
}

/**
 * Compute a raw fit score (0–100) for ranking candidates.
 * Uses equal weights across all non-null dimensions.
 * Campus culture and mental health are excluded (null) at this stage —
 * the AI will handle those.
 */
export function computeRawFitScore(scores: DimensionScores): number {
  const dims = [
    scores.prestige,
    scores.affordability,
    scores.safety,
    scores.diversity,
    scores.career_outcomes,
    scores.climate,
    scores.research_opportunities,
  ]

  const nonNull = dims.filter((d): d is number => d !== null)
  if (nonNull.length === 0) return 50

  const avg = nonNull.reduce((a, b) => a + b, 0) / nonNull.length
  return Math.round((avg / 10) * 100)
}
