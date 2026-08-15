import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Marca — teal / verde-água
        brand: {
          DEFAULT: "#12A594",
          dark: "#0E8577",
          light: "#E6F7F4",
          50: "#F0FBF9",
        },
        // Destaque — magenta
        accent: {
          DEFAULT: "#DB2777",
          dark: "#BE185D",
          light: "#FCE7F3",
        },
        // Sidebar escura
        rail: {
          DEFAULT: "#15212B",
          hover: "#1E2E3A",
          muted: "#7E8C99",
        },
        // Superfícies / neutros
        surface: "#F4F6F8",
        line: "#E6EAEE",
        ink: {
          DEFAULT: "#1F2A33",
          muted: "#64748B",
          soft: "#94A3B8",
        },
        danger: "#E11D48",
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)",
        rail: "2px 0 16px rgba(0,0,0,.06)",
      },
      borderRadius: {
        xl2: "10px",
      },
    },
  },
  plugins: [],
};

export default config;
