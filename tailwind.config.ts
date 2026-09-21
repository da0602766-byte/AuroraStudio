import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bordo: { DEFAULT: "#5E1A2C", escuro: "#43111F", claro: "#7A2A3E" },
        marrom: { DEFAULT: "#3B2721", medio: "#6B5249", claro: "#9C8379" },
        ouro: { DEFAULT: "#A9843F", claro: "#D9BE86", palido: "#F1E4C8" },
        po: { DEFAULT: "#F8F0EC", escuro: "#EFE2DB" },
        linha: "#E3D2C9",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      maxWidth: { conteudo: "72rem" },
    },
  },
  plugins: [],
};

export default config;
