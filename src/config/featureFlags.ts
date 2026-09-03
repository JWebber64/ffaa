function enabled(value: unknown) {
  return typeof value === "string" && ["1", "true", "on", "yes"].includes(value.trim().toLowerCase());
}

export const featureFlags = Object.freeze({
  nativeLeagueFoundation: import.meta.env.DEV || enabled(import.meta.env.VITE_NATIVE_LEAGUE_FOUNDATION),
});
