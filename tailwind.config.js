import tailwindcssRtl from 'tailwindcss-rtl'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Tajawal',
          'Segoe UI',
          'system-ui',
          'sans-serif',
        ],
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(1rem)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-0.5rem)' },
        },
        'ken-burns': {
          '0%': { transform: 'scale(1) translate(0, 0)' },
          '100%': { transform: 'scale(1.06) translate(-1%, -0.5%)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.65s ease-out both',
        'fade-in-up-slow': 'fade-in-up 0.85s ease-out both',
        'fade-in': 'fade-in 0.5s ease-out both',
        float: 'float 5s ease-in-out infinite',
        'ken-burns': 'ken-burns 22s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [tailwindcssRtl],
}
