/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Default border color token used by `@apply border-border` in base styles
        border: "#e5e7eb", // Tailwind gray-200
        // GioPix brand palette
        // Primary: Teal (#239BA7)
        primary: {
          50: "#e9f7f9",
          100: "#d3eef2",
          200: "#a7dee5",
          300: "#7bcdd8",
          400: "#4fbccc",
          500: "#3ab0bf",
          600: "#239BA7",
          700: "#1c7e89",
          800: "#165f68",
          900: "#0f444b",
        },
        // Secondary: Gold (#E1AA36)
        secondary: {
          50: "#fff8e6",
          100: "#feefcc",
          200: "#fce19a",
          300: "#f8cf66",
          400: "#f0b93f",
          500: "#E1AA36",
          600: "#c6902f",
          700: "#a17325",
          800: "#7f591d",
          900: "#664617",
        },
        // Accent: Mint (#7ADAA5)
        accent: {
          50: "#f0fcf6",
          100: "#e3f8ee",
          200: "#c8f1de",
          300: "#a6e6c8",
          400: "#88dbb6",
          500: "#7ADAA5",
          600: "#5fc791",
          700: "#49a575",
          800: "#3b835d",
          900: "#2f684b",
        },
        // Cream / Surface: (#ECECBB)
        cream: {
          50: "#fdfdf2",
          100: "#fafae4",
          200: "#f3f3c9",
          300: "#ECECBB",
          400: "#e1e1a8",
          500: "#d0d08e",
          600: "#b1b16c",
          700: "#8c8c52",
          800: "#6e6e40",
          900: "#585833",
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
