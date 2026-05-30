'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { StudentProfile, DEFAULT_PROFILE } from './types'

interface ProfileContextType {
  profile: StudentProfile
  hydrated: boolean  // true after sessionStorage has been read on mount
  updateProfile: (updates: Partial<StudentProfile>) => void
  resetProfile: () => void
}

const ProfileContext = createContext<ProfileContextType | null>(null)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<StudentProfile>(DEFAULT_PROFILE)
  const [hydrated, setHydrated] = useState(false)

  // Load from sessionStorage on mount (client-only), then mark hydrated
  useEffect(() => {
    const saved = sessionStorage.getItem('studentProfile')
    if (saved) {
      try {
        setProfile(JSON.parse(saved) as StudentProfile)
      } catch {
        // Ignore corrupted data
      }
    }
    setHydrated(true)
  }, [])

  // Persist to sessionStorage on every change
  useEffect(() => {
    sessionStorage.setItem('studentProfile', JSON.stringify(profile))
  }, [profile])

  function updateProfile(updates: Partial<StudentProfile>) {
    setProfile(prev => ({ ...prev, ...updates }))
  }

  function resetProfile() {
    setProfile(DEFAULT_PROFILE)
    sessionStorage.removeItem('studentProfile')
  }

  return (
    <ProfileContext.Provider value={{ profile, hydrated, updateProfile, resetProfile }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider')
  return ctx
}
