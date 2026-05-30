'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useProfile } from '@/lib/ProfileContext'
import { ClarifyingAnswer } from '@/lib/types'
import { track } from '@/lib/analytics'

export default function ClarifyPage() {
  const router = useRouter()
  const { updateProfile } = useProfile()

  const [questions, setQuestions] = useState<string[]>([])
  const [answers, setAnswers] = useState<string[]>([])
  const [showSkipWarning, setShowSkipWarning] = useState(false)

  useEffect(() => {
    const stored = sessionStorage.getItem('clarifyQuestions')
    if (!stored) {
      // If no questions in sessionStorage, redirect to results (or back to intake)
      router.push('/results')
      return
    }
    try {
      const parsed = JSON.parse(stored) as string[]
      setQuestions(parsed)
      setAnswers(parsed.map(() => ''))
    } catch {
      router.push('/results')
    }
  }, [router])

  function setAnswer(idx: number, value: string) {
    setAnswers(prev => prev.map((a, i) => (i === idx ? value : a)))
  }

  function handleContinue() {
    const clarifyingAnswers: ClarifyingAnswer[] = questions.map((q, i) => ({
      question: q,
      answer: answers[i] ?? '',
    }))
    const answeredCount = answers.filter(a => a.trim().length > 0).length
    track.clarifyAnswersSubmitted(questions.length, answeredCount)
    updateProfile({ clarifying_answers: clarifyingAnswers })
    sessionStorage.removeItem('clarifyQuestions')
    router.push('/results')
  }

  function handleSkip() {
    track.clarifySkipped()
    sessionStorage.removeItem('clarifyQuestions')
    updateProfile({ clarifying_answers: [] })
    router.push('/results')
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-[#F7F6F3] flex items-center justify-center">
        <div className="text-[#6B6963] text-sm">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      <div className="max-w-xl mx-auto px-6 py-16">
        <h1 className="font-serif text-3xl text-[#1A1917] mb-2">A few quick follow-ups</h1>
        <p className="text-sm text-[#6B6963] mb-10">
          Your answers will make your college list significantly more accurate.
        </p>

        <div className="space-y-6">
          {questions.map((question, idx) => (
            <div key={idx} className="bg-white border border-[#E2E0DC] p-6">
              <label className="block text-sm font-medium text-[#1A1917] mb-3">
                {question}
              </label>
              <textarea
                rows={3}
                className="w-full border border-[#E2E0DC] px-3 py-2 text-sm text-[#1A1917] bg-white focus:outline-none focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3] resize-none"
                placeholder="Your answer…"
                value={answers[idx] ?? ''}
                onChange={e => setAnswer(idx, e.target.value)}
              />
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <div>
            {showSkipWarning ? (
              <div className="text-xs text-[#A09D98] max-w-xs">
                Skipping means your list may be less tailored. You can still generate it.{' '}
                <button
                  onClick={handleSkip}
                  className="text-[#C0392B] hover:underline"
                >
                  Skip anyway
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSkipWarning(true)}
                className="text-sm text-[#A09D98] hover:text-[#6B6963]"
              >
                Skip and generate anyway
              </button>
            )}
          </div>

          <button
            onClick={handleContinue}
            className="bg-[#2D5BE3] text-white px-8 py-3 text-sm font-medium hover:bg-[#2448c0] transition-colors"
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  )
}
