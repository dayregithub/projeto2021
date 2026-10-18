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
export function summarize(events, quotes, days, now = new Date()) {
  if (![0, 7, 30, 60, 90, 365].includes(days)) throw Error("Período inválido.");
  const until = new Date(now),
    since = new Date(until);
  since.setUTCHours(0, 0, 0, 0);
  if (days === 0) {
    for (const row of [...events, ...quotes]) {
      const date = new Date(row.created_at);
      if (date < since) since.setTime(date.getTime());
    }
    since.setUTCHours(0, 0, 0, 0);
  } else since.setUTCDate(since.getUTCDate() - days + 1);
  const rows = events.filter(
    (e) => new Date(e.created_at) >= since && new Date(e.created_at) <= until,
  );
  const filteredQuotes = quotes.filter(
    (q) => new Date(q.created_at) >= since && new Date(q.created_at) <= until,
  );
  const dates = new Map(),
    top = new Map();
  let visits = 0,
    views = 0,
    downloads = 0;
  for (const e of rows) {
    const day = new Date(e.created_at).toISOString().slice(0, 10),
      counts = dates.get(day) || { visits: 0, downloads: 0 };
    if (e.kind === "page_view") {
      visits++;
      counts.visits++;
    }
    if (e.kind === "model_view") views++;
    if (e.kind === "download") {
      downloads++;
      counts.downloads++;
      const key = `${e.product_id || e.model_id}|${e.format}`;
      const record = top.get(key) || {
        model: e.model_id,
        product: e.product_id,
        format: e.format,
        total: 0,
      };
      record.total++;
      top.set(key, record);
    }
    dates.set(day, counts);
  }
  const length =
    Math.floor(
      (Date.UTC(
        until.getUTCFullYear(),
        until.getUTCMonth(),
        until.getUTCDate(),
      ) -
        since.getTime()) /
        86400000,
    ) + 1;
  const series = Array.from(
    {
      length: days === 0 && !rows.length && !filteredQuotes.length ? 0 : length,
    },
    (_, i) => {
      const date = new Date(since);
      date.setUTCDate(date.getUTCDate() + i);
      const day = date.toISOString().slice(0, 10);
      return { day, ...(dates.get(day) || { visits: 0, downloads: 0 }) };
    },
  );
  return {
    historyRecords: rows.length + filteredQuotes.length,
    visits,
    views,
    downloads,
    quotes: filteredQuotes.length,
    series,
    top: [...top.values()].sort((a, b) => b.total - a.total).slice(0, 20),
  };
}

export async function getStatistics(client, days) {
  if (![0, 7, 30, 60, 90, 365].includes(days)) throw Error("Período inválido.");
  if ([7, 30, 90].includes(days)) {
    const result = await client.rpc("admin_dashboard", { p_days: days });
    if (result.error) throw result.error;
    return result.data;
  }
  // Existing databases already grant admins SELECT on both tables. Paginate the
  // extra periods without requiring owners to rerun their installed SQL schema.
  const now = new Date(),
    since = new Date(now);
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - days + 1);
  async function allRows(table, columns) {
    const rows = [];
    let offset = 0;
    for (;;) {
      let query = client
        .from(table)
        .select(columns)
        .order("id", { ascending: true })
        .lte("created_at", now.toISOString());
      if (days) query = query.gte("created_at", since.toISOString());
      const result = await query.range(offset, offset + 499);
      if (result.error) throw result.error;
      if (!result.data.length) return rows;
      rows.push(...result.data);
      offset += result.data.length;
    }
  }
  const [events, quotes] = await Promise.all([
    allRows("site_events", "id,kind,model_id,product_id,format,created_at"),
    allRows("quote_requests", "id,created_at"),
  ]);
  return summarize(events, quotes, days, now);
}
