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
          50: '#f4f7f1', 100: '#e0edda', 200: '#cfe3cc', 300: '#9dc4a4',
          500: '#3d8368', 600: '#26715a', 700: '#174c3c', 800: '#123b2e',
          DEFAULT: '#174c3c',
          dark: '#123b2e',
          light: '#3d8368',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'Manrope', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
