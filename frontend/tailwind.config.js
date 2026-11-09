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
          50: '#edf5f0', 100: '#d8e8df', 200: '#b9d5c6', 300: '#8abda4',
          500: '#4a9480', 600: '#2c7f6c', 700: '#1c7164', 800: '#15574d',
          DEFAULT: '#1c7164',
          dark: '#15574d',
          light: '#4a9480',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'Manrope', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
