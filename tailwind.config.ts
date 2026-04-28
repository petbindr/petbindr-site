import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "bindr-navy":    "#1F3C5F",
        "bindr-teal":    "#74C4CD",
        "soft-teal":     "#B5DDDF",
        "warm-cream":    "#FBF8F3",
        "pure-white":    "#FFFFFF",
        "coral-cta":     "#FF6B5B",
        "coral-cta-hover": "#e55a4a",
        "charcoal":      "#1A1F2E",
        "slate-gray":    "#6B7785",
        "mist-gray":     "#E8ECEF",
        "success-green": "#4FAE7C",
        "alert-amber":   "#E5A547",
        "error-red":     "#D14545",
      },
      fontFamily: {
        fraunces: ["Fraunces", "serif"],
        inter: ["Inter", "sans-serif"],
      },
      fontSize: {
        "hero":    ["clamp(36px,6vw,72px)", { lineHeight: "1.05", letterSpacing: "-0.03em" }],
        "section": ["clamp(28px,4vw,48px)", { lineHeight: "1.1",  letterSpacing: "-0.02em" }],
      },
    },
  },
  plugins: [forms],
};

export default config;
