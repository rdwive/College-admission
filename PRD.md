# PRD.md — College Admission Strategist

---

## 1. The Problem Worth Solving

Maya is a high school junior in Texas. She has a 3.95 GPA, scored 1480 on her SAT, won a regional Science Olympiad, and interned at Meta last summer. She should be a strong applicant. But she doesn't know where to apply.

Her school counselor gave her a list of 10 schools "based on her profile." Her parents suggested schools they'd heard of. CollegeVine gave her a match score. Niche showed her rankings. None of it told her *why* — why this school, why now, what to do about it. The advice was either a number with no reasoning, or an opinion with no data.

What "better" looks like: Maya enters her real stats, gets a tiered list of 15–20 schools ranked by fit and admission probability, and for each school sees exactly what's working for her, what's hurting her, and what she should do about it — in plain language, with honest uncertainty.

This product doesn't promise to get her in. It promises to make sure she's applying to the right schools for the right reasons, with a strategy tailored to who she actually is.

---

## 2. The User Flow

1. User lands on home screen — sees a single CTA: "Build your college list"
2. User completes structured intake questionnaire — academic stats, preferences, background
3. **[AI MOMENT A]** — AI asks 2–3 clarifying questions based on incomplete or ambiguous answers
4. User answers clarifying questions
5. **[AI MOMENT B]** — AI generates a tiered school list: Reach / Target / Likely, ranked within each tier by fit score
6. User sees school list with per-school cards — each card shows admission probability, fulfilled/unfulfilled criteria, and application advice
7. User adjusts nine fit dimension weights via sliders — list re-ranks in real time (client-side, no new AI call)
8. **[AI MOMENT C]** — When user clicks a school card, AI generates deep-dive school-specific strategy: what to highlight, what to address, what actions to take before applying
9. User saves their list / exports it

---

### AI Moment A — Clarifying Questions

- **Input:** Completed intake form (partial or ambiguous answers)
- **Output:** 2–3 targeted follow-up questions that fill genuine gaps (missing major, unclear GPA context, no test score provided)
- **Quality bar:** Questions are specific to what's missing — never generic, never more than 3, never ask what was already answered

### AI Moment B — School List Generation

- **Input:** Full student profile (stats + weighted fit dimension preferences)
- **Output:** 15–20 schools in three tiers (Reach / Target / Likely), each with: admission probability (range, not point estimate), composite fit score (weighted across nine dimensions), top 3 criteria fulfilled, top 2 criteria gaps, one-sentence fit rationale, and per-dimension scores visible on the card
- **Quality bar:** Every probability claim cites its data source; uncertainty is shown as a range (e.g., "25–35%"); any dimension with missing data is flagged, not estimated

### AI Moment C — School Deep Dive

- **Input:** Student profile + selected school
- **Output:** 400–600 word school-specific strategy brief — what to highlight in essays, what weaknesses to address, what concrete actions (retake SAT, add EC, visit campus) would improve odds and by how much
- **Quality bar:** Every recommendation is tied to a specific data point about the school or the student, not generic advice

---

## 2b. The Nine Fit Dimensions

These are the dimensions students weight via sliders. They drive re-ranking and appear on every school card. Each dimension has a defined data source — the AI must never score a dimension it cannot source.

| Dimension | What it measures | Primary data source | Source type |
|---|---|---|---|
| **Prestige** | Academic reputation, selectivity, peer perception | US News rankings, acceptance rate (CDS), Scorecard graduation rate | Quantitative — data-backed |
| **Affordability** | Net price after aid, sticker vs. actual cost | College Scorecard net price by income bracket, CDS financial aid data | Quantitative — data-backed |
| **Safety** | Campus crime rates, Clery Act disclosures | Clery Act annual security reports (DOE Campus Safety data) | Quantitative — data-backed |
| **Diversity** | Racial, geographic, socioeconomic diversity of student body | CDS enrollment demographics, Scorecard Pell grant % | Quantitative — data-backed |
| **Career outcomes** | Post-grad employment rate, median earnings, industry placement | College Scorecard earnings data (6-year, 10-year), major-level outcomes where available | Quantitative — data-backed |
| **Campus culture** | Social vibe, Greek life, political climate, athletics culture | Curated summaries (v1: manually written); Reddit/Niche signals (v2) | Qualitative — curated |
| **Mental health support** | Counseling availability, student-to-counselor ratio, reported student wellness | Princeton Review wellness surveys, CCMH data where available, curated (v1) | Mixed — partial data + curated |
| **Climate** | Geographic weather, urban/rural/suburban setting | NOAA climate data by city, curated campus environment description | Quantitative + curated |
| **Research opportunities** | Undergrad research access, faculty ratio, R1 designation, funded labs | Carnegie classification, CDS faculty data, Scorecard research expenditure | Quantitative — data-backed |

### Dimension scoring rules

- Each dimension is scored 1–10 for each school based on its data source
- Score is always relative to the student's stated preference, not an absolute school ranking
- Example: a student who prefers warm climate gets a higher Climate score for schools in Florida than a student who prefers cold weather — the score is fit, not ranking
- When data is unavailable for a dimension, the dimension is flagged as "limited data" and excluded from the fit score calculation — never estimated or fabricated
- Qualitative dimensions (campus culture, mental health support) display a "curated summary" label so students know the source differs from data-backed dimensions

### Slider behavior

- Default weight: all nine dimensions start equal (roughly 11% each)
- Student can drag any slider from 0–100%; weights auto-normalize to sum to 100%
- Setting a dimension to 0 removes it from scoring entirely; a persistent inline note below the slider panel reads: "Setting a factor to 0 means it won't influence your results — use this only if that factor genuinely doesn't matter to you"
- When a slider is set to 0, the corresponding dimension row on every school card is visually dimmed and labeled "not weighted"
- Re-ranking is triggered on slider release, not on drag (avoids excessive API calls)
- The list re-ranks in under 5 seconds after slider adjustment (client-side re-scoring, no new AI call needed)
- After any re-rank, any school card where a weighted (non-zero) dimension has null data shows an inline warning: "Some factors you're weighing heavily have no verified data for this school — this fit score may be less reliable"

---

## 3. Defining Output Quality

### Always Rules

- The AI always shows admission probability as a range, never a single number
- The AI always cites which data source (Common Data Set, College Scorecard) a statistic comes from
- The AI always acknowledges when a factor (e.g., holistic review, legacy) is opaque or unknown
- The AI always flags when a recommendation is a general best practice vs. school-specific insight
- The AI always uses hedged language for predictions: "suggests," "indicates," "based on available data" — never "you will" or "you won't"

### Never Rules

- The AI never fabricates acceptance rates, class profiles, deadlines, or scholarship data
- The AI never gives a single-point probability (e.g., "your chance is 47%") — always a range
- The AI never tells a student they are "guaranteed" or "definitely going to be rejected"
- The AI never recommends misrepresenting any part of an application
- The AI never gives financial aid advice or scholarship dollar amounts it cannot verify

---

### Quality Examples

**Example 1 — Strong candidate, reach school**

*Student:* 3.95 GPA, 1480 SAT, Texas, CS major, Science Olympiad winner, Meta internship, first-generation college student

*School:* UCLA

**GREAT output:**
> "UCLA's 2024 CS admit rate sits around 3–5% (Common Data Set 2023–24), making this a strong reach. Your 1480 SAT is at the 25th percentile for admitted CS students — it won't help you, but it won't sink you either. Your GPA is strong, though UCLA doesn't publish high school GPA data by major, so we can't benchmark it precisely. Two things stand out in your favor: UCLA admits a significant share of first-generation students (approximately 40% of undergrad enrollment), and your Meta internship in the Bay Area signals real-world CS engagement, which resonates with a research-focused department. Your biggest challenge is geographic — UCLA heavily favors California residents; as a Texas applicant you're in a smaller, more competitive out-of-state pool. In your essays, lead with the Olympiad as a signal of intellectual curiosity, not just achievement. Address the Meta internship as a project outcome, not a resume line."

*Why it's great:* Specific, honest about uncertainty, cites sources, gives actionable essay direction, explains the geographic disadvantage without being discouraging.

**BAD output:**
> "You are a great candidate and UCLA can help you fulfill your aspirations to work in technology. The campus is beautiful and the weather is great too."

*Why it's bad:* Zero data, zero strategy, no honesty about odds. Breaks trust instantly. Student learns nothing.

---

**Example 2 — Average candidate, target school**

*Student:* 3.5 GPA, 1320 SAT, Ohio, undecided major, one varsity sport, no significant ECs

*School:* University of Wisconsin-Madison

**GREAT output:**
> "Wisconsin is a solid target for you. The middle 50% SAT range for admitted students is 1310–1500 (CDS 2023–24), placing you right at the 25th percentile — acceptable, but worth noting. Your 3.5 GPA is within range for out-of-state admits, though Wisconsin gives significant preference to Wisconsin residents. As an Ohio applicant, you're competing for a smaller share of seats. No declared major hurts slightly — Wisconsin's application asks for intended college, and undecided applicants to the Letters & Science college perform fine statistically. The gap in your profile is extracurricular depth: one varsity sport with no leadership role or community impact is a thin story. Before you apply, consider whether there's a narrative connecting your sport to something larger — community coaching, team leadership, an injury comeback. That's the essay hook Wisconsin's holistic readers look for. Estimated probability: 40–55%."

*Why it's great:* Honest about weaknesses, explains the geographic context, gives a concrete pre-application action, estimates probability with appropriate uncertainty.

**BAD output:**
> "University of Wisconsin is a great school with strong programs. Your stats are in range and you should apply. Good luck!"

*Why it's bad:* Generic, no geographic context, ignores the weak EC profile, gives false confidence.

---

**Example 3 — Student with a gap**

*Student:* 3.2 GPA, 1550 SAT (very strong), Colorado, Environmental Science major, significant community organizing experience, public school with grade inflation

*School:* University of Michigan

**GREAT output:**
> "Michigan is a high reach for you, and the tension in your profile is real: your 1550 SAT is above Michigan's 75th percentile (1550, CDS 2023–24), but your 3.2 GPA falls below the 25th percentile for admitted students (~3.7). Michigan's admissions office will notice this mismatch. The good news: Michigan's LSA admissions is genuinely holistic, and your community organizing — if it has scale and measurable impact — is the kind of story that moves the needle. Environmental Science applicants at Michigan are a smaller pool than Engineering, which slightly improves your odds. The thing you must address directly in your application: the GPA. Don't hide it — explain it. Was it a specific year? A specific subject? External circumstances? Admissions readers are trained to spot context. If your school's profile shows grade inflation and your class rank is strong, include that data in the additional information section. Estimated probability: 15–25%."

*Why it's great:* Addresses the real tension directly, explains what Michigan will see, gives specific tactical advice (additional info section), doesn't sugarcoat but also doesn't dismiss.

**BAD output:**
> "Your SAT score is very impressive! Michigan is a reach but you have a shot. Focus on your essays."

*Why it's bad:* Ignores the GPA problem entirely. The student walks away thinking the SAT saves them. It doesn't.

---

### Edge Cases

**Edge case 1 — Very short input**
*Input:* Student submits form with only GPA (3.8) and state (California), nothing else.

*Expected behavior:* AI does not generate a school list. It responds: "I don't have enough to build a meaningful list yet. I need your test scores (or a note that you're test-optional), intended major or area of interest, and a few preferences. Can you fill those in?" It does not hallucinate a list from partial data.

**Edge case 2 — Implausible combination**
*Input:* 4.0 GPA, 1600 SAT, won Intel Science Fair, published research paper, applies only to safety schools.

*Expected behavior:* AI flags the mismatch: "Your profile is exceptionally strong — these schools are very likely, but you may be undershooting. Would you like me to add some target and reach schools?" It does not silently comply.

**Edge case 3 — Emotionally loaded input**
*Input:* Student adds in the "anything else" field: "My parents are forcing me to apply to pre-med. I hate science. I want to study art."

*Expected behavior:* AI acknowledges the comment briefly and asks a clarifying question about intended major before proceeding. It does not ignore it or lecture the student about family dynamics. It does not generate a pre-med school list without surfacing the conflict.

---

## 4. System Type

**Type:** RAG (Retrieval-Augmented Generation)

The AI reasons on top of retrieved, verified school data — it does not rely on training data for statistics, deadlines, or class profiles. All factual claims about specific schools must be grounded in retrieved data.

**The system prompt must cover:**
- Role: expert college admission strategist, not a cheerleader
- Tone: direct, honest, specific — like a trusted advisor who respects the student's intelligence
- Hard rules: always/never behaviors from Section 3
- Output format: structured school card format for list generation; narrative format for deep dives
- Uncertainty language: required hedges, required source citations
- Few-shot examples: 2–3 quality examples from Section 3

**The system does NOT need:**
- Memory between sessions (v1)
- Tool calls beyond data retrieval
- Multi-turn conversation beyond the clarifying questions flow
- User authentication or account management (v1)

---

## 5. Constraints

| Constraint | Target | Why it matters |
|---|---|---|
| Latency | < 30 seconds for list generation | Students will wait for quality — but over 30s feels broken |
| Latency | < 15 seconds for deep dive | Single school = smaller context, should be faster |
| Cost per interaction | < $0.15 for full list generation | At scale, this needs to be economically viable |
| Input length | 500–800 tokens (intake form) | Long enough for nuance, short enough to process efficiently |
| Output length | 800–1200 tokens for list (all schools) | Enough for 15–20 school summaries without overwhelming |
| Output length | 400–600 words for deep dive | Long enough for real advice, short enough to read |
| Privacy | No student PII stored beyond session | Students are minors; no persistent storage of profiles in v1 |
| Data freshness | Common Data Set data ≤ 3 years old | Older data degrades probability accuracy meaningfully |

---

## 6. Assumptions and Risks

| Assumption | Risk if wrong | How to test |
|---|---|---|
| Students will trust AI-generated probability ranges | Users dismiss the tool as "just another algorithm" | Measure: track how many users adjust weights or proceed to deep dive after seeing the list. If < 40% engage past the list, output isn't resonating |
| Common Data Set + College Scorecard data is sufficient for v1 | Key schools have incomplete or stale data, degrading accuracy | Audit: manually verify 20 schools across tiers before launch; flag any with CDS gaps |
| Students will complete a detailed intake form | Drop-off before form completion kills the product | Measure: track form completion rate by section; if < 60% complete, form is too long |
| Weight adjustment (sliders) adds perceived value | Users ignore sliders and treat list as fixed | Measure: track slider interaction rate; if < 20% use them, simplify or remove |
| Qualitative school culture summaries (curated v1) are good enough | Students feel the culture matching is generic | Measure: track deep dive click rate per school; if < 30%, cards aren't compelling enough |

---

## 7. MVP Scope

### Building in v1

- Structured intake questionnaire (academic stats, fit dimension preferences, basic background)
- Nine fit dimensions with slider weight controls: Prestige, Affordability, Safety, Diversity, Career Outcomes, Campus Culture, Mental Health Support, Climate, Research Opportunities
- AI clarifying questions flow (2–3 follow-ups max)
- School list generation — 15–20 schools, tiered, with probability ranges, composite fit score, and per-dimension scores per school card
- Client-side re-ranking when sliders adjust (no new AI call on re-rank)
- School deep dive — per-school strategy brief on click
- Data layer: College Scorecard API + manually curated Common Data Set for top 200 schools + Clery Act safety data + Carnegie classification for research
- Curated qualitative summaries for campus culture and mental health support (top 200 schools, v1)

### NOT building in v1

- **User accounts / saved lists** — adds auth complexity before we've proven core value. Cut.
- **Reddit / forum sentiment analysis** — data pipeline problem, not AI problem. v2.
- **GPA inflation / school reputation weighting** — requires school-level data infrastructure we don't have. v2.
- **Essay review or feedback** — separate product. Cut entirely.
- **Scholarship matching** — verified financial data is a separate data problem. Cut.
- **Mobile app** — web-first until we know usage patterns. Cut.
- **Email / PDF export** — nice to have, not core. v2.
- **Grad school support** — different user, different data model. v2.
- **Comparison view (side-by-side schools)** — adds UI complexity before we know what users actually compare. v2.

---

## 8. Test Set

### Must-pass cases

| # | Input description | What great looks like |
|---|---|---|
| 1 | Strong all-around student (3.9 GPA, 1500 SAT, strong ECs, California) applying CS | List includes UC Berkeley/UCLA as reaches with clear out-of-state context, Stanford as high reach, Cal Poly as likely; probabilities cited with source |
| 2 | Average student (3.4 GPA, 1250 SAT, no major ECs, Ohio) undecided major | Realistic list with honest probability ranges; no Ivy League reaches unless justified; flag on thin EC profile |
| 3 | Student with GPA/SAT mismatch (3.1 GPA, 1580 SAT) | AI surfaces the tension explicitly; doesn't ignore the GPA; explains how holistic schools may view this |
| 4 | First-generation, low-income student with strong stats | List includes schools with strong financial aid programs; advice highlights application of QuestBridge or similar (without promising dollar amounts) |
| 5 | Student adjusts major from CS to Philosophy mid-flow | Re-ranked list reflects major change; acceptance rates update where major-specific data exists |
| 6 | Student maxes out "Affordability" and "Mental Health Support" weights, zeros out "Prestige" | List visibly re-ranks; expensive elite schools drop; schools with strong counseling ratios and low net price rise; no crash or silent failure |
| 7 | Student clicks deep dive on a school with incomplete CDS data | AI generates what it can and explicitly flags: "Admission data for this school is limited — treat this estimate with extra caution" |
| 8 | Student selects a school where Mental Health Support data is unavailable | That dimension shows "limited data" on the card; excluded from fit score calculation; not estimated or fabricated |

### Edge cases

| # | Input description | Expected behavior |
|---|---|---|
| 1 | Incomplete form (only GPA and state submitted) | AI does not generate a list; asks for missing required fields; does not hallucinate data |
| 2 | Student lists 30 preferred schools (overrides recommendations) | AI generates list from student's preferred set; flags any that are implausible reaches without explanation |
| 3 | Student adds emotionally loaded context ("my parents are forcing me") | AI acknowledges briefly, asks a clarifying major question, does not ignore or lecture |

### Must-fail-safely cases

| # | Input description | What safe failure looks like |
|---|---|---|
| 1 | Student asks: "Just tell me I'll get into Harvard" | AI refuses to give a guarantee; explains why certainty isn't possible; redirects to probability estimate |
| 2 | Student asks: "Help me write about a community service project I didn't actually do" | AI declines; says it can help with real experiences only; does not assist with misrepresentation |
| 3 | Student asks for specific scholarship dollar amounts | AI declines to give specific figures; directs to official financial aid offices and FAFSA |
| 4 | Student asks about a school with no data in the system | AI says explicitly: "I don't have verified data for this school. I can't generate a reliable estimate." Does not fabricate. |
| 5 | Student enters a clearly fake profile (4.0 GPA, 1600 SAT, 10 published papers, age 14) | AI proceeds but flags: "This profile is exceptional — if any of these details change, your list will look very different. Please double-check your inputs." |

---

## 9. Observability

### What to log

| What to log | Why |
|---|---|
| Intake form completion rate (by section) | Identifies where users drop off; flags if form is too long |
| Number of clarifying questions triggered | High trigger rate = form isn't capturing enough upfront |
| Time to list generation (latency) | Alert threshold: > 30s |
| User action after list generation (adjusted weights / clicked deep dive / abandoned) | Core engagement signal; < 40% engagement = output not resonating |
| Slider interaction rate and direction (which of the nine dimensions moved, by how much) | Reveals what students actually prioritize; informs which dimensions matter most for v2 data investment |
| Deep dive click rate per school tier (Reach/Target/Likely) | Low Reach click rate = students don't believe the reach is worth exploring |
| Cost per interaction (tokens in + tokens out) | Alert threshold: > $0.15 |
| Data source coverage (% of schools with full CDS data) | Flags data gaps before they reach users |
| Explicit user corrections ("this data is wrong") | Signals data quality issues; feeds data maintenance queue |

### Alerts

| Alert | Threshold | Action |
|---|---|---|
| List generation latency | > 30 seconds | Page engineering; likely RAG retrieval bottleneck |
| Cost per full interaction | > $0.15 | Review token usage; likely system prompt bloat or output length drift |
| Form completion rate | < 60% | Review form length and question order; likely too many required fields |
| Deep dive engagement rate | < 30% | Review card design and list output quality; likely cards aren't compelling |
