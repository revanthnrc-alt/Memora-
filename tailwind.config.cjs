/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        dusk: {
          deep: '#1A1423',
          mid: '#2D2438',
          glass: 'rgba(45, 36, 56, 0.6)',
          border: 'rgba(255, 255, 255, 0.06)',
        },
        sunset: {
          rose: '#D4A5A5',
          lavender: '#B8A9C9',
          peach: '#E8C4A0',
          plum: '#9D8AA5',
          amber: '#C9B896',
        },
        coral: '#E07A7A',
        ivory: '#F5F0E8',
        mist: '#A8A0B4',
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        body: ['Outfit', 'sans-serif'],
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      borderRadius: {
        'menu': '22px',
        'glass': '16px',
      },
      boxShadow: {
        'dusk': '0 8px 32px rgba(120, 100, 140, 0.15)',
        'glow-rose': '0 4px 16px rgba(212, 165, 165, 0.25)',
        'glow-coral': '0 4px 20px rgba(224, 122, 122, 0.35)',
      },
      animation: {
        'fade-up': 'fadeSlideUp 0.5s ease-out',
        'fade-down': 'fadeSlideDown 0.6s ease-out',
        'ambient': 'ambientShift 12s ease-in-out infinite',
        'text-pulse': 'textPulse 2.5s ease-in-out infinite',
      },
      keyframes: {
        fadeSlideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeSlideDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        ambientShift: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        textPulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      backdropBlur: {
        'glass': '16px',
      },
    },
  },
  plugins: [],
};
