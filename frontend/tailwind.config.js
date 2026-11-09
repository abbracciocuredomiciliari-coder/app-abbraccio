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
          50: '#eef6f2', 100: '#d9ebe4', 200: '#bfe0d6', 300: '#8ccab8',
          500: '#2e927f', 600: '#23826f', 700: '#1c7164', 800: '#155a50',
          DEFAULT: '#1c7164',
          dark: '#155a50',
          light: '#2e927f',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'Manrope', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
