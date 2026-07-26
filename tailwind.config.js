/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Warm neutral ("moss") + deep green accent ("forest") + lime action
        // signal. Overdue is terracotta ("clay") — warm rather than alarming.
        moss: {
          50: '#f4f6f2',
          100: '#eef1ec',
          200: '#e6ebe2',
          300: '#dbe1d8',
          400: '#c3cdbd',
          500: '#9aa696',
          600: '#7b8878',
          700: '#5c6a58',
          800: '#3d4a39',
          900: '#26301f',
        },
        // Defined as CSS variables in index.css so the scale carries its own
        // dark values — see the note there. `<alpha-value>` keeps `/35` working.
        forest: {
          500: 'rgb(var(--forest-500) / <alpha-value>)',
          600: 'rgb(var(--forest-600) / <alpha-value>)',
          700: 'rgb(var(--forest-700) / <alpha-value>)',
        },
        lime: { 300: '#e0f8ab', 400: '#cff08a', 500: '#b8dd6c' },
        clay: { 100: '#fbe3da', 300: '#f2d7cd', 500: '#b8492c', 700: '#8f3a22' },
        amber: { 100: '#fdf6e9', 500: '#b3703a' },
        bark: { 600: '#38422e', 700: '#28311f', 800: '#1e2519', 900: '#161b13' },
        // Category tiles — recognition, never status.
        plant: { 100: '#e5f2dd', 500: '#4a7a3f' },
        health: { 100: '#fdeede', 500: '#b3703a' },
      },
      // 18 / 22 / 26 px rungs of the spacing scale. Tailwind ships 1, 2, 2.5 and
      // 3.5 but stops before these, and the design leans on all three.
      spacing: { 4.5: '1.125rem', 5.5: '1.375rem', 6.5: '1.625rem' },
      borderRadius: { card: '22px', hero: '26px', sheet: '28px' },
      boxShadow: {
        card: '0 1px 2px rgb(38 48 31 / 0.06)',
        sheet: '0 -12px 40px rgb(38 48 31 / 0.18)',
        pop: '0 12px 30px rgb(38 48 31 / 0.12)',
      },
      transitionTimingFunction: {
        settle: 'cubic-bezier(.2,.8,.2,1)',
        sheet: 'cubic-bezier(.32,.72,0,1)',
      },
      keyframes: {
        rollback: {
          '0%,100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
        riseIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        rollback: 'rollback 180ms ease-out',
        riseIn: 'riseIn 240ms cubic-bezier(.2,.8,.2,1)',
      },
    },
  },
  plugins: [],
}
