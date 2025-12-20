module.exports = {
  test: {
    environment: "jsdom",
    include: ["components/**/__tests__/*.{test,spec}.{ts,tsx,js}"],
    globals: true,
    passWithNoTests: false,
  },
};
