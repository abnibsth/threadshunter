import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: "#0B0B0C",
        surface: {
          DEFAULT: "#151518",
          hover: "#1E1E22",
        },
        subtle: "#26262A",
        "accent-orange": {
          DEFAULT: "#FF6B00",
          hover: "#FF7A1A",
          deep: "#E04F00",
        },
        ink: {
          primary: "#FFFFFF",
          secondary: "#9E9EA6",
          muted: "#63636B",
        },
      },
      fontFamily: {
        sans: ["var(--font-plus-jakarta)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        "orange-glow": "0 0 25px rgba(255, 107, 0, 0.30)",
        "orange-glow-lg": "0 0 40px rgba(255, 107, 0, 0.35)",
        "card-sheen": "inset 0 1px 0 rgba(255, 255, 255, 0.04)",
      },
      backgroundImage: {
        "featured-orange": "linear-gradient(180deg, #FF6B00 0%, #E04F00 100%)",
        "ambient-glow":
          "radial-gradient(circle at 50% 0%, rgba(255, 107, 0, 0.14) 0%, rgba(11, 11, 12, 0) 60%)",
      },
    },
  },
  plugins: [],
};

export default config;
