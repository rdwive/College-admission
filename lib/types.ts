// Shared TypeScript types for the student profile.
// Used by client-side code (ProfileContext, form pages).
// The server-side API routes additionally validate with Zod.

export interface ECEntry {
  activity: string
  role: 'participant' | 'leader' | 'founder'
  hours_per_week: number | null
  years: number | null
}

export interface DimensionWeights {
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

export interface ClarifyingAnswer {
  question: string
  answer: string
}

export interface StudentProfile {
  // Academic
  gpa: number | null
  gpa_scale: '4.0_unweighted' | '4.0_weighted' | '5.0_weighted' | null
  class_rank: 'top_10' | 'top_25' | 'top_50' | 'not_reported' | null
  sat_score: number | null
  act_score: number | null
  test_optional: boolean
  ap_ib_count: '0' | '1-3' | '4-6' | '7+' | null
  ap_ib_scores_summary: string | null

  // Background
  school_type: 'public' | 'private' | 'charter' | 'homeschool' | null
  state: string | null
  first_gen: boolean | null
  intended_major: string | null
  citizenship: 'us_citizen' | 'permanent_resident' | 'international' | null
  special_circumstances: string | null
  income_bracket: '<30k' | '30-48k' | '48-75k' | '75-110k' | '110k+' | null

  // Extracurriculars
  extracurriculars: ECEntry[]
  honors: string | null
  work_experience: string | null
  athletics: 'd1_recruited' | 'varsity' | 'jv' | 'club' | 'none' | null

  // Preferences
  climate_preference: 'warm' | 'mild' | 'cold' | 'no_preference' | null
  school_size_preference: 'small' | 'medium' | 'large' | 'no_preference' | null
  location_type: 'urban' | 'suburban' | 'rural' | 'no_preference' | null
  geographic_preference: string[]
  budget_ceiling: '<10k' | '10-25k' | '25-50k' | '50k+' | 'need_max_aid' | null

  // Dimension weights (0–100 each)
  dimension_weights: DimensionWeights

  // Clarifying answers from AI Moment A
  clarifying_answers: ClarifyingAnswer[]
}

export const DEFAULT_DIMENSION_WEIGHTS: DimensionWeights = {
  prestige: 50,
  affordability: 50,
  safety: 50,
  diversity: 50,
  career_outcomes: 50,
  campus_culture: 50,
  mental_health_support: 50,
  climate: 50,
  research_opportunities: 50,
}

export const DEFAULT_PROFILE: StudentProfile = {
  gpa: null,
  gpa_scale: null,
  class_rank: null,
  sat_score: null,
  act_score: null,
  test_optional: false,
  ap_ib_count: null,
  ap_ib_scores_summary: null,
  school_type: null,
  state: null,
  first_gen: null,
  intended_major: null,
  citizenship: null,
  special_circumstances: null,
  income_bracket: null,
  extracurriculars: [],
  honors: null,
  work_experience: null,
  athletics: null,
  climate_preference: null,
  school_size_preference: null,
  location_type: null,
  geographic_preference: [],
  budget_ceiling: null,
  dimension_weights: DEFAULT_DIMENSION_WEIGHTS,
  clarifying_answers: [],
}
