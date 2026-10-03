const c = (v) => `rgb(var(--${v}) / <alpha-value>)`;

module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: c("bg"),
        star: c("star"),
        ink: c("ink"),
        accent: c("accent"),
        surface: c("surface"),
        glass: c("glass"),
        "glass-line": c("glass-line"),
      },
      fontFamily: { mono: ["SpaceMono_400Regular"] },
      keyframes: {
        bob: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "float-in": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0px)" },
        },
      },
      animation: {
        bob: "bob 6s ease-in-out infinite",
        "float-in": "float-in 0.5s ease-out both",
      },
    },
  },
};
