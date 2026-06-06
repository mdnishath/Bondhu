/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0B141A',
        panel: '#111B21',
        panel2: '#1A242C',
        rowhover: '#202C33',
        rowactive: '#2A3942',
        bubin: '#202C33',
        bubout: '#005C4B',
        teal: '#00A884',
        green: '#25D366',
        blue: '#53BDEB',
        txt: '#E9EDEF',
        txtsoft: '#D1D7DB',
        muted: '#8696A0',
        muted2: '#667781',
        line: '#222E35',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        bn: ['Noto Sans Bengali', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
