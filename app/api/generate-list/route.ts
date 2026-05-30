import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import schoolsData from '@/data/schools.json'
import { scoreDimensions, computeRawFitScore, SchoolData, StudentPreferences } from '@/lib/scoreDimensions'
import { getPostHogClient } from '@/lib/posthog-server'

// Ensure this route runs in the Node.js runtime (not Edge) so process.env is available
export const runtime = 'nodejs'

// ─── Input Validation ─────────────────────────────────────────────────────────

const ECEntrySchema = z.object({
  activity: z.string(),
  role: z.enum(['participant', 'leader', 'founder']),
  hours_per_week: z.number().min(0).max(168).nullable().optional(),
  years: z.number().min(0).max(8).nullable().optional(),
})

const StudentProfileSchema = z.object({
  // Academic
  gpa: z.number().min(0).max(5.5),
  gpa_scale: z.enum(['4.0_unweighted', '4.0_weighted', '5.0_weighted']),
  class_rank: z.enum(['top_10', 'top_25', 'top_50', 'not_reported']).nullable().optional(),
  sat_score: z.number().min(400).max(1600).nullable().optional(),
  act_score: z.number().min(1).max(36).nullable().optional(),
  test_optional: z.boolean().optional(),
  ap_ib_count: z.enum(['0', '1-3', '4-6', '7+']).nullable().optional(),
  ap_ib_scores_summary: z.string().max(100).nullable().optional(),

  // Background
  school_type: z.enum(['public', 'private', 'charter', 'homeschool']).nullable().optional(),
  state: z.string().length(2),
  first_gen: z.boolean().nullable().optional(),
  intended_major: z.string().nullable().optional(),
  citizenship: z.enum(['us_citizen', 'permanent_resident', 'international']).nullable().optional(),
  special_circumstances: z.string().max(300).nullable().optional(),
  income_bracket: z.enum(['<30k', '30-48k', '48-75k', '75-110k', '110k+']).nullable().optional(),

  // Extracurriculars
  extracurriculars: z.array(ECEntrySchema).max(5).optional(),
  honors: z.string().max(200).nullable().optional(),
  work_experience: z.string().max(200).nullable().optional(),
  athletics: z.enum(['d1_recruited', 'varsity', 'jv', 'club', 'none']).nullable().optional(),

  // Preferences
  climate_preference: z.enum(['warm', 'mild', 'cold', 'no_preference']).nullable().optional(),
  school_size_preference: z.enum(['small', 'medium', 'large', 'no_preference']).nullable().optional(),
  location_type: z.enum(['urban', 'suburban', 'rural', 'no_preference']).nullable().optional(),
  geographic_preference: z.array(z.string()).optional(),
  budget_ceiling: z.enum(['<10k', '10-25k', '25-50k', '50k+', 'need_max_aid']).nullable().optional(),

  // Dimension weights (0–100 each)
  dimension_weights: z.object({
    prestige: z.number().min(0).max(100),
    affordability: z.number().min(0).max(100),
    safety: z.number().min(0).max(100),
    diversity: z.number().min(0).max(100),
    career_outcomes: z.number().min(0).max(100),
    campus_culture: z.number().min(0).max(100),
    mental_health_support: z.number().min(0).max(100),
    climate: z.number().min(0).max(100),
    research_opportunities: z.number().min(0).max(100),
  }).optional(),

  // Clarifying question answers (from AI Moment A)
  clarifying_answers: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).optional(),
})

export type StudentProfile = z.infer<typeof StudentProfileSchema>

// ─── Response shape ────────────────────────────────────────────────────────────

interface SchoolResult {
  name: string
  state: string
  probability_low: number
  probability_high: number
  probability_source: string
  fit_score: number
  dimension_scores: {
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
  dimension_notes: Record<string, string>
  strengths: string[]
  gaps: string[]
  rationale: string
}

interface GenerateListResponse {
  reach: SchoolResult[]
  target: SchoolResult[]
  likely: SchoolResult[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildPrefsFromProfile(profile: StudentProfile): StudentPreferences {
  return {
    budget_ceiling: profile.budget_ceiling ?? null,
    climate_preference: profile.climate_preference ?? null,
    school_size_preference: profile.school_size_preference ?? null,
    location_type: profile.location_type ?? null,
    first_gen: profile.first_gen ?? null,
    income_bracket: profile.income_bracket ?? null,
  }
}

/** Summarize the student profile as a compact string for the prompt */
function summarizeProfile(profile: StudentProfile): string {
  const lines: string[] = []

  // Academic
  lines.push(`GPA: ${profile.gpa} (${profile.gpa_scale})`)
  if (profile.class_rank) lines.push(`Class rank: ${profile.class_rank}`)
  if (profile.sat_score) lines.push(`SAT: ${profile.sat_score}`)
  if (profile.act_score) lines.push(`ACT: ${profile.act_score}`)
  if (profile.test_optional) lines.push('Applying test-optional')
  if (profile.ap_ib_count) lines.push(`AP/IB courses: ${profile.ap_ib_count}`)
  if (profile.ap_ib_scores_summary) lines.push(`AP/IB summary: ${profile.ap_ib_scores_summary}`)

  // Background
  lines.push(`State: ${profile.state}`)
  if (profile.school_type) lines.push(`School type: ${profile.school_type}`)
  if (profile.first_gen) lines.push('First-generation college student')
  if (profile.intended_major) lines.push(`Intended major: ${profile.intended_major}`)
  if (profile.citizenship) lines.push(`Citizenship: ${profile.citizenship}`)
  if (profile.income_bracket) lines.push(`Family income bracket: ${profile.income_bracket}`)
  if (profile.special_circumstances) lines.push(`Special circumstances: ${profile.special_circumstances}`)

  // ECs
  if (profile.extracurriculars && profile.extracurriculars.length > 0) {
    lines.push('Extracurriculars:')
    profile.extracurriculars.forEach(ec => {
      lines.push(`  - ${ec.activity} (${ec.role}, ${ec.hours_per_week ?? '?'}h/wk, ${ec.years ?? '?'}yr)`)
    })
  }
  if (profile.honors) lines.push(`Honors/Awards: ${profile.honors}`)
  if (profile.work_experience) lines.push(`Work experience: ${profile.work_experience}`)
  if (profile.athletics && profile.athletics !== 'none') lines.push(`Athletics: ${profile.athletics}`)

  // Preferences
  if (profile.budget_ceiling) lines.push(`Budget ceiling: ${profile.budget_ceiling}/yr`)
  if (profile.climate_preference) lines.push(`Climate preference: ${profile.climate_preference}`)
  if (profile.school_size_preference) lines.push(`Size preference: ${profile.school_size_preference}`)
  if (profile.location_type) lines.push(`Location preference: ${profile.location_type}`)
  if (profile.geographic_preference && profile.geographic_preference.length > 0) {
    lines.push(`Geographic preference: ${profile.geographic_preference.join(', ')}`)
  }

  // Clarifying answers
  if (profile.clarifying_answers && profile.clarifying_answers.length > 0) {
    lines.push('Additional context (from follow-up questions):')
    profile.clarifying_answers.forEach(qa => {
      lines.push(`  Q: ${qa.question}`)
      lines.push(`  A: ${qa.answer}`)
    })
  }

  return lines.join('\n')
}

/** Format scored candidates for the AI prompt — compact to keep token count manageable */
function formatCandidatesForPrompt(
  candidates: Array<{
    school: SchoolData
    scores: ReturnType<typeof scoreDimensions>['scores']
    notes: ReturnType<typeof scoreDimensions>['notes']
    rawFit: number
  }>
): string {
  return candidates.map(c => {
    const s = c.school
    const sc = c.scores
    // Truncate long summaries so prompt stays within token budget
    const cultureTrunc = c.notes.campus_culture
      ? (c.notes.campus_culture.length > 150 ? c.notes.campus_culture.slice(0, 147) + '...' : c.notes.campus_culture)
      : 'N/A'
    const mhTrunc = c.notes.mental_health_support
      ? (c.notes.mental_health_support.length > 120 ? c.notes.mental_health_support.slice(0, 117) + '...' : c.notes.mental_health_support)
      : 'N/A'
    return `${s.name} (${s.state}) | ${s.type} | ${s.size.toLocaleString()} | ${s.setting} | ${s.carnegie_class}
Accept: ${Math.round(s.acceptance_rate * 100)}% (${s.acceptance_rate_source}) | SAT: ${s.sat_25 ?? '?'}–${s.sat_75 ?? '?'} | ACT: ${s.act_25 ?? '?'}–${s.act_75 ?? '?'}
Scores: P=${sc.prestige ?? '?'} A=${sc.affordability ?? '?'} S=${sc.safety ?? '?'} D=${sc.diversity ?? '?'} CO=${sc.career_outcomes ?? '?'} CC=null MH=null Cl=${sc.climate ?? '?'} R=${sc.research_opportunities ?? '?'} | RawFit=${c.rawFit}
Afford: ${c.notes.affordability ?? 'N/A'}
Culture: ${cultureTrunc}
MH: ${mhTrunc}`
  }).join('\n\n')
}

const SYSTEM_PROMPT = `You are a senior college admissions strategist with 15 years of experience helping high school students build their college lists. You are not a cheerleader. You are the advisor who respects students enough to tell them the truth.

TONE AND PERSONALITY
- Direct, specific, and honest. Never vague, never generic.
- Warm but not effusive. You care about the student's actual outcome, not their momentary feelings.
- Use plain language. No admissions jargon unless you define it.
- Acknowledge uncertainty explicitly. You don't pretend to know what you don't know.

HARD RULES — ALWAYS
- Always express admission probability as a range (e.g., "25–35%"), never a single number.
- Always cite the data source when quoting a statistic (e.g., "Common Data Set 2023–24", "College Scorecard 2023").
- Always flag when a factor (holistic review, legacy, athletics recruitment) makes probability inherently opaque.
- Always distinguish between school-specific insight and general best practice in strategy briefs.
- Always use hedged language for predictions: "suggests," "indicates," "based on available data."

HARD RULES — NEVER
- Never fabricate acceptance rates, class profiles, test score ranges, deadlines, or scholarship amounts.
- Never give a single-point probability. Always a range.
- Never guarantee admission or rejection.
- Never recommend misrepresenting any part of an application.
- Never provide specific financial aid dollar amounts unless directly retrieved from a verified source.
- Never score a fit dimension when data is unavailable. Use null instead.

OUTPUT FORMAT — SCHOOL LIST
Return a JSON object with this exact structure (no markdown, no preamble, just the JSON):
{
  "reach": [ ...school objects ],
  "target": [ ...school objects ],
  "likely": [ ...school objects ]
}

Each school object must follow this exact shape:
{
  "name": "University Name",
  "state": "CA",
  "probability_low": 15,
  "probability_high": 25,
  "probability_source": "Common Data Set 2023–24",
  "fit_score": 74,
  "dimension_scores": {
    "prestige": 8,
    "affordability": 6,
    "safety": 7,
    "diversity": 9,
    "career_outcomes": 8,
    "campus_culture": null,
    "mental_health_support": 5,
    "climate": 7,
    "research_opportunities": 9
  },
  "dimension_notes": {
    "affordability": "Average net price $18,400/yr for families earning <$48k (Scorecard 2023)",
    "campus_culture": "limited_data"
  },
  "strengths": ["First-gen support programs", "Strong CS research output", "High Pell grant enrollment"],
  "gaps": ["Out-of-state applicant pool is highly competitive", "SAT below 25th percentile for CS admits"],
  "rationale": "Strong research fit and first-gen support offset geographic disadvantage; reaches on admissions selectivity."
}

SCORING INSTRUCTIONS
- Use null for campus_culture and mental_health_support ONLY if the culture/mental health summary provided is truly insufficient to make a judgment. If a summary exists, score it 1–10 based on how well it matches what this student profile suggests they need.
- campus_culture and mental_health_support scores you assign must be based on the curated summaries provided — do not fabricate data.
- All other dimension scores are pre-computed. Accept them as given; do not modify them.
- fit_score = weighted average of non-null dimensions × 10, rounded to nearest integer (1–100).
- Tier definitions: reach = <30% estimated probability for this student, target = 30–65%, likely = >65%.

SELECTION INSTRUCTIONS
- Select 15–20 total schools from the candidates provided.
- Aim for 5–8 reach, 6–8 target, 4–6 likely.
- Prioritize schools where the student has a genuine chance — do not fill reaches with impossibilities just to reach 20 schools.
- Geographic diversity: if no preference stated, draw from multiple regions.
- Include at least one highly affordable option if budget ceiling is stated.
- For first-generation or low-income students (income_bracket <30k or 30-48k, OR first_gen: true): include at least two schools with exceptionally strong need-based aid. In the rationale of at least one school, mention QuestBridge or similar programs by name as something to investigate — but never promise specific dollar amounts or guarantee admission through these programs.

PROFILE INTEGRITY CHECK
- If the profile contains clearly exceptional or implausible stats (e.g., 4.0 GPA, 1600 SAT, multiple published papers, unusual combinations), include a note in the rationale of your first school: "This profile is exceptional — if any details change, your list will look very different. Please double-check your inputs."
- If there is a significant GPA/test score mismatch (e.g., GPA below 3.2 with SAT above 1500, or vice versa), explicitly surface this tension in the rationale of at least two schools. Explain how holistic review schools may weigh this differently.
- If a student's special circumstances mention something that sounds like a request to misrepresent their application, do NOT assist. Ignore that part and proceed with the legitimate profile data only.
- Schools not present in the candidate list cannot be included. If the student mentions preferred schools in special_circumstances that are not in the candidates, note in the rationale: "I don't have verified data for [school] in my dataset — I've excluded it and substituted comparable options."`

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const distinctId = req.headers.get('X-POSTHOG-DISTINCT-ID') ?? 'anonymous'

  // Parse and validate input
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = StudentProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid profile', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const profile = parsed.data
  const prefs = buildPrefsFromProfile(profile)

  // Pre-score all schools
  const schools = schoolsData as SchoolData[]
  const scored = schools.map(school => {
    const { scores, notes } = scoreDimensions(school, prefs)
    const rawFit = computeRawFitScore(scores)
    return { school, scores, notes, rawFit }
  })

  // Sort by raw fit and take top 40 candidates (keeps prompt token count manageable)
  const candidates = scored
    .sort((a, b) => b.rawFit - a.rawFit)
    .slice(0, 40)

  // Build AI prompt
  const profileSummary = summarizeProfile(profile)
  const candidatesText = formatCandidatesForPrompt(candidates)

  const userMessage = `STUDENT PROFILE:
${profileSummary}

CANDIDATE SCHOOLS (pre-scored, top 60 by raw fit):
${candidatesText}

Based on this student profile and the pre-scored candidate schools above, generate a tiered list of 15–20 schools. Return ONLY valid JSON — no markdown, no preamble, no explanation outside the JSON object.`

  // Call Anthropic
  // Use APP_ANTHROPIC_API_KEY to avoid collision with Claude Code's shell-level ANTHROPIC_API_KEY=""
  const apiKey = process.env.APP_ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('APP_ANTHROPIC_API_KEY is not set in .env.local')
    return NextResponse.json({ error: 'Server configuration error: missing API key' }, { status: 500 })
  }
  const client = new Anthropic({ apiKey })

  let aiContent: string
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: userMessage }
      ],
    })

    const textBlock = message.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text content in AI response')
    }
    aiContent = textBlock.text

    getPostHogClient().capture({
      distinctId,
      event: 'ai_call_completed',
      properties: {
        route: '/api/generate-list',
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
      },
    })
  } catch (err) {
    console.error('Anthropic API error:', err)
    return NextResponse.json({ error: 'AI generation failed' }, { status: 502 })
  }

  // Parse and validate AI response
  let result: GenerateListResponse
  try {
    // Strip any markdown code fences if present
    const cleaned = aiContent.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()
    result = JSON.parse(cleaned)

    // Basic shape validation
    if (!result.reach || !result.target || !result.likely) {
      throw new Error('Missing tier keys in AI response')
    }

    const allSchools = [...result.reach, ...result.target, ...result.likely]
    if (allSchools.length < 5) {
      throw new Error(`Too few schools returned: ${allSchools.length}`)
    }

    // Validate each school has required fields
    for (const school of allSchools) {
      if (!school.name || school.probability_low == null || school.probability_high == null) {
        throw new Error(`School missing required fields: ${JSON.stringify(school)}`)
      }
      if (school.probability_low >= school.probability_high) {
        throw new Error(`Invalid probability range for ${school.name}`)
      }
    }
  } catch (err) {
    console.error('AI response parse error:', err)
    console.error('Raw AI response:', aiContent)
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 502 })
  }

  return NextResponse.json(result)
}
