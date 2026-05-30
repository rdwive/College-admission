'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { useProfile } from '@/lib/ProfileContext'
import { StudentProfile, ECEntry, DEFAULT_PROFILE } from '@/lib/types'
import { track } from '@/lib/analytics'
import posthog from 'posthog-js'

// ─── Static data ──────────────────────────────────────────────────────────────

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV',
  'NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN',
  'TX','UT','VT','VA','WA','WV','WI','WY','DC',
]

const MAJORS = [
  'Undecided',
  'Biology / Life Sciences',
  'Business / Finance',
  'Chemical Engineering',
  'Chemistry',
  'Civil Engineering',
  'Communications / Journalism',
  'Computer Science',
  'Economics',
  'Education',
  'Electrical Engineering',
  'Engineering (General / Undecided)',
  'English / Literature',
  'Environmental Science',
  'Fine Arts / Studio Art',
  'History',
  'International Relations',
  'Mathematics / Statistics',
  'Mechanical Engineering',
  'Music',
  'Nursing',
  'Philosophy',
  'Physics',
  'Political Science',
  'Pre-Law',
  'Pre-Medicine',
  'Psychology',
  'Public Health',
  'Sociology / Anthropology',
  'Theater / Performing Arts',
  'Other',
]

const REGIONS = ['Northeast', 'Southeast', 'Midwest', 'Southwest', 'West', 'International']

const DIMENSIONS: { key: keyof StudentProfile['dimension_weights']; label: string }[] = [
  { key: 'prestige', label: 'Prestige / Rankings' },
  { key: 'affordability', label: 'Affordability' },
  { key: 'safety', label: 'Campus Safety' },
  { key: 'diversity', label: 'Diversity & Inclusion' },
  { key: 'career_outcomes', label: 'Career Outcomes' },
  { key: 'campus_culture', label: 'Campus Culture' },
  { key: 'mental_health_support', label: 'Mental Health Support' },
  { key: 'climate', label: 'Climate / Weather' },
  { key: 'research_opportunities', label: 'Research Opportunities' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-[#1A1917] mb-1">
      {children}
      {required && <span className="text-[#C0392B] ml-1">*</span>}
    </label>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full border border-[#E2E0DC] px-3 py-2 text-sm text-[#1A1917] bg-white focus:outline-none focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3] ${props.className ?? ''}`}
    />
  )
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full border border-[#E2E0DC] px-3 py-2 text-sm text-[#1A1917] bg-white focus:outline-none focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3] ${props.className ?? ''}`}
    >
      {children}
    </select>
  )
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full border border-[#E2E0DC] px-3 py-2 text-sm text-[#1A1917] bg-white focus:outline-none focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3] resize-none ${props.className ?? ''}`}
    />
  )
}

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="mb-5">{children}</div>
}

function DimensionSlider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  // value is 0–100 stored in profile; display as 0–100%
  return (
    <div className="flex items-center gap-4 mb-4">
      <span className="w-44 text-sm text-[#1A1917] shrink-0">{label}</span>
      <SliderPrimitive.Root
        className="relative flex items-center flex-1 select-none touch-none h-5"
        min={0}
        max={100}
        step={1}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      >
        <SliderPrimitive.Track className="bg-[#EDECEA] relative flex-1 rounded-full h-1.5">
          <SliderPrimitive.Range className="absolute bg-[#2D5BE3] rounded-full h-full" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block w-4 h-4 bg-white border-2 border-[#2D5BE3] rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2D5BE3]" />
      </SliderPrimitive.Root>
      <span className="w-10 text-sm text-right text-[#6B6963] shrink-0">{value}%</span>
    </div>
  )
}

// ─── Progress Indicator ───────────────────────────────────────────────────────

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-[#6B6963]">Step {step} of 4</span>
        <span className="text-sm text-[#6B6963]">
          {['Academic Profile', 'Background', 'Extracurriculars', 'Fit Preferences'][step - 1]}
        </span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4].map(s => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? 'bg-[#2D5BE3]' : 'bg-[#E2E0DC]'}`}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IntakePage() {
  const router = useRouter()
  const { profile, updateProfile, hydrated } = useProfile()

  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  // Single form state object for all steps — pre-filled from saved profile on return visits
  const [form, setForm] = useState<StudentProfile>(DEFAULT_PROFILE)

  // After ProfileContext hydrates from sessionStorage, pre-fill the form if a profile exists
  useEffect(() => {
    if (hydrated && profile.gpa !== null) {
      setForm(profile)
    }
  }, [hydrated]) // eslint-disable-line react-hooks/exhaustive-deps

  function setField<K extends keyof StudentProfile>(key: K, value: StudentProfile[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function setDimension(key: keyof StudentProfile['dimension_weights'], value: number) {
    setForm(prev => ({
      ...prev,
      dimension_weights: { ...prev.dimension_weights, [key]: value },
    }))
  }

  // EC helpers
  function addEC() {
    if (form.extracurriculars.length >= 5) return
    setField('extracurriculars', [
      ...form.extracurriculars,
      { activity: '', role: 'participant', hours_per_week: null, years: null },
    ])
  }

  function updateEC(idx: number, updates: Partial<ECEntry>) {
    setField(
      'extracurriculars',
      form.extracurriculars.map((ec, i) => (i === idx ? { ...ec, ...updates } : ec))
    )
  }

  function removeEC(idx: number) {
    setField('extracurriculars', form.extracurriculars.filter((_, i) => i !== idx))
  }

  // Geographic preference toggle
  function toggleRegion(region: string) {
    const current = form.geographic_preference
    setField(
      'geographic_preference',
      current.includes(region) ? current.filter(r => r !== region) : [...current, region]
    )
  }

  // Validation
  function validateRequired(): string[] {
    const errs: string[] = []
    if (form.gpa === null) errs.push('GPA is required')
    if (!form.gpa_scale) errs.push('GPA scale is required')
    if (!form.state) errs.push('State is required')
    if (!form.sat_score && !form.act_score && !form.test_optional) {
      errs.push('Enter an SAT or ACT score, or indicate you are applying test-optional')
    }
    return errs
  }

  function isReadyToSubmit() {
    return validateRequired().length === 0
  }

  async function handleSubmit() {
    const errs = validateRequired()
    if (errs.length > 0) {
      setErrors(errs)
      setStep(1) // Return to first step with required fields
      window.scrollTo(0, 0)
      return
    }

    setErrors([])
    setSubmitting(true)

    try {
      // Persist full profile to context + sessionStorage
      updateProfile(form)

      const res = await fetch('/api/clarify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-POSTHOG-DISTINCT-ID': posthog.get_distinct_id() ?? '',
        },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Request failed')
      }

      const data = await res.json() as { questions: string[] }
      track.clarifyQuestionsTriggered(data.questions.length)

      if (data.questions.length === 0) {
        // Profile is complete — go straight to results
        router.push('/results')
      } else {
        // Save questions and go to clarify page
        sessionStorage.setItem('clarifyQuestions', JSON.stringify(data.questions))
        router.push('/clarify')
      }
    } catch (e) {
      posthog.captureException(e)
      setErrors([e instanceof Error ? e.message : 'Something went wrong. Please try again.'])
      setSubmitting(false)
    }
  }

  // ─── Step 1: Academic Profile ────────────────────────────────────────────────
  function renderStep1() {
    return (
      <div>
        <h2 className="text-xl font-semibold text-[#1A1917] mb-6">Academic Profile</h2>

        <div className="grid grid-cols-2 gap-4">
          <FieldGroup>
            <Label required>GPA</Label>
            <Input
              type="number"
              min={0}
              max={5.5}
              step={0.01}
              placeholder="e.g. 3.85"
              value={form.gpa ?? ''}
              onChange={e => setField('gpa', e.target.value === '' ? null : parseFloat(e.target.value))}
            />
          </FieldGroup>

          <FieldGroup>
            <Label required>GPA Scale</Label>
            <Select
              value={form.gpa_scale ?? ''}
              onChange={e => setField('gpa_scale', (e.target.value || null) as StudentProfile['gpa_scale'])}
            >
              <option value="">Select scale</option>
              <option value="4.0_unweighted">4.0 Unweighted</option>
              <option value="4.0_weighted">4.0 Weighted</option>
              <option value="5.0_weighted">5.0 Weighted</option>
            </Select>
          </FieldGroup>
        </div>

        <FieldGroup>
          <Label>Class Rank</Label>
          <Select
            value={form.class_rank ?? ''}
            onChange={e => setField('class_rank', (e.target.value || null) as StudentProfile['class_rank'])}
          >
            <option value="">Not sure / prefer not to say</option>
            <option value="top_10">Top 10%</option>
            <option value="top_25">Top 25%</option>
            <option value="top_50">Top 50%</option>
            <option value="not_reported">School doesn&apos;t report rank</option>
          </Select>
        </FieldGroup>

        <div className="grid grid-cols-2 gap-4">
          <FieldGroup>
            <Label>SAT Score</Label>
            <Input
              type="number"
              min={400}
              max={1600}
              step={10}
              placeholder="e.g. 1450"
              value={form.sat_score ?? ''}
              onChange={e => setField('sat_score', e.target.value === '' ? null : parseInt(e.target.value))}
            />
          </FieldGroup>

          <FieldGroup>
            <Label>ACT Score</Label>
            <Input
              type="number"
              min={1}
              max={36}
              step={1}
              placeholder="e.g. 32"
              value={form.act_score ?? ''}
              onChange={e => setField('act_score', e.target.value === '' ? null : parseInt(e.target.value))}
            />
          </FieldGroup>
        </div>

        <FieldGroup>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.test_optional}
              onChange={e => setField('test_optional', e.target.checked)}
              className="w-4 h-4 accent-[#2D5BE3]"
            />
            <span className="text-sm text-[#1A1917]">I&apos;m applying test-optional (no SAT/ACT submitted)</span>
          </label>
        </FieldGroup>

        <div className="grid grid-cols-2 gap-4">
          <FieldGroup>
            <Label>AP / IB Courses Taken</Label>
            <Select
              value={form.ap_ib_count ?? ''}
              onChange={e => setField('ap_ib_count', (e.target.value || null) as StudentProfile['ap_ib_count'])}
            >
              <option value="">Select</option>
              <option value="0">0</option>
              <option value="1-3">1–3</option>
              <option value="4-6">4–6</option>
              <option value="7+">7 or more</option>
            </Select>
          </FieldGroup>
        </div>

        <FieldGroup>
          <Label>AP / IB Scores Summary <span className="text-[#A09D98] font-normal">(optional)</span></Label>
          <Input
            type="text"
            maxLength={100}
            placeholder="e.g. 5 on Calc BC, 4 on Physics C, 3 on US History"
            value={form.ap_ib_scores_summary ?? ''}
            onChange={e => setField('ap_ib_scores_summary', e.target.value || null)}
          />
          <div className="text-xs text-[#A09D98] mt-1">Max 100 characters</div>
        </FieldGroup>
      </div>
    )
  }

  // ─── Step 2: Background ──────────────────────────────────────────────────────
  function renderStep2() {
    return (
      <div>
        <h2 className="text-xl font-semibold text-[#1A1917] mb-6">Background</h2>

        <div className="grid grid-cols-2 gap-4">
          <FieldGroup>
            <Label required>State of Residence</Label>
            <Select
              value={form.state ?? ''}
              onChange={e => setField('state', e.target.value || null)}
            >
              <option value="">Select state</option>
              {US_STATES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </FieldGroup>

          <FieldGroup>
            <Label>High School Type</Label>
            <Select
              value={form.school_type ?? ''}
              onChange={e => setField('school_type', (e.target.value || null) as StudentProfile['school_type'])}
            >
              <option value="">Select</option>
              <option value="public">Public</option>
              <option value="private">Private</option>
              <option value="charter">Charter</option>
              <option value="homeschool">Home school</option>
            </Select>
          </FieldGroup>
        </div>

        <FieldGroup>
          <Label>Intended Major or Area of Interest</Label>
          <Select
            value={form.intended_major ?? ''}
            onChange={e => setField('intended_major', e.target.value || null)}
          >
            <option value="">Select or type below</option>
            {MAJORS.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </Select>
        </FieldGroup>

        <div className="grid grid-cols-2 gap-4">
          <FieldGroup>
            <Label>First-Generation College Student?</Label>
            <Select
              value={form.first_gen === null ? '' : form.first_gen ? 'yes' : 'no'}
              onChange={e => {
                const v = e.target.value
                setField('first_gen', v === '' ? null : v === 'yes')
              }}
            >
              <option value="">Prefer not to say</option>
              <option value="yes">Yes — I would be the first in my family</option>
              <option value="no">No</option>
            </Select>
          </FieldGroup>

          <FieldGroup>
            <Label>Citizenship Status</Label>
            <Select
              value={form.citizenship ?? ''}
              onChange={e => setField('citizenship', (e.target.value || null) as StudentProfile['citizenship'])}
            >
              <option value="">Select</option>
              <option value="us_citizen">US Citizen</option>
              <option value="permanent_resident">Permanent Resident</option>
              <option value="international">International Student</option>
            </Select>
          </FieldGroup>
        </div>

        <FieldGroup>
          <Label>Estimated Household Income <span className="text-[#A09D98] font-normal">(for financial aid accuracy)</span></Label>
          <Select
            value={form.income_bracket ?? ''}
            onChange={e => setField('income_bracket', (e.target.value || null) as StudentProfile['income_bracket'])}
          >
            <option value="">Prefer not to say</option>
            <option value="<30k">Under $30,000</option>
            <option value="30-48k">$30,000 – $48,000</option>
            <option value="48-75k">$48,000 – $75,000</option>
            <option value="75-110k">$75,000 – $110,000</option>
            <option value="110k+">Over $110,000</option>
          </Select>
        </FieldGroup>

        <FieldGroup>
          <Label>Special Circumstances <span className="text-[#A09D98] font-normal">(optional)</span></Label>
          <Textarea
            rows={3}
            maxLength={300}
            placeholder="e.g. My school doesn't report GPA. I had a medical hardship junior year. I'm a legacy applicant at one school."
            value={form.special_circumstances ?? ''}
            onChange={e => setField('special_circumstances', e.target.value || null)}
          />
          <div className="text-xs text-[#A09D98] mt-1">{(form.special_circumstances ?? '').length}/300 characters</div>
        </FieldGroup>
      </div>
    )
  }

  // ─── Step 3: Extracurriculars ────────────────────────────────────────────────
  function renderStep3() {
    return (
      <div>
        <h2 className="text-xl font-semibold text-[#1A1917] mb-2">Extracurriculars & Achievements</h2>
        <p className="text-sm text-[#6B6963] mb-6">All fields in this step are optional.</p>

        {/* EC entries */}
        <div className="mb-5">
          <Label>Activities (up to 5)</Label>
          {form.extracurriculars.map((ec, idx) => (
            <div key={idx} className="border border-[#E2E0DC] p-4 mb-3 bg-white">
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs font-medium text-[#6B6963] uppercase tracking-wide">Activity {idx + 1}</span>
                <button
                  type="button"
                  onClick={() => removeEC(idx)}
                  className="text-xs text-[#C0392B] hover:underline"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <Label>Activity Name</Label>
                  <Input
                    type="text"
                    placeholder="e.g. Robotics Club, Chess Team"
                    value={ec.activity}
                    onChange={e => updateEC(idx, { activity: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Role / Level</Label>
                  <Select
                    value={ec.role}
                    onChange={e => updateEC(idx, { role: e.target.value as ECEntry['role'] })}
                  >
                    <option value="participant">Participant / Member</option>
                    <option value="leader">Leader / Officer</option>
                    <option value="founder">Founder / Creator</option>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Hours per Week</Label>
                  <Input
                    type="number"
                    min={0}
                    max={168}
                    placeholder="e.g. 5"
                    value={ec.hours_per_week ?? ''}
                    onChange={e => updateEC(idx, { hours_per_week: e.target.value === '' ? null : parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Years Involved</Label>
                  <Input
                    type="number"
                    min={0}
                    max={8}
                    placeholder="e.g. 3"
                    value={ec.years ?? ''}
                    onChange={e => updateEC(idx, { years: e.target.value === '' ? null : parseFloat(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          ))}

          {form.extracurriculars.length < 5 && (
            <button
              type="button"
              onClick={addEC}
              className="text-sm text-[#2D5BE3] hover:underline"
            >
              + Add activity
            </button>
          )}
        </div>

        <FieldGroup>
          <Label>Honors & Awards <span className="text-[#A09D98] font-normal">(optional)</span></Label>
          <Textarea
            rows={2}
            maxLength={200}
            placeholder="e.g. National Merit Semifinalist, AP Scholar with Distinction, State Science Fair 2nd place"
            value={form.honors ?? ''}
            onChange={e => setField('honors', e.target.value || null)}
          />
        </FieldGroup>

        <FieldGroup>
          <Label>Work Experience or Internships <span className="text-[#A09D98] font-normal">(optional)</span></Label>
          <Textarea
            rows={2}
            maxLength={200}
            placeholder="e.g. Part-time barista 15 hrs/week since junior year; summer internship at local engineering firm"
            value={form.work_experience ?? ''}
            onChange={e => setField('work_experience', e.target.value || null)}
          />
        </FieldGroup>

        <FieldGroup>
          <Label>Athletics Level <span className="text-[#A09D98] font-normal">(optional)</span></Label>
          <Select
            value={form.athletics ?? ''}
            onChange={e => setField('athletics', (e.target.value || null) as StudentProfile['athletics'])}
          >
            <option value="">Select</option>
            <option value="d1_recruited">Division I — Actively recruited</option>
            <option value="varsity">Varsity</option>
            <option value="jv">JV</option>
            <option value="club">Club / Recreational</option>
            <option value="none">No athletics</option>
          </Select>
        </FieldGroup>
      </div>
    )
  }

  // ─── Step 4: Fit Preferences ─────────────────────────────────────────────────
  function renderStep4() {
    return (
      <div>
        <h2 className="text-xl font-semibold text-[#1A1917] mb-2">Fit Preferences</h2>
        <p className="text-sm text-[#6B6963] mb-6">
          All fields are optional. Sliders set how much each factor influences your list.
        </p>

        {/* Dimension sliders */}
        <div className="mb-6">
          <Label>What matters most to you?</Label>
          <div className="mt-3">
            {DIMENSIONS.map(({ key, label }) => (
              <DimensionSlider
                key={key}
                label={label}
                value={form.dimension_weights[key]}
                onChange={v => setDimension(key, v)}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FieldGroup>
            <Label>Climate Preference</Label>
            <Select
              value={form.climate_preference ?? ''}
              onChange={e => setField('climate_preference', (e.target.value || null) as StudentProfile['climate_preference'])}
            >
              <option value="">No preference</option>
              <option value="warm">Warm (avg &gt;60°F)</option>
              <option value="mild">Mild (50–60°F)</option>
              <option value="cold">Cold (&lt;50°F is fine)</option>
            </Select>
          </FieldGroup>

          <FieldGroup>
            <Label>School Size</Label>
            <Select
              value={form.school_size_preference ?? ''}
              onChange={e => setField('school_size_preference', (e.target.value || null) as StudentProfile['school_size_preference'])}
            >
              <option value="">No preference</option>
              <option value="small">Small (&lt;5,000 students)</option>
              <option value="medium">Medium (5,000–15,000)</option>
              <option value="large">Large (&gt;15,000)</option>
            </Select>
          </FieldGroup>

          <FieldGroup>
            <Label>Location Type</Label>
            <Select
              value={form.location_type ?? ''}
              onChange={e => setField('location_type', (e.target.value || null) as StudentProfile['location_type'])}
            >
              <option value="">No preference</option>
              <option value="urban">Urban (city campus)</option>
              <option value="suburban">Suburban</option>
              <option value="rural">Rural / College town</option>
            </Select>
          </FieldGroup>

          <FieldGroup>
            <Label>Budget Ceiling <span className="text-[#A09D98] font-normal">(annual family contribution)</span></Label>
            <Select
              value={form.budget_ceiling ?? ''}
              onChange={e => setField('budget_ceiling', (e.target.value || null) as StudentProfile['budget_ceiling'])}
            >
              <option value="">No limit specified</option>
              <option value="need_max_aid">Need maximum available aid</option>
              <option value="<10k">Under $10,000/yr</option>
              <option value="10-25k">$10,000 – $25,000/yr</option>
              <option value="25-50k">$25,000 – $50,000/yr</option>
              <option value="50k+">$50,000+/yr is fine</option>
            </Select>
          </FieldGroup>
        </div>

        <FieldGroup>
          <Label>Geographic Preference <span className="text-[#A09D98] font-normal">(select all that apply)</span></Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {REGIONS.map(region => (
              <button
                key={region}
                type="button"
                onClick={() => toggleRegion(region)}
                className={`px-3 py-1.5 text-sm border transition-colors ${
                  form.geographic_preference.includes(region)
                    ? 'bg-[#2D5BE3] text-white border-[#2D5BE3]'
                    : 'bg-white text-[#1A1917] border-[#E2E0DC] hover:border-[#2D5BE3]'
                }`}
              >
                {region}
              </button>
            ))}
          </div>
          <div className="text-xs text-[#A09D98] mt-2">Leave empty to consider schools in any region.</div>
        </FieldGroup>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  const ready = isReadyToSubmit()

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <a href="/" className="text-sm text-[#6B6963] hover:text-[#1A1917]">← Back to home</a>
        </div>

        <h1 className="font-serif text-3xl text-[#1A1917] mb-6">Build your college list</h1>

        <ProgressBar step={step} />

        {/* Errors */}
        {errors.length > 0 && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200">
            <div className="text-sm font-medium text-[#C0392B] mb-1">Please fix the following:</div>
            <ul className="list-disc list-inside">
              {errors.map((err, i) => (
                <li key={i} className="text-sm text-[#C0392B]">{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Form content */}
        <div className="bg-white border border-[#E2E0DC] p-8">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#E2E0DC]">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                className="text-sm text-[#6B6963] hover:text-[#1A1917]"
              >
                ← Back
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-4">
              {step < 4 ? (
                <button
                  type="button"
                  onClick={() => { track.intakeStepCompleted(step as 1|2|3|4); setStep(s => s + 1) }}
                  className="bg-[#1A1917] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#2D2B29] transition-colors"
                >
                  Next →
                </button>
              ) : (
                <div className="flex flex-col items-end gap-2">
                  {!ready && (
                    <div className="text-xs text-[#A09D98] text-right">
                      Complete required fields in Steps 1 & 2 to generate your list
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!ready || submitting}
                    className={`px-8 py-3 text-sm font-medium transition-colors ${
                      ready && !submitting
                        ? 'bg-[#2D5BE3] text-white hover:bg-[#2448c0]'
                        : 'bg-[#EDECEA] text-[#A09D98] cursor-not-allowed'
                    }`}
                  >
                    {submitting ? 'Analyzing profile…' : 'Generate my list →'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Save note */}
        <div className="mt-4 text-center text-xs text-[#A09D98]">
          Your progress is saved automatically in this browser session.
        </div>
      </div>
    </div>
  )
}
