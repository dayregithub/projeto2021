import models from "../_shared/assistant-models.json" with { type: "json" };
import { planSchema, instructions } from "../_shared/assistant-plan.js";
import { createClient } from "npm:@supabase/supabase-js@2";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return reply({ error: "Unauthorized" }, 401);
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authorization } } },
    );
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user) return reply({ error: "Unauthorized" }, 401);
    const permission = await client.rpc("require_admin");
    if (permission.error) return reply({ error: "Forbidden" }, 403);
    const body = await req.json();
    const key = Deno.env.get("OPENAI_API_KEY");
    const model = Deno.env.get("OPENAI_MODEL") || "gpt-4.1";
    if (body.mode === "health")
      return reply({ version: 2, ready: !!key, model, max_actions: 5 });
    const { prompt } = body;
    if (typeof prompt !== "string" || prompt.length < 1 || prompt.length > 2000)
      return reply({ error: "Invalid prompt" }, 400);
    if (!key) return reply({ error: "Assistant not configured" }, 503);
    const productQuery = client
      .from("catalog_products")
      .select("id,title,description,settings,published,image_url,created_at")
      .order("created_at", { ascending: false })
      .limit(40);
    const [catalog, metrics, quoteRefs] = await Promise.all([
      productQuery,
      client.rpc("admin_dashboard", { p_days: 30 }),
      client
        .from("quote_requests")
        .select("id,status,created_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    if (catalog.error || metrics.error || quoteRefs.error)
      return reply({ error: "Context unavailable" }, 503);
    let selected = null;
    if (
      typeof body.productId === "string" &&
      /^[a-f0-9-]{36}$/i.test(body.productId)
    ) {
      const result = await client
        .from("catalog_products")
        .select("id,title,description,settings,published,image_url,created_at")
        .eq("id", body.productId)
        .maybeSingle();
      if (result.error) return reply({ error: "Context unavailable" }, 503);
      selected = result.data;
    }
    const base = models[0].defaults as Record<string, unknown>;
    const compactModels = models.map((m) => ({
      id: m.id,
      name: m.name,
      category: m.category,
      overrides: Object.fromEntries(
        Object.entries(m.defaults).filter(
          ([key, value]) => JSON.stringify(value) !== JSON.stringify(base[key]),
        ),
      ),
    }));
    const history: { role: string; text: string }[] = [];
    if (Array.isArray(body.history))
      for (const message of body.history.slice(-4)) {
        if (
          message &&
          ["user", "assistant"].includes(message.role) &&
          typeof message.text === "string"
        )
          history.push({
            role: message.role,
            text: message.text.slice(0, 4000),
          });
      }
    const context = {
      models: compactModels,
      base_defaults: base,
      catalog: catalog.data,
      selected_product: selected,
      metrics_period: "Últimos 30 dias UTC",
      metrics: metrics.data,
      recent_quote_references: quoteRefs.data,
    };
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_output_tokens: 3500,
        instructions,
        input: JSON.stringify({
          pedido: prompt,
          historico: history,
          contexto: context,
        }),
        text: {
          format: {
            type: "json_schema",
            name: "maker_assistant_plan",
            strict: true,
            schema: planSchema,
          },
        },
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) return reply({ error: "Provider unavailable" }, 502);
    const data = await response.json();
    if (data.status === "incomplete")
      return reply({ error: "Incomplete response" }, 502);
    const text = (data.output || [])
      .flatMap(
        (o: { content?: { type: string; text?: string }[] }) => o.content || [],
      )
      .filter((c: { type: string }) => c.type === "output_text")
      .map((c: { text?: string }) => c.text || "")
      .join("\n");
    let plan;
    try {
      plan = JSON.parse(text);
    } catch {
      return reply({ error: "Invalid response" }, 502);
    }
    if (
      typeof plan.reply !== "string" ||
      !Array.isArray(plan.actions) ||
      plan.actions.length > 5
    )
      return reply({ error: "Invalid response" }, 502);
    return reply({ ...plan, version: 2 });
  } catch {
    return reply({ error: "Assistant unavailable" }, 500);
  }
});
