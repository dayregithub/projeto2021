export const METRICS_EXCLUSION_KEY = "papeled-metrics-exclude-browser-v1";
export function isMetricsExcluded() {
  return localStorage.getItem(METRICS_EXCLUSION_KEY) === "yes";
}
export function setMetricsExcluded(excluded) {
  if (excluded) localStorage.setItem(METRICS_EXCLUSION_KEY, "yes");
  else localStorage.removeItem(METRICS_EXCLUSION_KEY);
}
