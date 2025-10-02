/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Default border color token used by `@apply border-border` in base styles
        border: "#a0a0a0",
        // GPix palette v2
        // Primary: Deep Indigo (#1c2c4a)
        primary: {
          50: "#f2f4f9",
          100: "#e0e5f1",
          200: "#b9c2dc",
          300: "#8f9ec6",
          400: "#5f759f",
          500: "#1c2c4a",
          600: "#17233d",
          700: "#121b30",
          800: "#0d1323",
          900: "#070b15",
        },
        // Secondary: Harbor Blue (#2f4858)
        secondary: {
          50: "#f3f6f8",
          100: "#e2eaef",
          200: "#c5d4dd",
          300: "#a8bdcb",
          400: "#6f95a7",
          500: "#2f4858",
          600: "#263b48",
          700: "#1d2e38",
          800: "#142128",
          900: "#0c1519",
        },
        // Accent: Sage Mist (#7d8e81)
        accent: {
          50: "#f5f7f5",
          100: "#e8eeea",
          200: "#d2ddd5",
          300: "#bbcbbf",
          400: "#a4b9a9",
          500: "#7d8e81",
          600: "#677468",
          700: "#525b51",
          800: "#3d433c",
          900: "#282d28",
        },
        // Neutrals: Soft Alloy (#c6c7ca -> #a0a0a0 scale)
        cream: {
          50: "#f7f7f8",
          100: "#ececed",
          200: "#d9d9dc",
          300: "#c6c7ca",
          400: "#aeb0b4",
          500: "#96999e",
          600: "#7c7f83",
          700: "#64666a",
          800: "#4b4d50",
          900: "#333537",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        display: ["Poppins", "sans-serif"],
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        countdown: "countdown 1s ease-in-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        countdown: {
          "0%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.2)", opacity: "0.8" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
