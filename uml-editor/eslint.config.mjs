import next from "eslint-config-next"

const nextConfig = Array.isArray(next) ? next : [next]

export default [
  // Next.js recommended rules
  ...nextConfig,

  // Project-specific overrides (keep lint strict but compatible with our patterns)
  {
    rules: {
      // This app uses the common "mounted" pattern to avoid hydration mismatch
      "react-hooks/set-state-in-effect": "off",

      // We allow quotes in Spanish/English UI strings without escaping noise
      "react/no-unescaped-entities": "off",

      // Some images are decorative; enforce alt in UI review instead of blocking CI
      "jsx-a11y/alt-text": "off",

      // This codebase intentionally uses stable callbacks; don't block builds on deps warnings
      "react-hooks/exhaustive-deps": "off",

      // Avoid purity rule false-positives in generated UI components
      "react-hooks/purity": "off",

      // Flat-config export style; not relevant for this repo
      "import/no-anonymous-default-export": "off",
    },
  },
]


