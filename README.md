# College Admission Strategist

An AI-powered web app that helps high school students build a realistic, data-grounded college list — with honest probability estimates, per-school strategy briefs, and fit scoring across nine dimensions.

## What it does

1. **Intake form** — Student fills in academic stats, background, extracurriculars, and fit preferences (4 steps)
2. **Clarifying questions** — AI identifies gaps in the profile and asks up to 3 targeted follow-up questions
3. **Tiered school list** — AI generates 15–20 schools (Reach / Target / Likely) with admission probability ranges sourced from real data, composite fit scores, strength/gap tags, and one-sentence rationales
4. **Slider re-ranking** — Student adjusts nine fit dimension weights (Prestige, Affordability, Safety, Diversity, Career Outcomes, Campus Culture, Mental Health Support, Climate, Research Opportunities) and the list re-ranks instantly — no new AI call
5. **Deep dive drawer** — Click any school to get a streaming 400–600 word strategy brief: what's working, what to address, specific actions, and an essay angle

## Core principles

- Every statistic is sourced (Common Data Set 2023–24, College Scorecard, Clery Act). Nothing is fabricated.
- Admission probability is always a range — never a single number.
- Uncertainty is shown, not hidden. Null data is displayed as "no data", never estimated.

## Tech stack

- **Framework:** Next.js 16, App Router, TypeScript
- **AI:** Anthropic Claude (server-side only)
- **Data:** 60-school dataset built from College Scorecard API + curated CDS/Clery/climate data
- **Styling:** Tailwind CSS with custom design tokens
- **Analytics:** PostHog
- **Hosting:** Vercel

## Running locally

1. Clone the repo and install dependencies:
   ```bash
   npm install
   ```

2. Create `.env.local` with your keys:
   ```
   APP_ANTHROPIC_API_KEY=sk-ant-...
   NEXT_PUBLIC_POSTHOG_KEY=phc_...
   NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
   ```

3. Start the dev server:
   ```bash
   node node_modules/next/dist/bin/next dev
   ```

Open [http://localhost:3000](http://localhost:3000) to see the app.
