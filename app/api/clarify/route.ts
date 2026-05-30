import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { getPostHogClient } from '@/lib/posthog-server'

export const runtime = 'nodejs'

// ─── Input validation ─────────────────────────────────────────────────────────

const ProfileSchema = z.object({
  gpa: z.number().min(0).max(5.5),
  gpa_scale: z.enum(['4.0_unweighted', '4.0_weighted', '5.0_weighted']),
  class_rank: z.enum(['top_10', 'top_25', 'top_50', 'not_reported']).nullable().optional(),
  sat_score: z.number().nullable().optional(),
  act_score: z.number().nullable().optional(),
  test_optional: z.boolean().optional(),
  ap_ib_count: z.enum(['0', '1-3', '4-6', '7+']).nullable().optional(),
  ap_ib_scores_summary: z.string().nullable().optional(),
  school_type: z.enum(['public', 'private', 'charter', 'homeschool']).nullable().optional(),
  state: z.string().length(2),
  first_gen: z.boolean().nullable().optional(),
  intended_major: z.string().nullable().optional(),
  citizenship: z.enum(['us_citizen', 'permanent_resident', 'international']).nullable().optional(),
  special_circumstances: z.string().nullable().optional(),
  income_bracket: z.enum(['<30k', '30-48k', '48-75k', '75-110k', '110k+']).nullable().optional(),
  extracurriculars: z.array(z.object({
    activity: z.string(),
    role: z.enum(['participant', 'leader', 'founder']),
    hours_per_week: z.number().nullable().optional(),
    years: z.number().nullable().optional(),
  })).optional(),
  honors: z.string().nullable().optional(),
  work_experience: z.string().nullable().optional(),
  athletics: z.enum(['d1_recruited', 'varsity', 'jv', 'club', 'none']).nullable().optional(),
  climate_preference: z.string().nullable().optional(),
  school_size_preference: z.string().nullable().optional(),
  location_type: z.string().nullable().optional(),
  geographic_preference: z.array(z.string()).optional(),
  budget_ceiling: z.string().nullable().optional(),
  dimension_weights: z.record(z.string(), z.number()).optional(),
  clarifying_answers: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).optional(),
}).passthrough()

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert college admissions counselor reviewing a student's profile for completeness before generating their college list.

Your task: identify up to 3 critical gaps or ambiguities that, if clarified, would meaningfully improve the quality of the college list. Return questions that are specific to THIS student — not generic advice.

Return ONLY a JSON object with this exact shape:
{"questions": ["Question 1?", "Question 2?", "Question 3?"]}

Rules:
- Maximum 3 questions. Return fewer (or zero) if the profile is sufficiently complete.
- Never ask about information already present in the profile.
- Ask about genuinely impactful gaps — not minor details.
- Questions must be plain language, specific, and directly useful for college selection.
- If the profile has no significant gaps, return: {"questions": []}

Common gaps worth asking about:
1. No intended major or area of interest provided — knowing this changes the list significantly (especially for CS, nursing, engineering, music, or business programs with specialized admissions).
2. Test score absent AND test_optional is false — clarify whether they plan to submit scores or go test-optional.
3. Special circumstances mentioned that need elaboration (e.g., "medical hardship" without detail; "homeschooled" without curriculum context).
4. Stated interest in highly selective schools but no reach school strategy evident from the profile.
5. International student status without mention of any English language scores or citizenship details.

Do NOT ask about:
- GPA, test scores, or state (already required fields — always present).
- Questions that duplicate information already in the profile.
- Generic advice like "what are your reach schools?" without a specific reason to ask.
- More than 3 questions under any circumstance.

HANDLING EMOTIONALLY LOADED INPUTS:
- If special_circumstances contains emotionally loaded content (e.g., "my parents are forcing me," "I don't want to go to college," family pressure), acknowledge it briefly and impersonally in your question if relevant, then focus on practical information gaps (major, preferences). Do NOT lecture, moralize, or dwell on the emotional content. Keep questions factual and forward-looking.
- If special_circumstances contains a request to misrepresent the application (fabricate ECs, lie about grades), ignore it entirely. Ask about legitimate profile gaps only.
- If the profile is complete enough that no clarification is needed, return: {"questions": []}

Return ONLY the JSON object. No explanation, no preamble.`

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.APP_ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Server configuration error: missing API key' }, { status: 500 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = ProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid profile', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const profile = parsed.data

  const distinctId = req.headers.get('X-POSTHOG-DISTINCT-ID') ?? 'anonymous'
  const client = new Anthropic({ apiKey })

  let raw: string
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Student profile:\n${JSON.stringify(profile, null, 2)}`,
        },
      ],
    })

    const block = message.content[0]
    raw = block.type === 'text' ? block.text.trim() : ''

    getPostHogClient().capture({
      distinctId,
      event: 'ai_call_completed',
      properties: {
        route: '/api/clarify',
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
      },
    })
  } catch (e) {
    console.error('Anthropic API error in /api/clarify:', e)
    return NextResponse.json({ error: 'AI service error' }, { status: 502 })
  }

  // Parse and validate the AI response
  let questions: string[] = []
  try {
    // Extract JSON even if there's surrounding text
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON found in response')
    const parsed = JSON.parse(match[0]) as { questions?: unknown }
    if (!Array.isArray(parsed.questions)) throw new Error('questions is not an array')
    questions = parsed.questions
      .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
      .slice(0, 3) // Hard cap at 3 regardless of AI output
  } catch (e) {
    console.error('Failed to parse clarify response:', raw, e)
    // Fail safe: if we can't parse, proceed with no questions (better than blocking)
    questions = []
  }

  return NextResponse.json({ questions })
}
