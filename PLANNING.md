# PLANNING.md — College Admission Strategist

---

## 1. Screens and Navigation

### Screen 1 — Home
**Path:** `/`

**What's on it:**
- Headline: "Find the right colleges. Know exactly why."
- Subheadline: one sentence explaining the product value (data-grounded, honest, personalized)
- Single CTA button: "Build my college list"
- Three supporting proof points below the fold (e.g., "Grounded in verified data," "Honest about uncertainty," "Strategy, not just scores")
- Minimal footer: about link, data sources disclosure

**Does NOT include:**
- Navigation bar with multiple links
- Login / signup prompt
- School search bar
- Any school rankings or previews
- Testimonials or social proof (v1)
- Pricing or plans

**Connections:** CTA button → `/intake`

---

### Screen 2 — Intake Questionnaire
**Path:** `/intake`

**What's on it:**
- Progress indicator (Step X of 4) at top
- Step 1 — Academic Profile:
  - GPA (numeric input, 0.0–4.0 or weighted scale toggle)
  - GPA scale selector (4.0 unweighted / 4.0 weighted / 5.0 weighted)
  - Class rank (optional: top 10% / 25% / 50% / not reported)
  - SAT score (numeric, optional) OR ACT score (numeric, optional)
  - Test-optional toggle ("I'm applying test-optional")
  - Number of AP/IB courses taken (dropdown: 0 / 1–3 / 4–6 / 7+)
  - AP/IB scores summary (optional free text, max 100 chars)
- Step 2 — Background:
  - Current school type (Public / Private / Charter / Home school)
  - State of residence (dropdown)
  - First-generation college student (Yes / No / Prefer not to say)
  - Intended major or area of interest (dropdown with ~30 options + "Undecided")
  - Citizenship status (US Citizen / Permanent Resident / International)
  - Special circumstances (free text, optional, max 300 chars — for context like "my school doesn't report GPA" or "I had a medical hardship junior year")
- Step 3 — Extracurriculars & Achievements:
  - Up to 5 EC entries, each with: Activity name, Role/level (participant / leader / founder), Hours per week, Years involved
  - Honors / Awards (free text, max 200 chars)
  - Work experience or internships (free text, max 200 chars)
  - Athletics (Division I recruited / Varsity / JV / Club / None)
- Step 4 — Fit Preferences:
  - Nine dimension sliders (Prestige, Affordability, Safety, Diversity, Career Outcomes, Campus Culture, Mental Health Support, Climate, Research Opportunities)
  - Each slider: 0–100, default 50, label shows current weight %
  - Climate preference below Climate slider: Warm / Mild / Cold / No preference
  - School size preference: Small (<5k) / Medium (5–15k) / Large (>15k) / No preference
  - Location type: Urban / Suburban / Rural / No preference
  - Geographic preference: Any region / Specific regions (multi-select: Northeast, Southeast, Midwest, Southwest, West, International)
  - Budget ceiling (optional): Annual family contribution cap (dropdown ranges: <$10k / $10–25k / $25–50k / $50k+ / Need maximum aid)
- "Generate my list" CTA button (active only when required fields in Steps 1–2 are complete)
- "Save and continue later" link (session-stored only, no account required)

**Does NOT include:**
- School search or browsing
- Any AI output or results
- Account creation prompt
- Social login
- Essay upload

**Connections:** Back button → `/` | Submit → AI Moment A → `/clarify` (if questions needed) OR → `/results` (if profile is complete)

---

### Screen 3 — Clarifying Questions
**Path:** `/clarify`

**What's on it:**
- Header: "A few quick follow-ups"
- Subheader: "Your answers will make your list significantly more accurate"
- 1–3 AI-generated questions, each rendered as:
  - Question text (plain language, no jargon)
  - Answer input (free text or multiple choice depending on question type)
- "Continue" button
- "Skip and generate anyway" link (triggers list generation with available data; shows warning that accuracy may be lower)

**Does NOT include:**
- More than 3 questions
- Questions that repeat intake form fields
- Progress bar (this is a detour, not a step)
- School previews or teasers

**Connections:** Continue → `/results` | Skip → `/results`

---

### Screen 4 — Results: School List
**Path:** `/results`

**What's on it:**
- Left panel (sticky, ~300px wide):
  - Student profile summary (name optional, GPA, SAT, major, state)
  - Nine dimension sliders — all adjustable here; re-ranking triggers on slider release
  - Each slider row shows: dimension label, current weight %, slider control
  - Sliders set to 0 show the dimension label dimmed with a "not weighted" tag inline
  - Persistent note below all sliders (always visible, not a tooltip): "Setting a factor to 0 means it won't influence your results. Use this only if that factor genuinely doesn't matter to you."
  - After any re-rank, school cards where a weighted dimension has no data show a yellow inline warning: "Some factors you're weighing have no verified data for this school — fit score may be less reliable"
  - "Regenerate list" button (triggers new AI call — appears only if major/profile changes, not slider changes)
  - Weight reset button ("Reset to equal weights")
- Right panel (main content):
  - Three tier sections: Reach / Target / Likely
  - School count per tier shown in tier header
  - Each school card contains:
    - School name + state
    - Tier badge (color-coded: Reach = coral, Target = amber, Likely = green) + left border in tier color
    - Admission probability range in JetBrains Mono (e.g., "25–35%") with source citation in muted text
    - Composite fit score (e.g., 78/100) in JetBrains Mono
    - 9-segment thin bar: green (high score), amber (mid), red (low), gray (null / no data), dimmed (zero-weighted, labeled "not weighted")
    - Inline yellow warning if any non-zero-weighted dimension is null: "Some factors you're weighing have no verified data for this school — fit score may be less reliable"
    - Three "strengths" tags (green): criteria where student profile matches school well
    - Two "gaps" tags (amber): criteria where student profile falls short
    - One-sentence fit rationale
    - "Limited data" badge if ≥2 dimensions are null
    - "View strategy" button → triggers AI Moment C → opens deep dive drawer
  - Cards sorted within each tier by composite fit score (highest first)
  - "Limited data" badge on any school where ≥2 dimensions have missing data

**Does NOT include:**
- Side-by-side school comparison
- Export / download button (v2)
- Account save prompt
- Map view of schools
- Filter or search within results
- School photos or campus images

**Overlay states:**
- Loading state: full-screen skeleton with progress message ("Retrieving school data…" → "Scoring fit dimensions…" → "Generating your list…")
- Error state: "Something went wrong generating your list. Your answers are saved — try again." with retry button

**Connections:** "View strategy" → opens Deep Dive Drawer (overlay) | "Regenerate list" → `/clarify` flow | Back → `/intake`

---

### Screen 5 — Deep Dive Drawer (overlay)
**Path:** `/results` (drawer overlays results, no new URL)

**What's on it:**
- Drawer slides in from the right, ~500px wide, scrollable
- School name + tier badge at top
- Admission probability range repeated with source
- Per-dimension score breakdown: all 9 dimensions listed with their individual scores and a one-line data note (e.g., "Affordability: 8/10 — Average net price $14,200/yr for families earning <$48k (Scorecard 2023)")
- "Curated summary" label on Campus Culture and Mental Health Support dimension entries
- "Limited data" label on any dimension without a score
- Strategy brief (400–600 words, AI-generated):
  - Section 1: What's working for you at this school
  - Section 2: What to address or explain
  - Section 3: Concrete pre-application actions (with impact estimate where data supports it)
  - Section 4: Essay angle recommendation
- Close button (X) top right
- "Add to my list" toggle (session-stored only)

**Does NOT include:**
- Links to school website (v2)
- Essay drafting tool
- Deadline information (data not in scope for v1)
- Chat or follow-up questions
- Share button

**Overlay states:**
- Loading state: spinner with "Building your strategy for [School Name]…"
- Error state: "Couldn't generate strategy. Try again." with retry

**Connections:** Close → back to `/results`

---

## 2. System Prompt

```
You are a senior college admissions strategist with 15 years of experience helping high school students build their college lists. You are not a cheerleader. You are the advisor who respects students enough to tell them the truth.

Your job in this product is threefold:
1. Ask clarifying questions when a student's profile has gaps
2. Generate a tiered, data-grounded school list with honest probability estimates
3. Write school-specific strategy briefs that tell students exactly what to do

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
- Never score a fit dimension when data is unavailable. Flag it as "limited data" instead.

OUTPUT FORMAT — CLARIFYING QUESTIONS (AI Moment A)
Return 1–3 questions maximum. Each question must address a genuine gap in the profile — something missing or ambiguous that would materially change the school list. Never ask about something already answered. Format as a plain numbered list. No preamble.

OUTPUT FORMAT — SCHOOL LIST (AI Moment B)
Return a JSON object with this exact structure:
{
  "reach": [ ...school objects ],
  "target": [ ...school objects ],
  "likely": [ ...school objects ]
}

Each school object:
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

Use null for any dimension score where verified data is unavailable. Do not estimate.

OUTPUT FORMAT — STRATEGY BRIEF (AI Moment C)
Write in four labeled sections. Total length 400–600 words.

**What's working for you**
[2–4 specific strengths tied to school data and student profile]

**What to address**
[1–3 honest gaps with context — explain what the school will see, not just what's missing]

**Actions before you apply**
[2–4 concrete, specific recommendations — include data-backed impact estimates where possible, e.g., "Retaking SAT to 1520 would move you to the 50th percentile for admitted students (CDS 2023–24)"]

**Your essay angle**
[1–2 sentences: what story to lead with and why it fits this school's stated values or culture]

EXAMPLES OF GREAT VS. BAD OUTPUT

Example 1 — Strong candidate, reach school (UCLA, CS major, Texas, first-gen):
GREAT: "UCLA's CS admit rate sits around 3–5% (CDS 2023–24), making this a strong reach. Your 1480 SAT is at the 25th percentile for admitted CS students — it won't help you, but it won't sink you. Two things stand out: UCLA's first-gen enrollment (~40% of undergrad) suggests genuine commitment to access, and your Meta internship signals real CS engagement. Your biggest challenge is geographic — as a Texas applicant you're in the smaller, more competitive out-of-state pool. Lead with the Olympiad in your essays as intellectual curiosity, not just achievement. Estimated probability: 10–18%."
BAD: "You are a great candidate and UCLA can help you fulfill your aspirations. The campus is beautiful."

Example 2 — Average candidate, target school (UW-Madison, Ohio, undecided):
GREAT: "Wisconsin's middle 50% SAT range is 1310–1500 (CDS 2023–24) — you sit at the 25th percentile, acceptable but worth noting. As an Ohio applicant, you're in a smaller out-of-state seat pool. The gap in your profile is EC depth: one varsity sport with no leadership narrative is thin. Before applying, find the angle that connects your sport to something larger. Estimated probability: 40–55%."
BAD: "University of Wisconsin is a great school. Your stats are in range and you should apply."

SAFETY AND REFUSAL
If a student asks you to guarantee admission, fabricate data, assist with misrepresentation, or provide specific financial aid amounts: decline clearly and redirect. Example: "I can't tell you you're guaranteed admission — no one can, and any tool that does is misleading you. What I can tell you is your estimated probability range and exactly what would improve it."
```

---

## 3. Design Direction

**Feel:** Calm, precise, authoritative — like a well-designed financial dashboard crossed with a trusted advisor's office. Not a consumer app. Not a college brochure. Something that earns trust through clarity and restraint.

**Aesthetic direction:** Editorial minimalism with data confidence. Clean vertical hierarchy. Data-forward cards. Generous whitespace. The product communicates seriousness through what it doesn't include as much as what it does.

**Colors:**
| Role | Hex | Usage |
|---|---|---|
| Background primary | `#F7F6F3` | Page background — warm off-white, not clinical |
| Background surface | `#FFFFFF` | Cards, panels, drawers |
| Background muted | `#EDECEA` | Slider tracks, tags, inactive states |
| Text primary | `#1A1917` | Headlines, school names, primary content |
| Text secondary | `#6B6963` | Subheads, labels, metadata |
| Text muted | `#A09D98` | Hints, placeholders, source citations |
| Accent | `#2D5BE3` | CTAs, active sliders, links, probability bars |
| Reach tier | `#E8593C` | Reach tier label and left border on reach cards |
| Target tier | `#D4900A` | Target tier label and left border on target cards |
| Likely tier | `#2A8C5A` | Likely tier label and left border on likely cards |
| Strength tag | `#E6F4EE` / `#2A8C5A` | Green tag bg / text |
| Gap tag | `#FFF3E0` / `#B36B00` | Amber tag bg / text |
| Error | `#C0392B` | Error states, must-fail-safely responses |
| Border | `#E2E0DC` | Card borders, dividers |

**Typography:**
- Display / headlines: `DM Serif Display` — authoritative, editorial, not corporate
- Body / UI: `DM Sans` — clean, legible, pairs naturally with DM Serif
- Mono (data, probabilities, scores): `JetBrains Mono` — communicates data precision
- Body size: 15px / line-height 1.65
- Heading sizes: H1 32px / H2 22px / H3 17px / H4 14px uppercase tracked
- Probability ranges: 18px JetBrains Mono, accent color
- Fit score: 28px JetBrains Mono, text primary

**Spacing:**
- Base unit: 8px
- Card padding: 24px
- Section gaps: 40px
- Slider row gap: 16px
- Drawer width: 520px
- Left panel width: 300px
- Max content width: 1200px

**Reference apps in feel:**
- Linear — calm, precise, data-forward, no noise
- Notion — editorial, trusted, text-first
- Carta — financial data presented with authority and restraint

---

## 4. Implementation Notes

### Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS + CSS variables for design tokens |
| AI API | Anthropic Claude (claude-sonnet-4-20250514) via server-side API routes |
| Data — Quantitative | College Scorecard API (federal, free) + local JSON for CDS data |
| Data — Qualitative | Local JSON file: curated school culture + mental health summaries |
| Data — Safety | Local JSON: Clery Act data pre-processed at build time |
| Hosting | Vercel |
| Analytics | PostHog (event tracking for observability requirements) |

### Framework Setup

Use Next.js App Router with TypeScript throughout. No Pages Router. Enable strict mode. All AI calls happen in server-side route handlers (`/app/api/`) — never expose the Anthropic API key to the client.

### State Management

The intake form is managed in a single React context (`ProfileContext`) that persists across the 4-step form. On submission, the full profile object is passed to the API route. The results page stores the school list (with all dimension scores) in component state — this is what the slider re-ranking operates on client-side. No state management library needed; React context + useState is sufficient.

On slider change: re-ranking is a pure client-side sort — recalculate each school's weighted fit score from the stored dimension scores and the new weights, then re-sort. Dimensions with weight=0 are excluded from scoring entirely. After re-sort, evaluate each school card: if any dimension with weight>0 has a null score for that school, attach a `dataWarning: true` flag to the card so the UI can render the yellow inline warning. No API call. This is fast enough to feel instant.

### API Structure

```
POST /api/clarify       — takes profile object, returns 1–3 clarifying questions
POST /api/generate-list — takes full profile + weights, returns tiered school list JSON
POST /api/deep-dive     — takes profile + school name, returns strategy brief text
```

All routes validate input on the server. All routes stream responses using the Anthropic streaming API — the list generation and deep dive should stream tokens to the client so the user sees output appearing rather than waiting for a complete response.

Use the Vercel AI SDK (`ai` package) to handle streaming from Next.js API routes to the client. This simplifies streaming boilerplate significantly.

### Data Handling

School data lives in `/data/schools.json` — a pre-processed file combining College Scorecard API data, CDS data, Clery Act safety data, Carnegie classification, and curated qualitative summaries. This file is built and committed; it is not fetched at runtime from external APIs (avoids latency and rate limit issues). The Scorecard API is called at data-build time, not per-request.

Structure per school entry:
```json
{
  "id": "uc-los-angeles",
  "name": "University of California, Los Angeles",
  "state": "CA",
  "type": "public",
  "size": 31000,
  "setting": "urban",
  "carnegie_class": "R1",
  "acceptance_rate": 0.09,
  "acceptance_rate_source": "CDS 2023-24",
  "sat_25": 1290,
  "sat_75": 1530,
  "act_25": 28,
  "act_75": 34,
  "net_price_0_30k": 5200,
  "net_price_30_48k": 8100,
  "net_price_48_75k": 14300,
  "net_price_75_110k": 22800,
  "median_earnings_6yr": 61200,
  "pell_grant_pct": 0.38,
  "graduation_rate": 0.91,
  "student_faculty_ratio": 18,
  "clery_crimes_per_1000": 1.2,
  "us_news_rank": 15,
  "climate_avg_temp_f": 68,
  "culture_summary": "...",
  "mental_health_summary": "...",
  "culture_data_type": "curated",
  "mental_health_data_type": "curated"
}
```

No student profile data is stored server-side in v1. Profile data lives in the client session only (React context + sessionStorage as a backup for page refresh). It is passed to API routes per-request and not persisted.

### Key Packages

- `ai` (Vercel AI SDK) — streaming from Anthropic API to client
- `@anthropic-ai/sdk` — Anthropic client
- `zod` — input validation on API routes
- `posthog-js` — analytics/observability events
- `@radix-ui/react-slider` — accessible slider component for dimension weights
- `@radix-ui/react-dialog` — deep dive drawer
- `clsx` — conditional classnames
- No charting library needed — fit score bars are pure CSS

### Fonts

Load via `next/font/google`:
```ts
import { DM_Serif_Display, DM_Sans } from 'next/font/google'
import localFont from 'next/font/local'
// JetBrains Mono via Google Fonts
import { JetBrains_Mono } from 'next/font/google'
```
