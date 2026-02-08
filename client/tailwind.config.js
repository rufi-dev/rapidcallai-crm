/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefbf4",
          100: "#d6f5e3",
          200: "#b0eacb",
          300: "#7ddaad",
          400: "#48c48a",
          500: "#25a970",
          600: "#18895a",
          700: "#146e4a",
          800: "#13573c",
          900: "#114833",
          950: "#08281d",
        },
      },
    },
  },
  plugins: [],
};
