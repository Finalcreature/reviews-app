// Simple config proxy (avoid importing `vitest/config` in environments
// where the package resolution may fail). The CJS config `vitest.config.cjs`
// is the authoritative config; this file exists only for tooling that
// expects a TS config file to be present.

export default {
  test: {
    environment: "jsdom",
    include: ["components/**/__tests__/*.{test,spec}.{ts,tsx,js}"],
    globals: true,
    passWithNoTests: false,
  },
};
