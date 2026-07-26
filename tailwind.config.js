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
        // Paleta 2 (projekt claude.ai/design, tokens/palette-2.css) — pięć
        // kotwic: krem #FFF8EC, piasek #DCCCAC, szałwia #99AD7A, zieleń
        // #546B41, bordo #492828. Skale policzone w OKLCh; nie poprawiaj
        // pojedynczych stopni bez przeliczenia par WCAG z tego pliku.
        //
        // Nazwy skal zostały historyczne (moss/lime/clay), wartości są nowe:
        // moss = len (neutralne), lime = jasne stopnie sage, clay = bordo.
        brand: {
          forest: '#546b41', // sage-600, kotwica "zieleń" — znak na jasnym
          leaf: '#99ad7a', // sage-400, kotwica "szałwia"
          sand: '#dcccac', // len-300, kotwica "piasek" — znak na ciemnym
          bordo: '#492828', // kotwica zaległości
        },
        // len — ciepłe neutralne, hue 82.
        moss: {
          50: '#fff8ec',
          100: '#f9f1e3',
          200: '#ebdec7',
          300: '#dcccac',
          400: '#c0af90',
          500: '#92846b',
          600: '#6d624d',
          700: '#4f4637',
          800: '#332d21',
          900: '#201b12',
        },
        // Role o odwróconym kierunku w trybie ciemnym — zmienne w index.css.
        // `<alpha-value>` keeps `/35` working.
        forest: {
          500: 'rgb(var(--forest-500) / <alpha-value>)',
          600: 'rgb(var(--forest-600) / <alpha-value>)',
          700: 'rgb(var(--forest-700) / <alpha-value>)',
        },
        hero: 'rgb(var(--hero) / <alpha-value>)',
        cta: {
          DEFAULT: 'rgb(var(--cta) / <alpha-value>)',
          hover: 'rgb(var(--cta-hover) / <alpha-value>)',
        },
        onaccent: 'rgb(var(--on-accent) / <alpha-value>)',
        // jasne stopnie sage — akcent na ciemnych powierzchniach.
        lime: { 300: '#c6d6b5', 400: '#aec399', 500: '#99ad7a' },
        // bordo — zaległości. 500 znacznik, 700 (=bordo-800) tekst.
        clay: { 100: '#ffe6e5', 300: '#f7d0ce', 500: '#a85f60', 700: '#492828' },
        // przygaszone złoto na ostrzeżenia — celowo nie bordo.
        amber: { 100: '#f7edd2', 500: '#8a6a21' },
        // kora — tryb ciemny, zielonawa ciemność (hue 129, niska chroma).
        bark: { 600: '#3a3f34', 700: '#272c23', 800: '#191d15', 900: '#0f120b' },
        // Category tiles — recognition, never status.
        plant: { 100: '#e2ecd7', 500: '#42542e' },
        health: { 100: '#ebdec7', 500: '#4f4637' },
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
