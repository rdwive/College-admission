# DECISIONS.md — College Admission Strategist

---

## How to use this file

After every significant decision during your build, add an entry below. A "significant decision" = choosing between alternatives, changing your plan, or cutting scope.

Keep entries honest and specific. A good entry takes 3 minutes to write and saves 3 hours of second-guessing later.

---

## Decisions Log

---

### 2025-05-25 — Target user: high school undergrad applicants only

**Context:** The original product concept covered both high school students applying to undergrad and undergrad students applying to grad school.

**Options considered:**
- Build for both audiences simultaneously
- Start with grad school (smaller, more specialized market)
- Start with high school / undergrad (larger market, more standardized admissions process)

**Decision:** High school students applying to undergrad only for v1.

**Why:** Undergrad admissions is more standardized — GPA, SAT/ACT, ECs, essays — which makes it tractable for a general AI model. Grad school admissions is program-specific, discipline-specific, and heavily dependent on research fit and advisor relationships. Trying to serve both would mean serving neither well. Grad school is v2 when the core product is proven.

**Revisit if:** The undergrad market proves too competitive or saturated, and grad school shows stronger early demand signals.

---

### 2025-05-25 — v1 scope: features 1, 2, and 5 only (cut GPA inflation weighting and Reddit sentiment)

**Context:** The original feature list included: (1) matching stats to class profiles, (2) admission probability scoring, (3) school reputation / GPA inflation weighting, (4) Reddit/forum personality matching, (5) per-school application suggestions.

**Options considered:**
- Build all five features for v1
- Build features 1, 2, 3, and 5 (cut Reddit)
- Build features 1, 2, and 5 only (cut GPA inflation and Reddit)

**Decision:** Features 1, 2, and 5 only. GPA inflation weighting and Reddit sentiment analysis are v2.

**Why:** Features 3 and 4 are data infrastructure problems masquerading as AI features. GPA inflation data requires school-level historical data that doesn't exist in a clean, structured form. Reddit sentiment analysis requires a real-time ingestion pipeline, NLP classification, and ongoing maintenance. Both would consume 80% of build time before a single student sees value. The core loop — match stats, score probability, give strategy — is sufficient to differentiate from existing platforms if the AI output quality is high.

**Revisit if:** Post-launch research shows students are specifically missing school reputation context or culture fit signals. Reddit sentiment is the most likely v2 addition.

---

### 2025-05-25 — System type: RAG, not basic prompt

**Context:** Choosing between a basic prompt (AI reasons from training data), prompt + structured output, RAG (AI retrieves verified data then reasons), or tool calls.

**Options considered:**
- Basic prompt: fast to build, but AI fabricates statistics from training data
- RAG with live API calls per request: accurate but slow and rate-limited
- RAG with pre-built local JSON: accurate, fast, predictable

**Decision:** RAG with pre-built `/data/schools.json`. School data is fetched from College Scorecard API, CDS, Clery Act, and Carnegie classification at build time and stored locally. AI retrieves from this file, not from live APIs at runtime.

**Why:** The product's core promise is honest, data-grounded advice. A basic prompt cannot deliver that — Claude's training data on specific school statistics is stale, incomplete, and occasionally fabricated. Live API calls per request introduce latency spikes and rate limit risk. Pre-built JSON is fast, deterministic, and allows full data validation before any user sees it. The tradeoff is that data refresh requires a rebuild — acceptable for annually-updated admissions data.

**Revisit if:** Schools start publishing real-time admissions data via APIs, or if data freshness becomes a meaningful user complaint (e.g., schools change policies mid-cycle).

---

### 2025-05-25 — Nine fit dimensions added to scoring model

**Context:** Initial spec had generic preference sliders. The question was whether to define specific, named dimensions or leave them open-ended.

**Options considered:**
- Open-ended preference fields (student writes in what matters)
- Generic sliders (academics, social, location) — 3–5 dimensions
- Nine named dimensions with defined data sources

**Decision:** Nine named dimensions: Prestige, Affordability, Safety, Diversity, Career Outcomes, Campus Culture, Mental Health Support, Climate, Research Opportunities.

**Why:** Named dimensions force honesty about data sourcing. Each dimension had to be assigned a real data source — which immediately revealed that Campus Culture and Mental Health Support cannot be fully data-backed in v1 and require curated summaries. That distinction (quantitative vs. curated) is now surfaced to users, which is the right product decision. Generic sliders would have hidden this gap and produced misleading scores.

**Revisit if:** User research shows students don't understand what a dimension means, or that the nine dimensions don't match what students actually care about. Slider interaction data from PostHog will reveal which dimensions students actually use vs. ignore.

---

### 2025-05-25 — Slider re-ranking is client-side only, no new AI call

**Context:** When a student adjusts dimension weights, the school list needs to re-rank. The question was whether to trigger a new AI call or re-rank locally.

**Options considered:**
- New AI call on every slider release: most accurate, but 10–30 second wait each time
- Hybrid: re-rank client-side for small weight changes, new AI call for large changes
- Full client-side re-rank using stored dimension scores: instant, no cost, slightly less nuanced

**Decision:** Full client-side re-rank using the dimension scores stored from the initial list generation. No new AI call on slider adjustment.

**Why:** The AI's job at list generation time is to score each school across nine dimensions and return those scores as structured JSON. Once those scores exist on the client, re-ranking is pure math — multiply each score by its weight, sum, sort. The AI doesn't need to be involved again unless the underlying profile changes (different major, different GPA). The user experience of instant re-ranking is worth more than marginal accuracy improvement from re-querying the AI.

**Revisit if:** Users complain that re-ranked results feel wrong or inconsistent with the AI's strategy briefs. If so, consider triggering a lightweight re-score API call on significant weight changes (>30% shift).

---

### 2025-05-25 — Zero-weight slider UX: persistent static note, not tooltip

**Context:** When a student drags a slider to 0, they need to understand what that means. The question was how to communicate it.

**Options considered:**
- Tooltip on hover over the zero-weight slider
- Modal or confirmation dialog when slider hits 0
- Persistent static note below all sliders, always visible

**Decision:** Persistent static note below all sliders, always visible: "Setting a factor to 0 means it won't influence your results. Use this only if that factor genuinely doesn't matter to you."

**Why:** Tooltips require the user to hover and discover — most users won't. A modal on every zero-weight action is disruptive and condescending. A persistent note is visible before the student even touches a slider, which is when it's most useful. It also avoids the need for special interaction logic. Cost of implementing: two lines of HTML.

**Revisit if:** User testing shows students are still accidentally zeroing out important dimensions. If so, add a lightweight confirmation step only when a dimension that was previously weighted >30% is dragged to 0.

---

### 2025-05-25 — Missing data warning: per-card, post-rerank, scoped to weighted dimensions only

**Context:** Some schools have null scores for certain dimensions (missing data). Students need to know when the fit score they're seeing is based on incomplete information — but only when it actually affects their ranking.

**Options considered:**
- Always show "limited data" badge on all schools with any null dimension
- Show warning only when student has weighted a dimension that has no data for a specific school
- Show warning in the deep dive drawer only, not on the card

**Decision:** Show the yellow inline warning on the school card, after each re-rank, but only when a non-zero-weighted dimension has a null score for that school. Zero-weighted null dimensions do not trigger the warning.

**Why:** If a student doesn't care about Mental Health Support (weight = 0) and a school has no data for it, that's irrelevant — no warning needed. But if they weight Mental Health Support at 30% and the school has no data, they need to know their fit score is unreliable for that school. Scoping the warning to weighted dimensions keeps it signal, not noise. Always-on "limited data" badges become wallpaper — students stop reading them.

**Revisit if:** User testing shows students are confused about why some cards have warnings and others don't. If so, simplify to always-on "limited data" badge and remove the dynamic warning.

---

## Future Decisions

*(Continue logging here as you build.)*

---

### 2026-05-26 — Curated schools.json instead of live Scorecard API for Milestone 1

**Context:** Milestone 1 requires a working `/data/schools.json` to pass top candidates to the AI. The build-schools.ts script requires a College Scorecard API key which isn't yet available.

**Options considered:**
- Block on Scorecard API key before building anything
- Build a hand-curated schools.json with verified 2023-24 data for ~50 schools
- Generate synthetic/placeholder data and replace later

**Decision:** Hand-curated schools.json with real 2023-24 data for 50 schools. The build-schools.ts script will be written separately when the Scorecard API key is available.

**Why:** Milestone 1's success criterion is "prove the AI can generate a real, grounded school list." That doesn't require the full Scorecard pipeline — it requires accurate data for the candidate set. The top 50 US schools by prestige are well-documented enough to curate manually without fabrication. The pipeline comes later.

**Revisit if:** Schools in the curated set have data gaps that cause consistent null scores on important dimensions. If so, prioritize the Scorecard pull to fill in net price and earnings data.

---

### 2026-05-26 — APP_ANTHROPIC_API_KEY env var name to avoid shell collision

**Context:** The Claude Code development environment sets `ANTHROPIC_API_KEY=""` as an empty string in the shell environment, which overrides `.env.local` values in Next.js (system env takes precedence over .env.local).

**Options considered:**
- Read the key directly from .env.local in the route (bypasses Next.js env loading — bad practice)
- Use a different env var name that won't collide
- Set the key in system environment instead of .env.local

**Decision:** Use `APP_ANTHROPIC_API_KEY` as the env var name in both `.env.local` and the API routes.

**Why:** Simple and doesn't require any system changes. The collision is a dev environment artifact — in production (Vercel), `ANTHROPIC_API_KEY` will be set correctly and this issue won't occur. Document this in .env.local with a comment.

**Revisit if:** Deploying to Vercel — rename back to `ANTHROPIC_API_KEY` in the Vercel environment variables dashboard, which doesn't have the Claude Code shell interference.

---

### 2026-05-26 — 40 candidate schools (not 60) passed to AI in generate-list

**Context:** Original spec said top 60 candidates. With detailed culture/mental health summaries (~300 chars each) × 60 schools, the combined prompt + response exceeded max_tokens even at 8192.

**Options considered:**
- Keep 60 candidates, truncate all summaries aggressively
- Reduce to 40 candidates, truncate summaries moderately (150/120 chars)
- Keep 60 candidates, raise max_tokens to 32k+

**Decision:** 40 candidates with summaries truncated to ~150 chars. max_tokens raised to 16000.

**Why:** The AI only selects 15-20 schools from the candidate set. 40 gives enough headroom for good tier diversity without pushing the context window. The truncated summaries are enough for the AI to score campus_culture and mental_health_support directionally. Full summaries are stored in schools.json for the deep dive drawer (Milestone 5).

**Revisit if:** Users complain about thin school variety or consistent exclusion of niche schools that should appear. If so, explore running two AI calls (one for reach/target, one for target/likely) to keep each prompt smaller.
