import Link from 'next/link'

const DIM_BAR = ['#16A34A','#16A34A','#CA8A04','#16A34A','#16A34A','#E5E7EB','#CA8A04','#16A34A','#DC2626']

export default function MarketingHome() {
  return (
    <div style={{ background: '#fff', color: '#0D0D0D', minHeight: '100vh' }}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav
        className="flex items-center justify-between px-6 md:px-14 py-5 sticky top-0 z-10"
        style={{ borderBottom: '2px solid #0D0D0D', background: '#fff' }}
      >
        <span style={{ fontFamily: 'var(--font-dm-serif, Georgia, serif)', color: '#0D0D0D' }}
              className="text-lg">
          College Admission Strategist
        </span>
        <Link
          href="/intake"
          className="px-5 py-2.5 text-sm font-semibold hover:opacity-80 transition-opacity"
          style={{ background: '#0D0D0D', color: '#fff' }}
        >
          Build my list with honest odds
        </Link>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="px-6 md:px-14 pt-16 pb-20" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 items-start">

          {/* Left: eyebrow + headline */}
          <div className="lg:col-span-8 lg:pr-16 mb-12 lg:mb-0">
            <div className="flex flex-wrap items-center gap-3 mb-10">
              <span className="font-mono text-xs font-semibold"
                    style={{ color: '#0D0D0D', letterSpacing: '0.18em' }}>
                COLLEGE LIST BUILDER
              </span>
              <span style={{ width: '1px', height: '14px', background: '#D1D5DB', display: 'inline-block' }} />
              <span className="font-mono text-xs font-semibold"
                    style={{ color: '#2563EB', letterSpacing: '0.12em' }}>
                CDS 2023–24
              </span>
              <span style={{ width: '1px', height: '14px', background: '#D1D5DB', display: 'inline-block' }} />
              <span className="font-mono text-xs font-semibold"
                    style={{ color: '#6B7280', letterSpacing: '0.12em' }}>
                NO ACCOUNT NEEDED
              </span>
            </div>

            <h1
              className="leading-none mb-0"
              style={{
                fontFamily: 'var(--font-dm-serif, Georgia, serif)',
                fontSize: 'clamp(3rem,7vw,5.5rem)',
                color: '#0D0D0D',
                letterSpacing: '-0.02em',
              }}
            >
              Your college list should be built on your numbers,
            </h1>
            <h1
              className="leading-none mb-10"
              style={{
                fontFamily: 'var(--font-dm-serif, Georgia, serif)',
                fontSize: 'clamp(3rem,7vw,5.5rem)',
                color: '#2563EB',
                letterSpacing: '-0.02em',
              }}
            >
              not your counselor's template.
            </h1>

            <p className="text-lg leading-relaxed mb-10" style={{ color: '#4B5563', maxWidth: '520px' }}>
              For the junior who knows what matters to them and wants a college list that actually reflects it.
            </p>

            <Link
              href="/intake"
              className="inline-block px-9 py-4 text-base font-semibold hover:opacity-80 transition-opacity"
              style={{ background: '#2563EB', color: '#fff' }}
            >
              Build my list with honest odds →
            </Link>
          </div>

          {/* Right: stat column */}
          <div className="lg:col-span-4 lg:pt-20">
            <div style={{ borderTop: '2px solid #E5E7EB', paddingTop: '1.5rem', marginBottom: '2.5rem' }}>
              <div className="font-mono" style={{ fontSize: '3.5rem', color: '#0D0D0D', fontWeight: 500, lineHeight: 1 }}>60</div>
              <div className="text-sm mt-2" style={{ color: '#6B7280' }}>schools scored from verified data</div>
            </div>
            <div style={{ borderTop: '2px solid #E5E7EB', paddingTop: '1.5rem', marginBottom: '2.5rem' }}>
              <div className="font-mono" style={{ fontSize: '2rem', color: '#2563EB', fontWeight: 500, lineHeight: 1 }}>22–31%</div>
              <div className="text-sm mt-2" style={{ color: '#6B7280' }}>probability always shown as a range</div>
            </div>
            <div style={{ borderTop: '2px solid #E5E7EB', paddingTop: '1.5rem' }}>
              <div className="font-mono" style={{ fontSize: '3.5rem', color: '#0D0D0D', fontWeight: 500, lineHeight: 1 }}>9</div>
              <div className="text-sm mt-2" style={{ color: '#6B7280' }}>fit dimensions weighted by you</div>
            </div>
          </div>

        </div>
      </section>

      {/* ── Demo ────────────────────────────────────────────────────────── */}
      <section
        className="px-6 md:px-14 py-20"
        style={{ background: '#F3F4F6', borderTop: '2px solid #0D0D0D', borderBottom: '2px solid #0D0D0D' }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <p className="text-xs font-semibold uppercase mb-12"
             style={{ color: '#9CA3AF', letterSpacing: '0.2em' }}>
            Sample output
          </p>

          {/* Wide card */}
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderLeft: '5px solid #DC2626' }}>
            <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">

              {/* Col 1: school + probability */}
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <span className="font-mono text-xs font-semibold tracking-widest uppercase px-2.5 py-1"
                        style={{ color: '#DC2626', border: '1px solid #DC2626' }}>
                    Reach
                  </span>
                </div>
                <div className="text-xl font-semibold mb-1" style={{ color: '#0D0D0D' }}>University of Michigan</div>
                <div className="text-sm mb-8" style={{ color: '#9CA3AF' }}>Ann Arbor, MI</div>
                <div>
                  <div className="text-xs mb-2" style={{ color: '#9CA3AF' }}>Admission probability</div>
                  <div className="font-mono font-medium mb-1" style={{ fontSize: '2.2rem', color: '#2563EB' }}>22–31%</div>
                  <div className="font-mono text-xs" style={{ color: '#9CA3AF' }}>Source: CDS 2023–24</div>
                </div>
              </div>

              {/* Col 2: fit score + bar */}
              <div>
                <div className="text-xs mb-2" style={{ color: '#9CA3AF' }}>Fit score</div>
                <div className="font-mono font-medium mb-6" style={{ fontSize: '3rem', color: '#0D0D0D', lineHeight: 1 }}>
                  84<span style={{ fontSize: '1.25rem', color: '#9CA3AF' }}>/100</span>
                </div>
                <div className="flex gap-1 h-3 mb-3">
                  {DIM_BAR.map((c, i) => (
                    <div key={i} className="flex-1 rounded-sm" style={{ background: c }} />
                  ))}
                </div>
                <div className="font-mono text-xs" style={{ color: '#9CA3AF' }}>9 fit dimensions · your weights</div>
              </div>

              {/* Col 3: tags + rationale + CTA placeholder */}
              <div className="flex flex-col justify-between">
                <div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="text-xs px-2.5 py-1 font-medium"
                          style={{ background: '#DCFCE7', color: '#15803D' }}>Strong CS research</span>
                    <span className="text-xs px-2.5 py-1 font-medium"
                          style={{ background: '#DCFCE7', color: '#15803D' }}>Merit aid available</span>
                    <span className="text-xs px-2.5 py-1 font-medium"
                          style={{ background: '#FEF3C7', color: '#92400E' }}>Out-of-state pool competitive</span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>
                    Research fit and affordability offset geographic disadvantage; probability constrained by out-of-state selectivity.
                  </p>
                </div>
                <div className="mt-6">
                  <div className="text-sm text-center py-3 font-medium cursor-default select-none"
                       style={{ border: '1px solid #E5E7EB', color: '#D1D5DB' }}>
                    View strategy →
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section className="px-6 md:px-14 py-20" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h2 className="text-2xl mb-16" style={{ fontFamily: 'var(--font-dm-serif, Georgia, serif)', color: '#0D0D0D' }}>
          How it works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:divide-x divide-[#E5E7EB]">
          <div className="pb-10 md:pb-0 md:pr-12">
            <div className="font-mono text-xs mb-6" style={{ color: '#2563EB', letterSpacing: '0.1em' }}>01</div>
            <div className="text-lg font-medium mb-3" style={{ color: '#0D0D0D' }}>Enter your stats and what matters to you</div>
            <div className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>GPA, test scores, intended major, budget ceiling, location. Four steps, about 8 minutes.</div>
          </div>
          <div className="py-10 md:py-0 md:px-12">
            <div className="font-mono text-xs mb-6" style={{ color: '#9CA3AF', letterSpacing: '0.1em' }}>02</div>
            <div className="text-lg font-medium mb-3" style={{ color: '#0D0D0D' }}>We score 60 schools against your criteria</div>
            <div className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>Nine fit dimensions, weighted exactly as you specify. Data from CDS, Scorecard, Clery Act.</div>
          </div>
          <div className="pt-10 md:pt-0 md:pl-12">
            <div className="font-mono text-xs mb-6" style={{ color: '#9CA3AF', letterSpacing: '0.1em' }}>03</div>
            <div className="text-lg font-medium mb-3" style={{ color: '#0D0D0D' }}>Get honest odds and a strategy for each</div>
            <div className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>Probability ranges, never single-point estimates. A 400-word strategy brief per school.</div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────── */}
      <section className="px-6 md:px-14 py-24" style={{ background: '#0D0D0D' }}>
        <div
          className="flex flex-col md:flex-row items-start md:items-center justify-between gap-10"
          style={{ maxWidth: '1200px', margin: '0 auto' }}
        >
          <div>
            <h2
              className="mb-3"
              style={{
                fontFamily: 'var(--font-dm-serif, Georgia, serif)',
                fontSize: 'clamp(1.8rem,3.5vw,2.6rem)',
                color: '#F9FAFB',
              }}
            >
              Stop guessing. See where you actually stand.
            </h2>
            <p className="text-base" style={{ color: '#6B7280' }}>Takes about 8 minutes. No account needed.</p>
          </div>
          <Link
            href="/intake"
            className="inline-block px-10 py-4 text-base font-semibold hover:opacity-90 transition-opacity whitespace-nowrap"
            style={{ background: '#2563EB', color: '#fff' }}
          >
            Build my list with honest odds →
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="px-6 md:px-14 py-7" style={{ background: '#0D0D0D', borderTop: '1px solid #1F2937' }}>
        <div className="font-mono text-xs" style={{ maxWidth: '1200px', margin: '0 auto', color: '#374151' }}>
          Data sources: College Scorecard 2023–24 · Common Data Sets 2023–24 · Clery Act Reports 2022
        </div>
      </footer>

    </div>
  )
}
