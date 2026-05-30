import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-[#F7F6F3]">
      <div className="max-w-2xl w-full text-center">
        {/* Headline in DM Serif Display */}
        <h1 className="font-serif text-5xl text-[#1A1917] mb-4 leading-tight">
          Find the right colleges.<br />Know exactly why.
        </h1>
        <p className="text-lg text-[#6B6963] mb-10 leading-relaxed">
          Data-grounded, honest college list advice — personalized to your academic profile,
          goals, and fit preferences. No fluff. No guarantees. Just clarity.
        </p>

        {/* Primary CTA */}
        <Link
          href="/intake"
          className="inline-block bg-[#2D5BE3] text-white px-10 py-4 text-base font-medium hover:bg-[#2448c0] transition-colors"
        >
          Build my college list
        </Link>

        {/* Proof points */}
        <div className="mt-16 grid grid-cols-3 gap-8 text-left">
          <div>
            <div className="text-sm font-semibold text-[#1A1917] mb-1.5">Grounded in verified data</div>
            <div className="text-sm text-[#6B6963] leading-relaxed">
              Every statistic is sourced — CDS 2023–24, College Scorecard, Clery Act. Nothing fabricated.
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-[#1A1917] mb-1.5">Honest about uncertainty</div>
            <div className="text-sm text-[#6B6963] leading-relaxed">
              Admission probability shown as a range, never a single number. Uncertainty is shown, not hidden.
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-[#1A1917] mb-1.5">Strategy, not just scores</div>
            <div className="text-sm text-[#6B6963] leading-relaxed">
              Per-school action plans tailored to your specific strengths, gaps, and application context.
            </div>
          </div>
        </div>
      </div>

      <footer className="mt-16 text-xs text-[#A09D98] text-center">
        Data sources: College Scorecard 2023–24 · Common Data Sets 2023–24 · Clery Act Reports 2022
      </footer>
    </main>
  )
}
