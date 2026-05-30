'use client'

import { useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'

// ─── Pageview tracker (needs Suspense because of useSearchParams) ─────────────

function PageViewTracker() {
  const pathname  = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = window.location.origin + pathname +
      (searchParams.toString() ? '?' + searchParams.toString() : '')
    posthog.capture('$pageview', { $current_url: url })
  }, [pathname, searchParams])

  return null
}

// ─── Provider — wraps the app in the PostHog React context ───────────────────
// PostHog is initialized in instrumentation-client.ts (Next.js 15.3+ pattern).

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      {children}
    </PHProvider>
  )
}
