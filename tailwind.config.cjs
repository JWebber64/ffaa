/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg0: "var(--bg0)",
        bg1: "var(--bg1)",
        panel: "var(--panel)",
        glass: "var(--glass)",
        stroke: "var(--stroke)",
        stroke2: "var(--stroke2)",
        fg0: "var(--fg0)",
        fg1: "var(--fg1)",
        fg2: "var(--fg2)",
        accent: "var(--accent)",
        accent2: "var(--accent2)",
        danger: "var(--danger)",
        success: "var(--success)",
        warning: "var(--warning)",
      },
      borderRadius: {
        sm: "var(--r-sm)",
        md: "var(--r-md)",
        lg: "var(--r-lg)",
        xl: "var(--r-xl)",
      },
      boxShadow: {
        s1: "var(--shadow1)",
        s2: "var(--shadow2)",
        s3: "var(--shadow3)",
      },
    },
  },
  plugins: [],
};
