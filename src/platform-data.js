import { createClient } from "@supabase/supabase-js";
export const LOCAL_KEY = "papeled-console-local-v1";
export const localMode = () =>
  localStorage.getItem("papeled-console-preview") === "true";
export function readLocal() {
  try {
    return (
      JSON.parse(localStorage.getItem(LOCAL_KEY)) || {
        products: [],
        events: [],
        quotes: [],
      }
    );
  } catch {
    return { products: [], events: [], quotes: [] };
  }
}
export function writeLocal(data) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
}
export async function connection() {
  const response = await fetch(
    new URL("./platform-config.json", document.baseURI).href,
    { cache: "no-store" },
  );
  if (!response.ok)
    throw Error("Não foi possível ler a configuração da plataforma.");
  const config = await response.json();
  if (!config.supabaseUrl || !config.supabaseAnonKey) return null;
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.supabaseUrl))
    throw Error("Use a URL HTTPS do projeto Supabase.");
  if (config.supabaseAnonKey.startsWith("sb_secret_"))
    throw Error("Use somente a chave pública do Supabase.");
  if (config.supabaseAnonKey.split(".").length === 3) {
    try {
      const payload = JSON.parse(
        atob(
          config.supabaseAnonKey
            .split(".")[1]
            .replace(/-/g, "+")
            .replace(/_/g, "/"),
        ),
      );
      if (payload.role !== "anon") throw Error();
    } catch {
      throw Error("A chave deve ser pública (anon), nunca service_role.");
    }
  }
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}
export function summarize(events, quotes, days) {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - days + 1);
  const rows = events.filter((e) => new Date(e.created_at) >= since),
    filteredQuotes = quotes.filter((q) => new Date(q.created_at) >= since);
  const series = Array.from({ length: days }, (_, i) => {
    const date = new Date(since);
    date.setUTCDate(date.getUTCDate() + i);
    const key = date.toISOString().slice(0, 10);
    return {
      day: key,
      visits: rows.filter(
        (e) => e.kind === "page_view" && e.created_at.slice(0, 10) === key,
      ).length,
      downloads: rows.filter(
        (e) => e.kind === "download" && e.created_at.slice(0, 10) === key,
      ).length,
    };
  });
  const map = new Map();
  for (const e of rows.filter((e) => e.kind === "download")) {
    const k = `${e.product_id || e.model_id}|${e.format}`;
    const p = map.get(k) || {
      model: e.model_id,
      product: e.product_id,
      format: e.format,
      total: 0,
    };
    p.total++;
    map.set(k, p);
  }
  return {
    visits: rows.filter((e) => e.kind === "page_view").length,
    views: rows.filter((e) => e.kind === "model_view").length,
    downloads: rows.filter((e) => e.kind === "download").length,
    quotes: filteredQuotes.length,
    series,
    top: [...map.values()].sort((a, b) => b.total - a.total).slice(0, 20),
  };
}
