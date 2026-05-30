import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette — matches CLAUDE.md design tokens
        'bg-primary':   '#F7F6F3',
        'bg-surface':   '#FFFFFF',
        'bg-muted':     '#EDECEA',
        'text-primary': '#1A1917',
        'text-secondary':'#6B6963',
        'text-muted':   '#A09D98',
        accent:         '#2D5BE3',
        'tier-reach':   '#E8593C',
        'tier-target':  '#D4900A',
        'tier-likely':  '#2A8C5A',
        'tag-strength-bg':  '#E6F4EE',
        'tag-strength-text':'#2A8C5A',
        'tag-gap-bg':   '#FFF3E0',
        'tag-gap-text': '#B36B00',
        'warning-bg':   '#FFFBEB',
        'warning-text': '#B36B00',
        error:          '#C0392B',
        border:         '#E2E0DC',
      },
      fontFamily: {
        serif: ['var(--font-dm-serif)', 'Georgia', 'serif'],
        sans:  ['var(--font-dm-sans)',  'system-ui', 'sans-serif'],
        mono:  ['var(--font-jetbrains-mono)', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config
