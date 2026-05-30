import type { Metadata } from 'next'
import { DM_Serif_Display, DM_Sans, JetBrains_Mono } from 'next/font/google'
import { PostHogProvider } from './PostHogProvider'
import { ProfileProvider } from '@/lib/ProfileContext'
import './globals.css'

// ─── Fonts ────────────────────────────────────────────────────────────────────

const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-dm-serif',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'College Admission Strategist',
  description: 'Honest, data-grounded college list advice — personalized to your profile.',
}

// ─── Root layout ──────────────────────────────────────────────────────────────

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSerif.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}>
      <body>
        <PostHogProvider>
          <ProfileProvider>
            {children}
          </ProfileProvider>
        </PostHogProvider>
      </body>
    </html>
  )
}
