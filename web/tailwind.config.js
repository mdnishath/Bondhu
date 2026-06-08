/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Bondhu lime-green brand (matches the Android app design system)
        bg: '#0A0C0B',
        panel: '#14181A',
        panel2: '#1C2123',
        rowhover: '#161B1D',
        rowactive: '#202826',
        bubin: '#181D1F',
        bubout: '#2A3A1E',
        teal: '#A3E635',
        green: '#38EC48',
        blue: '#A3E635',
        txt: '#F1F4EF',
        txtsoft: '#D1D7DB',
        muted: '#93A08F',
        muted2: '#5E6A5C',
        line: '#1E2422',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        bn: ['Noto Sans Bengali', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
