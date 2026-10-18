import { finishKeys } from "./finishes.js";
import { defaults, modelById } from "./models.js";
import { readProject } from "./geometry.js";
const statuses = ["new", "contacted", "quoted", "closed"];
const views = ["overview", "products", "files", "quotes", "assistant"];
export const signature = (value) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
        )
      : v,
  );
function text(value, max, required = false) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    throw Error("Texto proposto inválido.");
  return value.trim();
}
function candidateSettings(model, base, patch, title) {
  if (!modelById(model)) throw Error("O modelo proposto não está disponível.");
  if (!Array.isArray(patch) || patch.length > 60)
    throw Error("Lista de ajustes inválida.");
  const next = { ...defaults(model), ...base, model, name: title };
  const seen = new Set();
  for (const item of patch) {
    if (
      !item ||
      !Object.hasOwn(defaults(model), item.key) ||
      ["version", "model", "name"].includes(item.key) ||
      seen.has(item.key)
    )
      throw Error("Parâmetro proposto não é permitido.");
    if (!["string", "boolean", "number"].includes(typeof item.value))
      throw Error("Valor de parâmetro inválido.");
    if (item.key === "finish" && !finishKeys({ model }).includes(item.value))
      throw Error("Cor não disponível para este processo.");
    seen.add(item.key);
    next[item.key] = item.value;
  }
  return readProject(next);
}
export function proposalsFrom(plan, { products, quotes }) {
  if (
    !plan ||
    typeof plan.reply !== "string" ||
    plan.reply.length > 16000 ||
    !Array.isArray(plan.actions) ||
    plan.actions.length > 5
  )
    throw Error("O assistente retornou uma proposta inválida.");
  return plan.actions.map((action) => {
    if (action.kind === "navigate") {
      if (!views.includes(action.view)) throw Error("Seção não permitida.");
      return {
        kind: "navigate",
        view: action.view,
        label: `Abrir seção: ${action.view}`,
        changes: [],
      };
    }
    if (action.kind === "set_quote_status") {
      const before = structuredClone(
        quotes.find((q) => q.id === action.target_id),
      );
      if (!before || !statuses.includes(action.status))
        throw Error("Pedido ou situação inválida.");
      return {
        kind: action.kind,
        before,
        after: { ...before, status: action.status },
        label: "Atualizar situação do orçamento",
        changes: [
          { field: "Situação", from: before.status, to: action.status },
        ],
      };
    }
    if (!["create_product", "update_product"].includes(action.kind))
      throw Error("Ação não permitida.");
    const before =
      action.kind === "update_product"
        ? structuredClone(products.find((p) => p.id === action.target_id))
        : null;
    if (action.kind === "update_product" && !before)
      throw Error("Produto não encontrado.");
    const model = action.model ?? before?.settings.model;
    if (!modelById(model))
      throw Error("Escolha um modelo de construção existente.");
    const title =
      action.title === null || action.title === undefined
        ? before?.title
        : modelById(model) && text(action.title, 80, true);
    const description =
      action.description === null || action.description === undefined
        ? before?.description
        : text(action.description, 1000, true);
    if (!title || !description)
      throw Error("A criação precisa de nome e descrição.");
    const settings = candidateSettings(
      model,
      before?.settings.model === model ? before.settings : {},
      action.settings_patch || [],
      title,
    );
    if (
      action.published !== null &&
      action.published !== undefined &&
      typeof action.published !== "boolean"
    )
      throw Error("Publicação inválida.");
    const after = {
      id: before?.id || crypto.randomUUID(),
      title,
      description,
      image_url: before?.image_url || null,
      settings,
      published: before ? (action.published ?? before.published) : false,
      created_at: before?.created_at || new Date().toISOString(),
    };
    const changes = [];
    for (const key of ["title", "description", "published"])
      if (!before || signature(before[key]) !== signature(after[key]))
        changes.push({
          field: {
            title: "Nome",
            description: "Descrição",
            published: "Publicado",
          }[key],
          from: before?.[key] ?? "—",
          to: after[key],
        });
    const createdFields = new Set([
      "model",
      "width",
      "depth",
      "height",
      "thickness",
      "finish",
      ...(action.settings_patch || []).map((p) => p.key),
    ]);
    for (const key of Object.keys(settings))
      if (
        !before ||
        signature(before.settings[key]) !== signature(settings[key])
      ) {
        if (
          key === "name" ||
          key === "version" ||
          (!before && !createdFields.has(key))
        )
          continue;
        changes.push({
          field:
            {
              model: "Modelo",
              width: "Largura (mm)",
              depth: "Profundidade (mm)",
              height: "Altura / espessura do letreiro (mm)",
              thickness: "Espessura (mm)",
              finish: "Cor",
              cols: "Colunas",
              rows: "Linhas",
              printLid: "Tampa 3D",
              brushTexture: "Textura externa",
              brushCover: "Cobertura alta",
              signText: "Texto do letreiro",
              signFont: "Fonte",
              signOrientation: "Posição das letras",
            }[key] || key,
          from: before?.settings[key] ?? "—",
          to: settings[key],
        });
      }
    return {
      kind: action.kind,
      before,
      after,
      label: before ? `Atualizar ${before.title}` : `Criar rascunho: ${title}`,
      changes,
    };
  });
}
export async function applyProposal(
  proposal,
  { client, local, readLocal, writeLocal },
) {
  if (proposal.kind === "navigate") return;
  const product = proposal.kind !== "set_quote_status",
    table = product ? "catalog_products" : "quote_requests";
  if (local) {
    const data = readLocal(),
      key = product ? "products" : "quotes";
    const index = data[key].findIndex((p) => p.id === proposal.after.id);
    if (proposal.before) {
      if (
        index < 0 ||
        signature(data[key][index]) !== signature(proposal.before)
      )
        throw Error("O cadastro mudou. Gere uma nova proposta.");
      data[key][index] = proposal.after;
    } else {
      if (index >= 0) throw Error("Esta proposta já foi aplicada.");
      data[key].unshift(proposal.after);
    }
    writeLocal(data);
    return;
  }
  if (!proposal.before) {
    const result = await client.from(table).insert(proposal.after);
    if (result.error) throw Error("Não foi possível criar o rascunho.");
    return;
  }
  let query = client
    .from(table)
    .update(
      product
        ? {
            title: proposal.after.title,
            description: proposal.after.description,
            settings: proposal.after.settings,
            published: proposal.after.published,
          }
        : { status: proposal.after.status },
    )
    .eq("id", proposal.before.id);
  if (product)
    query = query
      .eq("title", proposal.before.title)
      .eq("description", proposal.before.description)
      .eq("settings", JSON.stringify(proposal.before.settings))
      .eq("published", proposal.before.published);
  else query = query.eq("status", proposal.before.status);
  const result = await query.select("id").single();
  if (result.error || !result.data)
    throw Error(
      "Não foi possível aplicar: o cadastro pode ter mudado. Atualize os dados e gere outra proposta.",
    );
}
export function auditProducts(products) {
  return products.flatMap((p) => {
    const findings = [];
    try {
      readProject(p.settings);
    } catch (error) {
      findings.push({
        id: p.id,
        title: p.title,
        message: `Configuração inválida: ${error.message}`,
      });
    }
    if (!p.description?.trim())
      findings.push({
        id: p.id,
        title: p.title,
        message: "Descrição ausente.",
      });
    if (!p.image_url)
      findings.push({
        id: p.id,
        title: p.title,
        message: "Sem foto de apresentação (opcional).",
      });
    return findings;
  });
}
