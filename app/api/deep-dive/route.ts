import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { getPostHogClient } from '@/lib/posthog-server'

export const runtime = 'nodejs'

// ─── Input validation ─────────────────────────────────────────────────────────

const DimensionScoresSchema = z.object({
  prestige:              z.number().nullable(),
  affordability:         z.number().nullable(),
  safety:                z.number().nullable(),
  diversity:             z.number().nullable(),
  career_outcomes:       z.number().nullable(),
  campus_culture:        z.number().nullable(),
  mental_health_support: z.number().nullable(),
  climate:               z.number().nullable(),
  research_opportunities:z.number().nullable(),
})

const SchoolDataSchema = z.object({
  name:              z.string(),
  state:             z.string(),
  probability_low:   z.number(),
  probability_high:  z.number(),
  probability_source:z.string(),
  fit_score:         z.number(),
  dimension_scores:  DimensionScoresSchema,
  dimension_notes:   z.record(z.string(), z.string()),
  strengths:         z.array(z.string()),
  gaps:              z.array(z.string()),
  rationale:         z.string(),
})

const RequestSchema = z.object({
  profile: z.object({
    gpa: z.number(),
    gpa_scale: z.string(),
    sat_score: z.number().nullable().optional(),
    act_score: z.number().nullable().optional(),
    test_optional: z.boolean().optional(),
    state: z.string(),
    intended_major: z.string().nullable().optional(),
    first_gen: z.boolean().nullable().optional(),
    income_bracket: z.string().nullable().optional(),
    budget_ceiling: z.string().nullable().optional(),
    extracurriculars: z.array(z.object({
      activity: z.string(),
      role: z.string(),
      hours_per_week: z.number().nullable().optional(),
      years: z.number().nullable().optional(),
    })).optional(),
    honors: z.string().nullable().optional(),
    work_experience: z.string().nullable().optional(),
    athletics: z.string().nullable().optional(),
    special_circumstances: z.string().nullable().optional(),
    clarifying_answers: z.array(z.object({
      question: z.string(),
      answer: z.string(),
    })).optional(),
  }).passthrough(),
  school: SchoolDataSchema,
  tier: z.enum(['reach', 'target', 'likely']),
})

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior college admissions strategist with 15 years of experience. You give specific, data-grounded, honest advice. You are not a cheerleader. You respect students enough to tell them the truth.

Write a strategy brief of 400–600 words for a specific student applying to a specific school. Use ONLY the data provided in the user message — do not fabricate statistics, acceptance rates, deadlines, scholarship amounts, or any other data not given to you.

Structure the brief with these FOUR labeled sections:

## What's Working
What about this student's profile genuinely aligns with what this school values? Be specific — cite actual data points (test scores vs. school ranges, GPA, ECs, first-gen status, etc.). Avoid generic statements like "strong academics."

## What to Address
What gaps or weaknesses does this student need to acknowledge honestly in the application? Be direct but constructive. If the application is competitive, say so clearly.

## Actions
2–3 specific, concrete steps this student can take to strengthen their application to this school. Each action must reference a specific data point or known feature of this school. No generic advice.

## Essay Angle
One specific, actionable essay approach for this school's supplemental essays (if they have them) or Common App essay as it relates to this school. Ground it in something specific about this school's identity, culture, or programs — reference the culture/MH summaries if relevant.

RULES:
- Every data claim must come from the data provided. Never invent.
- Use hedged language: "suggests," "based on available data," "indicates."
- Never guarantee admission or rejection.
- Never give specific scholarship dollar amounts. If asked, direct the student to the school's financial aid office and FAFSA.
- If probability is low, say so plainly and explain how the student can make the strongest possible case anyway.
- Acknowledge when factors like holistic review or legacy make probability inherently uncertain.
- Campus Culture and Mental Health Support scores are based on curated summaries, not verified metrics — note this where relevant.
- DATA COMPLETENESS: If any dimension score in the provided data shows "no data," explicitly note in the relevant section: "Note: [Dimension Name] data for this school is limited — treat any related recommendations with extra caution. Admission data for this school is limited — treat this estimate with extra caution."
- Return plain text. No markdown beyond the four ## section headers.`

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const distinctId = req.headers.get('X-POSTHOG-DISTINCT-ID') ?? 'anonymous'
  const apiKey = process.env.APP_ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response('Server configuration error: missing API key', { status: 500 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'Invalid request', details: parsed.error.flatten() }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { profile, school, tier } = parsed.data

  // Build user message with all available data
  const testScore = profile.sat_score
    ? `SAT ${profile.sat_score}`
    : profile.act_score
    ? `ACT ${profile.act_score}`
    : 'test-optional'

  const ecList = profile.extracurriculars
    ?.map(ec => `  - ${ec.activity} (${ec.role}, ${ec.hours_per_week ?? '?'}h/wk, ${ec.years ?? '?'} yr)`)
    .join('\n') ?? 'None listed'

  const clarifyingContext = profile.clarifying_answers?.length
    ? profile.clarifying_answers.map(qa => `  Q: ${qa.question}\n  A: ${qa.answer}`).join('\n')
    : 'None'

  const dimensionSummary = Object.entries(school.dimension_scores)
    .map(([k, v]) => {
      const note = school.dimension_notes[k] ?? ''
      const label = v !== null ? `${v}/10` : 'no data'
      const isQualitative = k === 'campus_culture' || k === 'mental_health_support'
      return `  ${k}: ${label}${note ? ` — ${note}` : ''}${isQualitative ? ' (curated summary)' : ''}`
    })
    .join('\n')

  const userMessage = `STUDENT PROFILE:
GPA: ${profile.gpa} (${profile.gpa_scale})
Test: ${testScore}
State: ${profile.state}
Major: ${profile.intended_major ?? 'Undecided'}
First-gen: ${profile.first_gen === true ? 'Yes' : profile.first_gen === false ? 'No' : 'Not stated'}
Income bracket: ${profile.income_bracket ?? 'Not stated'}
Budget ceiling: ${profile.budget_ceiling ?? 'Not stated'}
Extracurriculars:
${ecList}
Honors/awards: ${profile.honors ?? 'None listed'}
Work experience: ${profile.work_experience ?? 'None listed'}
Athletics: ${profile.athletics ?? 'Not stated'}
Special circumstances: ${profile.special_circumstances ?? 'None'}
Additional context:
${clarifyingContext}

SCHOOL: ${school.name} (${school.state})
Tier: ${tier}
Admission probability for this student: ${school.probability_low}–${school.probability_high}% (source: ${school.probability_source})
Fit score: ${school.fit_score}/100
Key strengths for this student: ${school.strengths.join(', ')}
Key gaps: ${school.gaps.join(', ')}
Rationale summary: ${school.rationale}

Dimension scores and notes:
${dimensionSummary}

Write the 400–600 word strategy brief for this student applying to ${school.name}.`

  const client = new Anthropic({ apiKey })

  // Stream the response using Anthropic SDK, returning a plain-text ReadableStream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let inputTokens = 0
      let outputTokens = 0
      try {
        const anthropicStream = await client.messages.stream({
          model: 'claude-sonnet-4-5',
          max_tokens: 2000,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage }],
        })

        for await (const event of anthropicStream) {
          if (event.type === 'message_start') {
            inputTokens = event.message.usage.input_tokens
          }
          if (event.type === 'message_delta') {
            outputTokens = event.usage.output_tokens
          }
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }

        getPostHogClient().capture({
          distinctId,
          event: 'ai_call_completed',
          properties: {
            route: '/api/deep-dive',
            input_tokens: inputTokens,
            output_tokens: outputTokens,
          },
        })
      } catch (e) {
        controller.error(e)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
