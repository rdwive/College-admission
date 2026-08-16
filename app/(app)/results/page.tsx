'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import * as SliderPrimitive from '@radix-ui/react-slider'
import * as Dialog from '@radix-ui/react-dialog'
import { useProfile } from '@/lib/ProfileContext'
import { StudentProfile } from '@/lib/types'
import {
  rerank,
  autoNormalizeWeights,
  RankedSchool,
  RerankResult,
  WeightVector,
  DimensionKey,
} from '@/lib/rerank'
import { track } from '@/lib/analytics'
import posthog from 'posthog-js'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DimensionScores {
  prestige: number | null
  affordability: number | null
  safety: number | null
  diversity: number | null
  career_outcomes: number | null
  campus_culture: number | null
  mental_health_support: number | null
  climate: number | null
  research_opportunities: number | null
}

interface SchoolResult {
  name: string
  state: string
  probability_low: number
  probability_high: number
  probability_source: string
  fit_score: number
  dimension_scores: DimensionScores
  dimension_notes: Record<string, string>
  strengths: string[]
  gaps: string[]
  rationale: string
}

interface SchoolList {
  reach: SchoolResult[]
  target: SchoolResult[]
  likely: SchoolResult[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_CONFIG = {
  reach:  { label: 'Reach',  color: '#E8593C' },
  target: { label: 'Target', color: '#D4900A' },
  likely: { label: 'Likely', color: '#2A8C5A' },
} as const

const DIMENSION_KEYS: DimensionKey[] = [
  'prestige', 'affordability', 'safety', 'diversity', 'career_outcomes',
  'campus_culture', 'mental_health_support', 'climate', 'research_opportunities',
]

const DIMENSION_LABELS: Record<DimensionKey, string> = {
  prestige:              'Prestige',
  affordability:         'Affordability',
  safety:                'Campus Safety',
  diversity:             'Diversity',
  career_outcomes:       'Career Outcomes',
  campus_culture:        'Campus Culture',
  mental_health_support: 'Mental Health',
  climate:               'Climate',
  research_opportunities:'Research',
}

const LOADING_MESSAGES = [
  'Retrieving school data…',
  'Scoring fit dimensions…',
  'Generating your list…',
]

const DEFAULT_EQUAL_WEIGHTS: WeightVector = DIMENSION_KEYS.reduce(
  (acc, k, i) => ({ ...acc, [k]: i < 8 ? 11 : 12 }),
  {} as WeightVector
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number | null): string {
  if (score === null) return '#EDECEA'
  if (score >= 7)     return '#2A8C5A'
  if (score >= 4)     return '#D4900A'
  return '#E8593C'
}

function flattenList(list: SchoolList): SchoolResult[] {
  return [...list.reach, ...list.target, ...list.likely]
}

// ─── DeepDiveDrawer ───────────────────────────────────────────────────────────

function DeepDiveDrawer({
  school,
  tier,
  profile,
  onClose,
}: {
  school: RankedSchool
  tier: keyof typeof TIER_CONFIG
  profile: StudentProfile
  onClose: () => void
}) {
  const [strategyText, setStrategyText] = useState('')
  const [streamStatus, setStreamStatus] = useState<'loading' | 'streaming' | 'done' | 'error'>('loading')
  const [saved, setSaved] = useState(false)

  const { label, color } = TIER_CONFIG[tier]

  useEffect(() => {
    const savedList = JSON.parse(sessionStorage.getItem('savedSchools') ?? '[]') as string[]
    setSaved(savedList.includes(school.name))
    doStream()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [school.name])

  async function doStream() {
    setStrategyText('')
    setStreamStatus('loading')
    try {
      const res = await fetch('/api/deep-dive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-POSTHOG-DISTINCT-ID': posthog.get_distinct_id() ?? '',
        },
        body: JSON.stringify({ profile, school, tier }),
      })
      if (!res.ok || !res.body) throw new Error('Stream failed')

      setStreamStatus('streaming')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setStrategyText(prev => prev + decoder.decode(value, { stream: true }))
      }
      setStreamStatus('done')
      track.strategyBriefCompleted(school.name, tier)
    } catch (e) {
      posthog.captureException(e)
      setStreamStatus('error')
    }
  }

  function toggleSaved() {
    const savedList = JSON.parse(sessionStorage.getItem('savedSchools') ?? '[]') as string[]
    const next = saved
      ? savedList.filter(s => s !== school.name)
      : [...savedList, school.name]
    sessionStorage.setItem('savedSchools', JSON.stringify(next))
    if (saved) {
      track.schoolUnsaved(school.name, tier)
    } else {
      track.schoolSaved(school.name, tier)
    }
    setSaved(!saved)
  }

  // Render strategy text: split on ## section headers
  function renderStrategyText() {
    const parts = strategyText.split(/^##\s*/m).filter(Boolean)
    if (parts.length === 0) {
      return <p className="text-sm text-[#1A1917] leading-relaxed whitespace-pre-wrap">{strategyText}</p>
    }
    return parts.map((section, i) => {
      const newlineIdx = section.indexOf('\n')
      const header = newlineIdx !== -1 ? section.slice(0, newlineIdx).trim() : section.trim()
      const body   = newlineIdx !== -1 ? section.slice(newlineIdx + 1).trim() : ''
      return (
        <div key={i} className="mb-5">
          {header && (
            <div className="text-xs font-semibold text-[#A09D98] uppercase tracking-wider mb-2">
              {header}
            </div>
          )}
          {body && (
            <p className="text-sm text-[#1A1917] leading-relaxed whitespace-pre-wrap">{body}</p>
          )}
        </div>
      )
    })
  }

  return (
    <Dialog.Root open onOpenChange={open => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40" />
        <Dialog.Content
          className="fixed right-0 top-0 h-full w-[520px] bg-white z-50 flex flex-col overflow-hidden shadow-2xl"
          style={{ boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}
          onInteractOutside={e => e.preventDefault()}
        >
          {/* Drawer header */}
          <div className="flex items-start justify-between px-6 py-5 border-b border-[#E2E0DC]">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Dialog.Title className="text-lg font-bold text-[#1A1917] leading-tight">
                  {school.name}
                </Dialog.Title>
                <span
                  className="text-xs font-medium px-2 py-0.5 text-white shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {label}
                </span>
              </div>
              <div className="font-mono text-[#2D5BE3] font-medium">
                {school.probability_low}–{school.probability_high}%
              </div>
              <div className="text-xs text-[#A09D98]">
                admission probability · {school.probability_source}
              </div>
            </div>
            <Dialog.Close className="ml-4 mt-1 text-[#A09D98] hover:text-[#1A1917] text-2xl leading-none font-light shrink-0">
              ×
            </Dialog.Close>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {/* Per-dimension breakdown */}
            <div className="mb-6">
              <div className="text-xs font-semibold text-[#A09D98] uppercase tracking-wider mb-3">
                Fit Dimensions
              </div>
              <div className="space-y-2.5">
                {DIMENSION_KEYS.map(key => {
                  const score = school.dimension_scores[key]
                  const note  = school.dimension_notes[key]
                  const isCurated = key === 'campus_culture' || key === 'mental_health_support'
                  const isNull    = score === null
                  return (
                    <div key={key} className="flex items-start gap-3">
                      <div
                        className="w-2 h-2 rounded-sm mt-1.5 shrink-0"
                        style={{ backgroundColor: scoreColor(score) }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-[#1A1917] font-medium">
                            {DIMENSION_LABELS[key]}
                          </span>
                          <span className="font-mono text-xs text-[#6B6963]">
                            {isNull ? '—' : `${score}/10`}
                          </span>
                          {isCurated && !isNull && (
                            <span className="text-xs italic text-[#A09D98]">curated summary</span>
                          )}
                          {isNull && (
                            <span className="text-xs italic text-[#A09D98]">limited data</span>
                          )}
                        </div>
                        {note && (
                          <div className="text-xs text-[#6B6963] mt-0.5 leading-relaxed">{note}</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="border-t border-[#E2E0DC] mb-6" />

            {/* Strategy brief */}
            <div>
              <div className="text-xs font-semibold text-[#A09D98] uppercase tracking-wider mb-4">
                Application Strategy
              </div>

              {streamStatus === 'loading' && (
                <div className="flex items-center gap-3 py-8 text-[#6B6963]">
                  <div className="w-5 h-5 border-2 border-[#2D5BE3] border-t-transparent rounded-full animate-spin shrink-0" />
                  <span className="text-sm">Building your strategy for {school.name}…</span>
                </div>
              )}

              {streamStatus === 'error' && (
                <div>
                  <div className="text-sm text-[#C0392B] mb-3">Failed to generate strategy brief.</div>
                  <button
                    onClick={doStream}
                    className="text-sm text-[#2D5BE3] border border-[#2D5BE3] px-4 py-1.5 hover:bg-[#2D5BE3] hover:text-white transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}

              {(streamStatus === 'streaming' || streamStatus === 'done') && (
                <div>
                  {renderStrategyText()}
                  {streamStatus === 'streaming' && (
                    <span className="inline-block w-1.5 h-4 bg-[#2D5BE3] animate-pulse align-text-bottom" />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer: Add to my list */}
          <div className="border-t border-[#E2E0DC] p-4">
            <button
              type="button"
              onClick={toggleSaved}
              className={`w-full py-2.5 text-sm font-medium transition-colors border ${
                saved
                  ? 'bg-[#E6F4EE] text-[#2A8C5A] border-[#2A8C5A]'
                  : 'bg-white text-[#1A1917] border-[#E2E0DC] hover:border-[#2D5BE3] hover:text-[#2D5BE3]'
              }`}
            >
              {saved ? '✓ Added to my list' : 'Add to my list'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ─── School card ──────────────────────────────────────────────────────────────

function DimensionBar({
  scores,
  weights,
}: {
  scores: DimensionScores
  weights: WeightVector
}) {
  return (
    <div className="flex gap-0.5 mb-3 h-2">
      {DIMENSION_KEYS.map(key => {
        const isZero = weights[key] === 0
        return (
          <div
            key={key}
            className="flex-1 rounded-sm"
            style={{
              backgroundColor: isZero ? '#EDECEA' : scoreColor(scores[key]),
              opacity: isZero ? 0.4 : 1,
            }}
            title={
              isZero
                ? `${DIMENSION_LABELS[key]}: not weighted`
                : `${DIMENSION_LABELS[key]}: ${scores[key] !== null ? `${scores[key]}/10` : 'No data'}`
            }
          />
        )
      })}
    </div>
  )
}

function SchoolCard({
  school,
  tier,
  weights,
  onViewStrategy,
}: {
  school: RankedSchool
  tier: keyof typeof TIER_CONFIG
  weights: WeightVector
  onViewStrategy: () => void
}) {
  const { label, color } = TIER_CONFIG[tier]
  const nullCount = DIMENSION_KEYS.filter(k => school.dimension_scores[k] === null).length
  const hasLimitedData = nullCount >= 2

  return (
    <div
      className="bg-white border border-[#E2E0DC] mb-4 p-5"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      {school.dataWarning && (
        <div
          className="text-xs px-3 py-2 mb-3 -mx-5 -mt-5 border-b"
          style={{ backgroundColor: '#FFFBEB', color: '#B36B00', borderColor: '#FDE68A' }}
        >
          Some factors you&apos;re weighing have no verified data for this school — fit score may be less reliable
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-[#1A1917]">{school.name}</h3>
          <div className="text-sm text-[#6B6963]">{school.state}</div>
        </div>
        <div className="flex items-center gap-2 mt-0.5 shrink-0 ml-4">
          {hasLimitedData && (
            <span className="text-xs text-[#A09D98] border border-[#E2E0DC] px-2 py-0.5">
              Limited data
            </span>
          )}
          <span className="text-xs font-medium px-2 py-0.5 text-white" style={{ backgroundColor: color }}>
            {label}
          </span>
        </div>
      </div>

      <div className="flex items-start gap-8 mb-3">
        <div>
          <div className="font-mono text-[#2D5BE3] text-xl font-medium">
            {school.probability_low}–{school.probability_high}%
          </div>
          <div className="text-xs text-[#A09D98] mt-0.5">
            admission probability · {school.probability_source}
          </div>
        </div>
        <div>
          <div className="font-mono text-[#1A1917] text-xl font-medium">
            {school.reranked_score}/100
          </div>
          <div className="text-xs text-[#A09D98] mt-0.5">fit score</div>
        </div>
      </div>

      <DimensionBar scores={school.dimension_scores} weights={weights} />

      <div className="flex flex-wrap gap-1.5 mb-3">
        {school.strengths.slice(0, 3).map((s, i) => (
          <span key={i} className="text-xs px-2 py-0.5"
            style={{ backgroundColor: '#E6F4EE', color: '#2A8C5A' }}>{s}</span>
        ))}
        {school.gaps.slice(0, 2).map((g, i) => (
          <span key={i} className="text-xs px-2 py-0.5"
            style={{ backgroundColor: '#FFF3E0', color: '#B36B00' }}>{g}</span>
        ))}
      </div>

      <p className="text-sm text-[#6B6963] mb-4">{school.rationale}</p>

      <button
        type="button"
        className="text-sm text-[#2D5BE3] border border-[#2D5BE3] px-4 py-1.5 hover:bg-[#2D5BE3] hover:text-white transition-colors"
        onClick={onViewStrategy}
      >
        View strategy
      </button>
    </div>
  )
}

function TierSection({
  tier,
  schools,
  weights,
  onViewStrategy,
}: {
  tier: keyof typeof TIER_CONFIG
  schools: RankedSchool[]
  weights: WeightVector
  onViewStrategy: (school: RankedSchool, tier: keyof typeof TIER_CONFIG) => void
}) {
  if (schools.length === 0) return null
  const { label, color } = TIER_CONFIG[tier]
  return (
    <section className="mb-10">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-[#1A1917]">{label}</h2>
        <span className="text-sm text-[#6B6963]">
          {schools.length} school{schools.length !== 1 ? 's' : ''}
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: color, opacity: 0.4 }} />
      </div>
      {schools.map((school, i) => (
        <SchoolCard
          key={`${school.name}-${i}`}
          school={school}
          tier={tier}
          weights={weights}
          onViewStrategy={() => onViewStrategy(school, tier)}
        />
      ))}
    </section>
  )
}

// ─── Loading / Error states ───────────────────────────────────────────────────

function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="w-8 h-8 border-2 border-[#2D5BE3] border-t-transparent rounded-full animate-spin mb-6" />
      <div className="text-base text-[#1A1917] font-medium mb-2">{message}</div>
      <div className="text-sm text-[#A09D98]">This takes about 15–20 seconds</div>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="text-[#C0392B] text-base font-medium mb-2">Something went wrong</div>
      <div className="text-sm text-[#6B6963] mb-6 text-center max-w-sm">{message}</div>
      <button
        onClick={onRetry}
        className="bg-[#2D5BE3] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#2448c0] transition-colors"
      >
        Try again
      </button>
    </div>
  )
}

// ─── Left panel sub-components ────────────────────────────────────────────────

function ProfileSummary({ profile }: { profile: StudentProfile }) {
  const testScore = profile.sat_score
    ? `SAT ${profile.sat_score}`
    : profile.act_score
    ? `ACT ${profile.act_score}`
    : profile.test_optional
    ? 'Test-optional'
    : 'No score'

  return (
    <div className="mb-5 pb-5 border-b border-[#E2E0DC]">
      <div className="text-xs font-semibold text-[#A09D98] uppercase tracking-wider mb-3">
        Your Profile
      </div>
      <div className="space-y-1.5 text-sm">
        <div><span className="text-[#A09D98]">GPA: </span>
          <span className="text-[#1A1917] font-medium">
            {profile.gpa} ({profile.gpa_scale?.replace(/_/g, ' ')})
          </span>
        </div>
        <div><span className="text-[#A09D98]">Test: </span>
          <span className="text-[#1A1917] font-medium">{testScore}</span>
        </div>
        <div><span className="text-[#A09D98]">State: </span>
          <span className="text-[#1A1917] font-medium">{profile.state}</span>
        </div>
        {profile.intended_major && (
          <div><span className="text-[#A09D98]">Major: </span>
            <span className="text-[#1A1917] font-medium">{profile.intended_major}</span>
          </div>
        )}
        {profile.budget_ceiling && (
          <div><span className="text-[#A09D98]">Budget: </span>
            <span className="text-[#1A1917] font-medium">{profile.budget_ceiling}/yr</span>
          </div>
        )}
      </div>
    </div>
  )
}

function DimensionSlidersPanel({
  weights,
  onWeightCommit,
  onReset,
}: {
  weights: WeightVector
  onWeightCommit: (key: DimensionKey, value: number) => void
  onReset: () => void
}) {
  const [dragging, setDragging] = useState<Partial<WeightVector>>({})

  function displayValue(key: DimensionKey): number {
    return dragging[key] !== undefined ? dragging[key]! : weights[key]
  }

  return (
    <div>
      <div className="text-xs font-semibold text-[#A09D98] uppercase tracking-wider mb-3">
        Fit Factors
      </div>
      <div className="space-y-3">
        {DIMENSION_KEYS.map(key => {
          const val = displayValue(key)
          const isZero = val === 0
          return (
            <div key={key}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs flex-1 truncate transition-colors"
                  style={{ color: isZero ? '#A09D98' : '#6B6963' }}>
                  {DIMENSION_LABELS[key]}
                </span>
                {isZero && <span className="text-xs text-[#A09D98] shrink-0">not weighted</span>}
                <span className="text-xs w-6 text-right shrink-0 transition-colors"
                  style={{ color: isZero ? '#A09D98' : '#6B6963' }}>
                  {val}%
                </span>
              </div>
              <SliderPrimitive.Root
                className="relative flex items-center select-none touch-none h-4 cursor-pointer"
                min={0} max={100} step={1}
                value={[val]}
                onValueChange={([v]) => setDragging(prev => ({ ...prev, [key]: v }))}
                onValueCommit={([v]) => {
                  setDragging(prev => { const c = { ...prev }; delete c[key]; return c })
                  onWeightCommit(key, v)
                }}
              >
                <SliderPrimitive.Track className="bg-[#EDECEA] relative flex-1 rounded-full h-1.5">
                  <SliderPrimitive.Range
                    className="absolute rounded-full h-full transition-colors"
                    style={{ backgroundColor: isZero ? '#EDECEA' : '#2D5BE3' }}
                  />
                </SliderPrimitive.Track>
                <SliderPrimitive.Thumb
                  className="block w-3.5 h-3.5 rounded-full shadow focus:outline-none focus:ring-2 focus:ring-[#2D5BE3]"
                  style={{ backgroundColor: 'white', border: `2px solid ${isZero ? '#EDECEA' : '#2D5BE3'}` }}
                />
              </SliderPrimitive.Root>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-[#A09D98] mt-4 leading-relaxed">
        Setting a factor to 0 means it won&apos;t influence your results. Use this only if that
        factor genuinely doesn&apos;t matter to you.
      </p>
      <button type="button" onClick={onReset}
        className="mt-3 text-xs text-[#6B6963] hover:text-[#1A1917] underline">
        Reset to equal weights
      </button>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ResultsPage() {
  const router = useRouter()
  const { profile, hydrated } = useProfile()

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0)
  const [rawList, setRawList] = useState<SchoolList | null>(null)
  const [ranked, setRanked] = useState<RerankResult | null>(null)
  const [weights, setWeights] = useState<WeightVector>(DEFAULT_EQUAL_WEIGHTS)
  const [error, setError] = useState('')

  // Deep dive drawer state
  const [drawerSchool, setDrawerSchool] = useState<{
    school: RankedSchool
    tier: keyof typeof TIER_CONFIG
  } | null>(null)

  const profileRef = useRef<StudentProfile>(profile)

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchList = useCallback(async () => {
    setStatus('loading')
    setError('')
    setLoadingMsgIdx(0)
    const t0 = Date.now()
    try {
      const res = await fetch('/api/generate-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-POSTHOG-DISTINCT-ID': posthog.get_distinct_id() ?? '',
        },
        body: JSON.stringify(profileRef.current),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `Server error ${res.status}`)
      }
      const data = await res.json() as SchoolList
      const total = data.reach.length + data.target.length + data.likely.length
      track.listGenerationCompleted(Date.now() - t0, total)

      const allSchools = flattenList(data)
      const DIMENSION_KEYS_ALL = [
        'prestige', 'affordability', 'safety', 'diversity', 'career_outcomes',
        'campus_culture', 'mental_health_support', 'climate', 'research_opportunities',
      ] as const
      const fullDataSchools = allSchools.filter(s =>
        DIMENSION_KEYS_ALL.every(k => s.dimension_scores[k as keyof typeof s.dimension_scores] !== null)
      ).length
      track.dataCoverageLogged(total, fullDataSchools)

      setRawList(data)
      const profileWeights = profileRef.current.dimension_weights as WeightVector
      setWeights(profileWeights)
      setRanked(rerank(allSchools, profileWeights))
      setStatus('success')
    } catch (e) {
      posthog.captureException(e)
      setError(e instanceof Error ? e.message : 'Unknown error')
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (!profile.gpa || !profile.state) { router.push('/intake'); return }
    profileRef.current = profile
    fetchList()
  }, [hydrated]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status !== 'loading') return
    const t = setInterval(() => setLoadingMsgIdx(i => (i + 1) % LOADING_MESSAGES.length), 8000)
    return () => clearInterval(t)
  }, [status])

  // ── Slider callbacks ──────────────────────────────────────────────────────

  function handleWeightCommit(key: DimensionKey, newValue: number) {
    track.sliderMoved(key, weights[key], newValue)
    track.listAction('adjusted_weights')
    const newWeights = autoNormalizeWeights(weights, key, newValue)
    setWeights(newWeights)
    if (rawList) setRanked(rerank(flattenList(rawList), newWeights))
  }

  function handleResetWeights() {
    setWeights(DEFAULT_EQUAL_WEIGHTS)
    if (rawList) setRanked(rerank(flattenList(rawList), DEFAULT_EQUAL_WEIGHTS))
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const total = ranked
    ? ranked.reach.length + ranked.target.length + ranked.likely.length
    : 0

  return (
    <div className="min-[900px]:flex min-h-screen bg-[#F7F6F3]">
      {/* Deep dive drawer */}
      {drawerSchool && (
        <DeepDiveDrawer
          school={drawerSchool.school}
          tier={drawerSchool.tier}
          profile={profile}
          onClose={() => setDrawerSchool(null)}
        />
      )}

      {/* ── Left panel ─────────────────────────────────── */}
      <aside className="min-[900px]:w-[300px] min-[900px]:shrink-0 min-[900px]:sticky min-[900px]:top-0 min-[900px]:h-screen min-[900px]:overflow-y-auto bg-white border-b min-[900px]:border-b-0 min-[900px]:border-r border-[#E2E0DC] p-5">
        <ProfileSummary profile={profile} />
        {status === 'success' && (
          <DimensionSlidersPanel
            weights={weights}
            onWeightCommit={handleWeightCommit}
            onReset={handleResetWeights}
          />
        )}
        <div className="mt-5 pt-5 border-t border-[#E2E0DC]">
          <a href="/intake" className="text-xs text-[#6B6963] hover:text-[#1A1917]">← Edit profile</a>
        </div>
      </aside>

      {/* ── Right panel ────────────────────────────────── */}
      <main className="flex-1 px-4 min-[900px]:px-8 py-8 min-h-screen">
        {status === 'loading' && <LoadingState message={LOADING_MESSAGES[loadingMsgIdx]} />}
        {status === 'error'   && <ErrorState message={error} onRetry={fetchList} />}

        {status === 'success' && ranked && (
          <>
            <div className="mb-8">
              <h1 className="font-serif text-3xl text-[#1A1917] mb-1">Your College List</h1>
              <div className="text-sm text-[#6B6963]">
                {total} schools ·{' '}
                {[
                  ranked.reach.length  > 0 && `${ranked.reach.length} reach`,
                  ranked.target.length > 0 && `${ranked.target.length} target`,
                  ranked.likely.length > 0 && `${ranked.likely.length} likely`,
                ].filter(Boolean).join(', ')}
              </div>
            </div>

            {total === 0 ? (
              <div className="text-center py-16">
                <p className="text-[#1A1917] font-medium mb-2">No schools matched your profile</p>
                <p className="text-sm text-[#6B6963] mb-6 max-w-sm mx-auto">
                  Your preferences may be too narrow. Try broadening your geographic region,
                  size preference, or budget range.
                </p>
                <a href="/intake"
                  className="inline-block text-sm text-[#2D5BE3] border border-[#2D5BE3] px-5 py-2 hover:bg-[#2D5BE3] hover:text-white transition-colors">
                  Edit preferences
                </a>
              </div>
            ) : (
              <>
                <TierSection tier="reach"  schools={ranked.reach}
                  weights={weights} onViewStrategy={(school, tier) => { track.deepDiveOpened(school.name, tier); track.listAction('clicked_deep_dive'); setDrawerSchool({ school, tier }) }} />
                <TierSection tier="target" schools={ranked.target}
                  weights={weights} onViewStrategy={(school, tier) => { track.deepDiveOpened(school.name, tier); track.listAction('clicked_deep_dive'); setDrawerSchool({ school, tier }) }} />
                <TierSection tier="likely" schools={ranked.likely}
                  weights={weights} onViewStrategy={(school, tier) => { track.deepDiveOpened(school.name, tier); track.listAction('clicked_deep_dive'); setDrawerSchool({ school, tier }) }} />
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}
