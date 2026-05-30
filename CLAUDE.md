# CLAUDE.md — College Admission Strategist

---

## Product Context

College Admission Strategist is a web app for high school students applying to undergrad. A student completes a structured intake form, the AI generates a tiered list of 15–20 colleges (Reach / Target / Likely) ranked by admission probability and fit, and for each school produces a specific application strategy brief. The product's core promise: honest, data-grounded advice — not cheerleading. Every factual claim is sourced. Uncertainty is always shown. Nothing is fabricated.

**Core user flow:**
1. Student lands on home → clicks "Build my college list"
2. Student completes 4-step intake form (academic stats, background, ECs, fit preferences)
3. [AI MOMENT A] — AI asks 1–3 clarifying questions for gaps in the profile
4. Student answers → profile is complete
5. [AI MOMENT B] — AI generates tiered school list as structured JSON (reach/target/likely), each school with probability range, nine dimension scores, strengths, gaps, rationale
6. Student views results; adjusts nine fit dimension sliders → list re-ranks client-side (no new AI call)
7. [AI MOMENT C] — Student clicks a school → AI streams a 400–600 word strategy brief (4 sections: What's working / What to address / Actions / Essay angle)

---

## AI Behavior Rules

**The AI always:**
- Expresses admission probability as a range (e.g., "25–35%"), never a single number
- Cites the data source for every statistic (e.g., "Common Data Set 2023–24", "College Scorecard 2023")
- Acknowledges when a factor (holistic review, legacy, athletics) makes probability inherently opaque
- Uses hedged language: "suggests," "indicates," "based on available data" — never "you will" or "you won't"
- Flags general best-practice advice separately from school-specific insight
- Returns null for any dimension score where verified data is unavailable — never estimates

**The AI never:**
- Fabricates acceptance rates, class profiles, test score ranges, deadlines, or scholarship amounts
- Gives a single-point probability — always a range
- Guarantees admission or rejection
- Assists with misrepresenting any part of an application
- Provides specific financial aid dollar amounts it cannot source to a verified dataset
- Scores a fit dimension when the underlying data is missing

---

## Coding Behavior Rules

**Think before coding.**
- State your assumptions explicitly before implementing anything
- If a task has multiple valid interpretations, list them briefly and pick one — don't silently choose
- If something in the spec is unclear, stop and name what's confusing before writing code
- If a simpler approach exists than what you're about to build, say so first

**Simplicity first.**
- Write the minimum code that solves the problem as specified
- No speculative features, no abstractions built for a single use case, no "future flexibility" that wasn't asked for
- If you write 200 lines and it could be 50, rewrite it
- Nothing beyond what's in PRD.md and PLANNING.md

**Surgical changes.**
- Touch only the files and functions required for the current task
- Do not refactor adjacent code that isn't broken
- Do not "improve" formatting, comments, or naming in files you're not directly changing
- If you notice unrelated dead code or a bug, mention it — don't fix it silently

**Stay aligned with specs.**
- Before starting any milestone, re-read the relevant section of TASKS.md and PLANNING.md
- Never add screens, UI elements, or features not listed in PLANNING.md
- Never add a new API route not defined in PLANNING.md Section 4
- When in doubt about what to build, check the spec — if the spec doesn't cover it, ask

**Use your engineering judgment.**
- For any technical decision not covered in these specs (file structure, naming, package versions, implementation patterns), make the call yourself
- Do not ask about purely technical choices — decide and proceed
- If a decision has product implications (changes user-visible behavior), flag it before proceeding

---

## Architecture Decisions (non-negotiable)

- All AI calls happen server-side in `/app/api/` route handlers — never expose the Anthropic API key to the client
- School data lives in `/data/schools.json` — pre-built at data-build time, not fetched live per request
- Slider re-ranking is entirely client-side — the `rerank()` function in `/lib/rerank.ts` is a pure function with no API calls
- `rerank()` sets `dataWarning: true` on any school where a non-zero-weighted dimension has a null score
- Student profile data is never persisted server-side — it lives in React context + sessionStorage only
- List generation returns structured JSON (not prose) — the client owns rendering
- Deep dive returns streaming text — use Vercel AI SDK for streaming from Next.js API routes

---

## Slider UX Rules (implement exactly as specified)

- Zero-weighted dimensions: dim the slider label, show "not weighted" tag inline on the slider row
- Persistent static note below all sliders (not a tooltip): "Setting a factor to 0 means it won't influence your results. Use this only if that factor genuinely doesn't matter to you."
- After every re-rank: any school card where `dataWarning: true` shows a yellow inline banner: "Some factors you're weighing have no verified data for this school — fit score may be less reliable"
- Dimension bar segments: green (high score) / amber (mid) / red (low) / gray (null — no data) / dimmed (zero-weighted, labeled "not weighted" on hover)
- Re-ranking triggers on slider release (`onValueCommit`), not on drag (`onChange`)
- Weights auto-normalize to sum to 100%; zero-weighted sliders are excluded from normalization

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14, App Router, TypeScript, strict mode |
| Styling | Tailwind CSS + CSS custom properties for design tokens |
| AI API | Anthropic claude-sonnet-4-20250514, server-side only |
| AI streaming | Vercel AI SDK (`ai` package) |
| Input validation | Zod on all API routes |
| School data | `/data/schools.json` (pre-built) |
| Analytics | PostHog |
| Sliders | `@radix-ui/react-slider` |
| Drawer | `@radix-ui/react-dialog` |
| Hosting | Vercel |

**Fonts (load via `next/font/google`):** DM Serif Display (headlines), DM Sans (body/UI), JetBrains Mono (data: probabilities, scores)

---

## Key Design Tokens

```css
--bg-primary:    #F7F6F3;   /* page background */
--bg-surface:    #FFFFFF;   /* cards, panels */
--bg-muted:      #EDECEA;   /* slider tracks, tags */
--text-primary:  #1A1917;
--text-secondary:#6B6963;
--text-muted:    #A09D98;
--accent:        #2D5BE3;   /* CTAs, active sliders */
--tier-reach:    #E8593C;
--tier-target:   #D4900A;
--tier-likely:   #2A8C5A;
--tag-strength-bg: #E6F4EE; --tag-strength-text: #2A8C5A;
--tag-gap-bg:    #FFF3E0;   --tag-gap-text: #B36B00;
--warning-bg:    #FFFBEB;   --warning-text: #B36B00; /* data warning banner */
--error:         #C0392B;
--border:        #E2E0DC;
```

---

## File Locations

| File | Purpose |
|---|---|
| `/docs/PRD.md` | What we're building, quality bar, test set, constraints |
| `/docs/PLANNING.md` | Screen specs, system prompt, design direction, tech stack |
| `/docs/TASKS.md` | Milestone build order with success criteria and subtasks |
| `/docs/CLAUDE.md` | This file — persistent rules for the coding tool |
| `/docs/DECISIONS.md` | Log of product and architecture decisions made during the build |
| `/data/schools.json` | Pre-built school data (Scorecard + CDS + Clery + Carnegie + curated) |
| `/scripts/build-schools.ts` | Data pipeline — run to regenerate schools.json |
| `/lib/scoreDimensions.ts` | Scores all 9 dimensions for a school given student preferences |
| `/lib/rerank.ts` | Pure client-side re-ranking function; sets dataWarning flag |
| `/app/api/clarify/route.ts` | AI Moment A — returns 0–3 clarifying questions |
| `/app/api/generate-list/route.ts` | AI Moment B — returns tiered school list JSON |
| `/app/api/deep-dive/route.ts` | AI Moment C — streams strategy brief |
