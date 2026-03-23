import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sora: ["Sora", "sans-serif"],
      },
      colors: {
        brand: {
          bg: "#F0F4FF",
          surface: "#FFFFFF",
          border: "#E2E8F0",
          subtle: "#F8FAFC",
          sidebar: "#0F172A",
          "sidebar-active": "#1E3A5F",
          primary: "#6366F1",
          "text-primary": "#0F172A",
          "text-muted": "#64748B",
          "text-faint": "#94A3B8",
        },
      },
    },
  },
  plugins: [],
};

export default config;
