import posthog from 'posthog-js'

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: '/ingest',
  defaults: '2026-01-30',
  capture_exceptions: true,
  person_profiles: 'identified_only',
  capture_pageview: false,
  capture_pageleave: true,
  debug: process.env.NODE_ENV === 'development',
})
