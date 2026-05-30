<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into College Admission Strategist. Here is a summary of every change made.

## Infrastructure changes

| File | Change |
|---|---|
| `instrumentation-client.ts` | **Created** — initializes PostHog once on module load (Next.js 15.3+ pattern), with `capture_exceptions: true` for automatic error tracking |
| `app/PostHogProvider.tsx` | **Updated** — removed duplicate `posthog.init()` from `useEffect`; now just wraps app in `<PHProvider>` React context |
| `next.config.mjs` | **Updated** — added `/ingest` reverse proxy rewrites so all PostHog traffic is routed through your own domain (improves ad-blocker bypass and privacy) |
| `lib/posthog-server.ts` | **Created** — singleton `posthog-node` client for server-side event capture in API routes |
| `.env.local` | **Updated** — confirmed `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` are set to the correct project values |
| `package.json` | **Updated** — `posthog-node` added as a dependency |

## Events instrumented

| Event | Description | File |
|---|---|---|
| `intake_step_completed` | Fires when user advances past each form step (already existed) | `app/intake/page.tsx` |
| `clarify_questions_triggered` | Fires with question count after AI clarify call (already existed) | `app/intake/page.tsx` |
| `list_generation_completed` | Fires with latency + school count when list loads (already existed) | `app/results/page.tsx` |
| `list_action` | Fires on adjusted_weights / clicked_deep_dive (already existed) | `app/results/page.tsx` |
| `slider_moved` | Fires on each fit dimension slider commit with delta (already existed) | `app/results/page.tsx` |
| `deep_dive_opened` | Fires when user opens a school's strategy drawer (already existed) | `app/results/page.tsx` |
| `ai_call_completed` | **New (server-side)** — fires after each Anthropic API call with `input_tokens`, `output_tokens`, and `route` | `app/api/clarify/route.ts`, `app/api/generate-list/route.ts`, `app/api/deep-dive/route.ts` |
| `data_coverage_logged` | **New** — fires after list loads with total schools and how many have full dimension data | `app/results/page.tsx` |
| `clarify_answers_submitted` | **New** — fires when user submits answers to clarifying questions, with question and answer counts | `app/clarify/page.tsx` |
| `clarify_skipped` | **New** — fires when user skips clarifying questions entirely | `app/clarify/page.tsx` |
| `school_saved` | **New** — fires when user adds a school to their saved list | `app/results/page.tsx` |
| `school_unsaved` | **New** — fires when user removes a school from their saved list | `app/results/page.tsx` |
| `strategy_brief_completed` | **New** — fires when the deep dive strategy brief finishes streaming | `app/results/page.tsx` |
| `$exception` | **New** — automatic error capture via `posthog.captureException()` in key catch blocks | `app/intake/page.tsx`, `app/results/page.tsx` |

## Client–server correlation

All three API routes (`/api/clarify`, `/api/generate-list`, `/api/deep-dive`) now receive a `X-POSTHOG-DISTINCT-ID` header from the client. Server-side events use this as the `distinctId` so client and server events for the same user session are correlated in PostHog.

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics dashboard](/dashboard/1648952)
- [Core conversion funnel](/insights/c1Z9LlhE) — Intake started → List generated → Deep dive opened
- [Clarify step conversion](/insights/abHLqDn9) — Questions triggered vs. answers submitted vs. skipped
- [List generation volume and latency](/insights/FiyCFwXs) — Daily list count + average generation time
- [School engagement](/insights/v8GbvFld) — Deep dives, school saves, and strategy brief completions
- [AI token usage by route](/insights/WXUJJmHd) — Input/output token totals broken down by API route

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
