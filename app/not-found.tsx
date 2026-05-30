import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#F7F6F3] px-6">
      <h1 className="font-serif text-4xl text-[#1A1917] mb-3">Page not found</h1>
      <p className="text-[#6B6963] text-sm mb-8">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link href="/" className="text-sm text-[#2D5BE3] hover:underline">
        ← Back to home
      </Link>
    </main>
  )
}
