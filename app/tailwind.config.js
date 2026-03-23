/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#004ac6",
        "primary-dark": "#003ea8",
        "primary-light": "#dbe1ff",
        "primary-container": "#2563eb",
        secondary: "#1f6c3a",
        "secondary-container": "#a4f1b2",
        "on-secondary-container": "#24703e",
        surface: "#f8f9ff",
        "surface-low": "#eff4ff",
        "surface-container": "#e5eeff",
        "surface-high": "#dce9ff",
        "on-surface": "#0b1c30",
        "on-surface-variant": "#434655",
        "outline-variant": "#c3c6d7",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
}
