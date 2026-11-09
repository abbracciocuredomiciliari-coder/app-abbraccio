/** @type {import('tailwindcss').Config} */
export default {
  // Nessun reset globale: Tailwind convive con styles.css esistente.
  corePlugins: {
    preflight: false,
  },
  // Prefisso "tw-" per evitare qualunque collisione con classi CSS esistenti.
  prefix: 'tw-',
  content: [
    './index.html',
    './src/pages/*.tsx',
    './src/components/**/*.tsx',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          // Palette centrale: deve restare allineata a styles.css (:root --brand-*)
          50: '#edf4ea', 100: '#dcebdc', 200: '#bcdcc0', 300: '#8fc49a',
          500: '#417f52', 600: '#2b6b3e', 700: '#1f5c33', 800: '#154a27',
          DEFAULT: '#1f5c33',
          dark: '#154a27',
          light: '#417f52',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'Manrope', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
