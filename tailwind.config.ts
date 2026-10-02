import type { Config } from 'tailwindcss';

/**
 * Flowboard design tokens. Everything visual in the app is expressed with these
 * utilities — there are no custom CSS rules beyond the three Tailwind directives.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f0ff',
          100: '#e4e4fe',
          200: '#cbcbfc',
          300: '#a8a8f7',
          400: '#8282ef',
          500: '#6767e4',
          600: '#5b5bd6',
          700: '#4646b4',
          800: '#393991',
          900: '#2f2f73',
        },
        canvas: '#f7f7f9',
        surface: '#ffffff',
        sidebar: '#16161d',
        'sidebar-hover': '#23232d',
        'sidebar-active': '#2d2d3a',
        ink: { DEFAULT: '#1c1c24', muted: '#5f6170', subtle: '#8e909e', inverse: '#ececf1' },
        line: { DEFAULT: '#e6e6eb', strong: '#d4d4dc' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        card: '0.625rem',
        panel: '0.875rem',
        pill: '999px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,16,32,0.06), 0 1px 1px rgba(16,16,32,0.04)',
        'card-hover': '0 4px 12px rgba(16,16,32,0.08), 0 1px 3px rgba(16,16,32,0.06)',
        lift: '0 12px 28px rgba(16,16,32,0.18), 0 2px 6px rgba(16,16,32,0.10)',
        drawer: '-12px 0 32px rgba(16,16,32,0.12)',
        pop: '0 8px 24px rgba(16,16,32,0.12), 0 1px 3px rgba(16,16,32,0.08)',
      },
      keyframes: {
        'slide-in': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'toast-in': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        'slide-in': 'slide-in 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'fade-in': 'fade-in 150ms ease-out',
        'toast-in': 'toast-in 180ms ease-out',
      },
    },
  },
  plugins: [],
} satisfies Config;
