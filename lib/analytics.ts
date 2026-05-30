'use client'

/**
 * analytics.ts — PostHog event wrappers.
 *
 * All 9 observability events from PRD Section 9.
 * Safe to call when PostHog key is not set — events are silently dropped.
 *
 * Usage: import { track } from '@/lib/analytics'
 *        track.intakeStepCompleted(2)
 */

import posthog from 'posthog-js'

function capture(event: string, props?: Record<string, unknown>) {
  try {
    // posthog.capture() is a no-op until posthog.init() has been called
    posthog.capture(event, props)
  } catch {
    // Never let analytics errors surface to users
  }
}

export const track = {
  /** PRD §9 #1 — Intake form section completion */
  intakeStepCompleted(step: 1 | 2 | 3 | 4) {
    capture('intake_step_completed', { step })
  },

  /** PRD §9 #2 — Clarifying questions triggered */
  clarifyQuestionsTriggered(count: number) {
    capture('clarify_questions_triggered', { count })
  },

  /** PRD §9 #3 — List generation latency */
  listGenerationCompleted(latencyMs: number, schoolCount: number) {
    capture('list_generation_completed', { latency_ms: latencyMs, school_count: schoolCount })
  },

  /** PRD §9 #4 — User action after list generation */
  listAction(action: 'adjusted_weights' | 'clicked_deep_dive' | 'abandoned') {
    capture('list_action', { action })
  },

  /** PRD §9 #5 — Slider interaction (dimension moved, direction, magnitude) */
  sliderMoved(dimension: string, oldValue: number, newValue: number) {
    capture('slider_moved', {
      dimension,
      old_value:  oldValue,
      new_value:  newValue,
      direction:  newValue > oldValue ? 'up' : 'down',
      delta:      Math.abs(newValue - oldValue),
    })
  },

  /** PRD §9 #6 — Deep dive clicked (with tier context) */
  deepDiveOpened(schoolName: string, tier: 'reach' | 'target' | 'likely') {
    capture('deep_dive_opened', { school_name: schoolName, tier })
  },

  /** PRD §9 #7 — AI call completed (tokens in + out, for cost tracking) */
  aiCallCompleted(route: string, inputTokens: number, outputTokens: number) {
    capture('ai_call_completed', { route, input_tokens: inputTokens, output_tokens: outputTokens })
  },

  /** PRD §9 #8 — Data coverage snapshot (fires once after list loads) */
  dataCoverageLogged(totalSchools: number, fullDataSchools: number) {
    capture('data_coverage_logged', {
      total_schools:     totalSchools,
      full_data_schools: fullDataSchools,
      coverage_pct:      Math.round((fullDataSchools / totalSchools) * 100),
    })
  },

  /** PRD §9 #9 — User flags data as incorrect */
  dataFlagged(schoolName: string, dimension: string) {
    capture('data_flagged', { school_name: schoolName, dimension })
  },

  clarifyAnswersSubmitted(questionCount: number, answeredCount: number) {
    capture('clarify_answers_submitted', { question_count: questionCount, answered_count: answeredCount })
  },

  clarifySkipped() {
    capture('clarify_skipped')
  },

  schoolSaved(schoolName: string, tier: string) {
    capture('school_saved', { school_name: schoolName, tier })
  },

  schoolUnsaved(schoolName: string, tier: string) {
    capture('school_unsaved', { school_name: schoolName, tier })
  },

  strategyBriefCompleted(schoolName: string, tier: string) {
    capture('strategy_brief_completed', { school_name: schoolName, tier })
  },
}
