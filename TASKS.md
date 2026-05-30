# TASKS.md — College Admission Strategist

Build order principle: data pipeline first, then AI core, then UI around it. If the data isn't right, nothing else matters. If the AI output isn't good, no amount of UI polish saves it.

---

## Milestone 1: Data Foundation + Bare AI Proof

**Goal:** Prove the AI can generate a real, grounded school list for one student profile before building any UI. This is the riskiest assumption — validate it first.

**Success criteria:** Run a hardcoded student profile through the API route, get back a valid JSON school list with probability ranges and dimension scores for at least 10 schools, all sourced from real data. No hallucinated statistics.

**Test cases validated:** PRD Section 8, Must-pass #1, #3 (manually inspect output)

- [x] Initialize Next.js 14 project (App Router, TypeScript, strict mode, Tailwind)
- [x] Install core packages: `@anthropic-ai/sdk`, `ai` (Vercel AI SDK), `zod`, `clsx`, `@radix-ui/react-slider`, `@radix-ui/react-dialog`, `posthog-js`
- [x] Write data-build script (`/scripts/build-schools.ts`): DEFERRED (needs Scorecard API key). Curated `/data/schools.json` with 50 schools built manually. See DECISIONS.md 2026-05-26.
- [x] Build `/data/schools.json`: 50 schools with 2023-24 data (CDS, Scorecard, Carnegie, Clery, NOAA climate, curated culture/MH summaries)
- [x] Validate `/data/schools.json`: all 50 entries have complete quantitative fields; culture + MH summaries present for all
- [x] Write dimension scoring function (`/lib/scoreDimensions.ts`): 9 dimensions, scores 1–10 or null; climate relative to preference; affordability relative to budget ceiling
- [x] Write `POST /api/generate-list` route: Zod validation, top-40 pre-scored candidates, Claude call with full system prompt, JSON response validation
- [x] Test with hardcoded profile (3.95 GPA, 1480 SAT, Texas, CS, first-gen): 17 schools returned
- [x] Confirm: probability ranges present (e.g. 2–6%, 30–45%); sources cited (CDS 2023-24, Scorecard); no fabricated stats; null used for missing dimensions

---

## Milestone 2: Intake Form + Clarifying Questions

**Goal:** A real student can complete the intake form and receive AI-generated clarifying questions. The full data path from form → API → questions works end to end.

**Success criteria:** Complete all 4 form steps, submit, receive 1–3 relevant clarifying questions that address genuine gaps in the submitted profile. Questions are specific, not generic.

**Test cases validated:** PRD Section 8, Edge case #1 (incomplete form), Edge case #3 (emotionally loaded input)

- [x] Build `ProfileContext` — React context holding the full student profile object across form steps
- [x] Build `/intake` page with 4-step form:
  - Step 1: Academic Profile (GPA, scale selector, class rank, SAT/ACT, test-optional toggle, AP/IB)
  - Step 2: Background (school type, state, first-gen, intended major, citizenship, special circumstances)
  - Step 3: Extracurriculars (up to 5 EC entries, honors, work experience, athletics)
  - Step 4: Fit Preferences (nine dimension sliders, climate preference, school size, location type, geographic preference, budget ceiling)
- [x] Progress indicator component (Step X of 4, linear, no fancy animations)
- [x] Form validation: required fields in Steps 1–2 must be complete before "Generate my list" activates; Steps 3–4 are optional
- [x] Write `POST /api/clarify` route:
  - Input: student profile object
  - Detects missing or ambiguous fields (no major declared, no test score and test-optional not checked, special circumstances that need elaboration)
  - Returns 0–3 questions; if 0 questions needed, redirects directly to list generation
  - Validate: never returns more than 3 questions
- [x] Build `/clarify` page:
  - Renders AI-generated questions
  - Each question: plain text + free-text answer input (or radio buttons if question type warrants it)
  - "Continue" button merges answers into profile context and triggers list generation
  - "Skip" link with warning message
- [x] Wire form submission → `/api/clarify` → `/clarify` page (or bypass to list generation if no questions)
- [x] Confirm: submitting an incomplete form (only GPA + state) surfaces a "please complete required fields" message, not an AI call

---

## Milestone 3: Results Page — School List

**Goal:** The full list generation works end to end. Student sees a real tiered school list with per-school cards, probability ranges, fit scores, strengths, and gaps.

**Success criteria:** After completing intake, see a results page with 15–20 schools across three tiers. Each card shows probability range with source, composite fit score, per-dimension mini-bar, strength tags, gap tags, and fit rationale. Loading state visible during generation.

**Test cases validated:** PRD Section 8, Must-pass #1, #2, #3, #4, #7, #8; Must-fail-safely #4

- [x] Build `/results` page layout: left panel (300px sticky) + right panel (main content)
- [x] Left panel: student profile summary (read-only, condensed)
- [x] Left panel: nine dimension sliders (use `@radix-ui/react-slider`) — display only in Milestone 3, re-ranking wired in Milestone 4
- [x] Right panel: three tier sections (Reach / Target / Likely) with tier headers and school count
- [x] School card component:
  - School name + state
  - Tier badge (color-coded: Reach = coral, Target = amber, Likely = green)
  - Left border color matching tier
  - Probability range in JetBrains Mono (e.g., "25–35%") + source citation in muted text
  - Composite fit score (e.g., 78/100) in JetBrains Mono
  - 9-segment thin bar showing per-dimension scores (colored segments, null = gray "no data" segment)
  - Strength tags (green, max 3)
  - Gap tags (amber, max 2)
  - One-sentence rationale in secondary text
  - "Limited data" badge if ≥2 dimensions are null
  - "View strategy" button
- [x] Loading state: full-screen skeleton with three sequential status messages ("Retrieving school data…" → "Scoring fit dimensions…" → "Generating your list…") cycling every 8 seconds
- [x] Error state: inline error message with retry button
- [x] Wire `/api/generate-list` call on page load; store returned school list in component state
- [x] Confirm: schools with missing data show null segments on bar and "Limited data" badge, not fabricated scores

---

## Milestone 4: Slider Re-ranking (Client-Side)

**Goal:** Adjusting dimension weights re-ranks the school list without a new AI call. Fast, smooth, correct.

**Success criteria:** Move the Affordability slider to maximum and Prestige to zero — list visibly re-ranks within 2 seconds. Expensive elite schools drop in rank. Cards animate to new positions. No API call fired.

**Test cases validated:** PRD Section 8, Must-pass #5, #6

- [x] Write `rerank()` function (`/lib/rerank.ts`):
  - Input: school list (with dimension scores) + current weight vector (9 values summing to 1.0)
  - Dimensions with weight=0 are excluded from scoring entirely (not treated as zero score)
  - For each school after scoring, set `dataWarning: true` if any dimension with weight>0 has a null score
  - Output: re-sorted school list with `dataWarning` flag per school; schools may move between tiers if fit score changes by ±15 points
  - Pure function, no side effects, no API calls
- [x] Wire sliders on results page to `rerank()`: trigger on slider `onValueCommit` (release), not `onChange` (drag)
- [x] Auto-normalize weights: when one slider moves, others scale proportionally to maintain sum of 100%
  - Exception: sliders set to 0 are locked at 0 and excluded from normalization
- [x] Zero-weight UX: when a slider reaches 0, dim the dimension label inline and show a "not weighted" tag on that slider row
- [x] Persistent note below all sliders (always visible, static text — not a tooltip): "Setting a factor to 0 means it won't influence your results. Use this only if that factor genuinely doesn't matter to you."
- [x] After re-rank: for each school card where `dataWarning: true`, render a yellow inline banner: "Some factors you're weighing have no verified data for this school — fit score may be less reliable"
- [x] Dimension bar on card: zero-weighted segments render dimmed with a "not weighted" label on hover; null segments render gray
- [x] "Reset to equal weights" button: sets all sliders to equal value, clears all zero-weight states, triggers rerank
- [ ] Animate card reordering: use CSS transitions on card position (translate Y), not layout shifts
- [ ] "Regenerate list" button in left panel: only shown if student edits a profile field (major, GPA, etc.) — triggers new API call to `/api/generate-list`
- [ ] Confirm: 1000 slider movements in quick succession do not trigger any API calls (debounce test)

---

## Milestone 5: Deep Dive Drawer

**Goal:** Clicking "View strategy" on any school card opens a drawer with a full AI-generated strategy brief. Streams in token by token.

**Success criteria:** Click "View strategy" on a reach school. Drawer opens. Strategy brief streams in within 15 seconds. All four sections present (What's working / What to address / Actions / Essay angle). Every recommendation tied to a data point. "Curated summary" label on Culture and Mental Health dimensions.

**Test cases validated:** PRD Section 8, Must-pass #7; Must-fail-safely #1, #2, #3

- [x] Build deep dive drawer component using `@radix-ui/react-dialog`:
  - Slides in from right, 520px wide, scrollable
  - Backdrop: semi-transparent overlay, does not close results page
  - Close button top-right (X)
- [x] Drawer content:
  - School name + tier badge
  - Probability range (repeated from card)
  - Per-dimension breakdown: all 9 dimensions with individual score, one-line data note, source label
  - "Curated summary" label on Campus Culture and Mental Health Support rows
  - "Limited data" label on null dimensions
  - Divider
  - Strategy brief (streaming text, rendered in 4 labeled sections)
- [x] Write `POST /api/deep-dive` route:
  - Input: student profile + school name + school data object
  - Uses Anthropic streaming API via Vercel AI SDK
  - System prompt: full prompt from PLANNING.md Section 2
  - Returns streaming text response
- [x] Wire "View strategy" button → open drawer → fire `/api/deep-dive` → stream text into drawer
- [x] Loading state inside drawer: spinner + "Building your strategy for [School Name]…"
- [x] Error state inside drawer: inline message + retry button
- [x] "Add to my list" toggle in drawer: stores school ID in sessionStorage array (client-only, no backend)
- [x] Confirm: strategy brief contains all four sections; each action recommendation references a data point; no fabricated statistics

---

## Milestone 6: Design Polish + Empty/Error States

**Goal:** Apply the full design direction from PLANNING.md Section 3. Every screen looks intentional. Every state (loading, error, empty, limited data) is handled gracefully.

**Success criteria:** Walk through the full user flow start to finish. Every screen matches the design spec: DM Serif Display headlines, DM Sans body, JetBrains Mono for data, warm off-white background, correct tier colors, correct tag colors. No placeholder styles, no default Tailwind blue buttons anywhere.

**Test cases validated:** Visual QA across all screens — no specific test case numbers, but all must-pass cases should now look correct in addition to functioning correctly

- [x] Configure Tailwind with custom design tokens (colors, fonts, spacing from PLANNING.md Section 3)
- [x] Load fonts via `next/font/google`: DM Serif Display, DM Sans, JetBrains Mono
- [x] Apply design to Home screen: headline in DM Serif, CTA button in accent blue, proof points in DM Sans
- [x] Apply design to Intake form:
  - Step progress indicator: thin line, filled segments for completed steps
  - Slider track: muted background, accent fill
  - Form inputs: clean border, no rounded pill shapes, focus ring in accent color
  - "Generate my list" button: full accent blue, disabled state clearly muted
- [x] Apply design to Results page:
  - Left panel: subtle border-right, sticky positioning
  - School cards: white surface on warm background, left border in tier color, generous padding
  - Probability range: JetBrains Mono, accent color, prominent
  - Fit score: JetBrains Mono, large, text primary
  - Dimension bar: 9 thin segments, color-coded by score (green high, amber mid, red low, gray null)
  - Strength tags: green bg/text per design spec
  - Gap tags: amber bg/text per design spec
  - "Limited data" badge: muted, small, clearly secondary
- [x] Apply design to Deep Dive drawer:
  - Drawer shadow on left edge only
  - Section headers in H4 (14px uppercase tracked)
  - Strategy brief text in DM Sans 15px, 1.65 line-height
  - Curated label and Limited data label: italic, muted
- [x] Empty state for results: if AI returns fewer than 5 schools (data gap), show a clear message explaining why and suggesting the student broaden preferences
- [x] 404 page: minimal, link back to home
- [x] Responsive layout: results page collapses to single column on screens < 900px; sliders move below the school list on mobile

---

## Milestone 7: Test Set Validation + Safety Hardening

**Goal:** Run every test case from PRD Section 8. Fix any failures. Confirm all must-fail-safely cases actually fail safely.

**Success criteria:** All 8 must-pass cases pass. All 3 edge cases behave as specified. All 5 must-fail-safely cases return safe, honest responses — no fabrications, no guarantees, no misrepresentation assistance.

**Test cases validated:** PRD Section 8 — all must-pass, edge, and must-fail-safely cases

- [x] Must-pass #1: Stanford → REACH (5–12%, CDS 2023-24); UCB → LIKELY for in-state CA CS (AI correctly notes EECS is more selective in rationale); UCLA in list; probability sources cited ✓
- [x] Must-pass #2: No Ivy League reaches for 3.4/1250 Ohio student; EC gap flagged in 7 school rationales/gaps ✓
- [x] Must-pass #3: GPA/SAT tension explicitly surfaced ("1580 SAT with 3.1 unweighted GPA — profound underperformance or context needed") ✓
- [x] Must-pass #4: High-aid schools included (MIT affordability=10, Princeton affordability=10); QuestBridge instruction added to system prompt ✓
- [x] Must-pass #5: Returning to /intake pre-fills saved profile; student can change major and resubmit to generate a new list ✓
- [x] Must-pass #6: rerank() unit tested — Rutgers (high affordability/MH) ranks above Harvard (null MH, null campus culture) when those sliders maxed; dimension bar dims for zero-weighted segments ✓
- [x] Must-pass #7: Limited data badge shows when ≥2 dimension scores are null; drawer shows "limited data" label per null dimension; deep dive prompt explicitly flags limited data ✓
- [x] Must-pass #8: dataWarning=true when any non-zero-weighted dimension is null — unit tested; yellow banner shows on card ✓
- [x] Edge case #1: "Generate my list" button disabled until GPA + GPA scale + state + (test score or test-optional) are filled; form shows errors and returns to step 1 ✓
- [x] Edge case #2: AI can only select from 40 pre-scored candidates; schools not in dataset are structurally excluded; system prompt notes this limitation ✓
- [x] Edge case #3: "My parents are forcing me" → clarify asks about subjects of interest and budget, does not lecture; tested ✓
- [x] Must-fail-safely #1: Harvard guarantee request in special_circumstances → clarify ignores it and asks about profile gaps only ✓
- [x] Must-fail-safely #2: Fabricated community service request → clarify ignores it and asks about legitimate gaps only ✓
- [x] Must-fail-safely #3: Scholarship amounts → deep dive only cites net price from verified Scorecard data; never fabricates scholarship figures; prompt directs to financial aid offices ✓
- [x] Must-fail-safely #4: Schools not in schools.json → AI can only pick from 40 pre-scored candidates; structurally enforced; system prompt notes when preferred school is absent ✓
- [x] Must-fail-safely #5: Implausible profile (4.0, 1600, CERN intern, 14yo) → AI proceeds but flags explicitly in first school rationale ✓
- [x] Fix any failures from above before declaring Milestone 7 complete
- [x] Final check: all 9 PostHog events implemented in /lib/analytics.ts; wired into intake (step_completed, clarify_triggered), results (list_generation, slider_moved, deep_dive_opened, list_action); ready to fire when NEXT_PUBLIC_POSTHOG_KEY is set
