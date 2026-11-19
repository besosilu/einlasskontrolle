import type { Config } from 'tailwindcss';

// Die slate-Skala läuft über CSS-Variablen (src/index.css), damit der Dark-Modus sie umkehren kann.
const slateScale = Object.fromEntries(
  [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((n) => [n, `rgb(var(--slate-${n}) / <alpha-value>)`])
);

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        slate: slateScale,
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1e40af',
        },
        accent: {
          500: '#0891b2',
          600: '#0e7490',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
