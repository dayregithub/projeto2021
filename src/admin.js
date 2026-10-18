import {
  listDownloads,
  getDownload,
  deleteDownload,
} from "./download-archive.js";
import {
  connection,
  readLocal,
  writeLocal,
  localMode,
  summarize,
} from "./platform-data.js";
import { MODELS, defaults, modelById } from "./models.js";
import { readProject } from "./geometry.js";
const $ = (id) => document.getElementById(id),
  escape = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let client = null,
  local = false,
  products = [],
  quotes = [],
  stats = null,
  settings = null,
  downloadFiles = [];
const notice = (text) => {
  $("notice").textContent = text;
};
const check = (result) => {
  if (result.error) throw result.error;
  return result.data;
};
function tab(name) {
  document
    .querySelectorAll("[data-section]")
    .forEach((e) => (e.hidden = e.dataset.section !== name));
  document
    .querySelectorAll("[data-tab]")
    .forEach((e) =>
      e.setAttribute("aria-selected", String(e.dataset.tab === name)),
    );
}
document
  .querySelectorAll("[data-tab]")
  .forEach((e) => (e.onclick = () => tab(e.dataset.tab)));
$("product-model").innerHTML = MODELS.map(
  (m) => `<option value="${escape(m.id)}">${escape(m.name)}</option>`,
).join("");
async function load() {
  try {
    if (local) {
      const data = readLocal();
      products = data.products;
      quotes = data.quotes.slice(0, 250);
      stats = summarize(data.events, data.quotes, Number($("period").value));
    } else {
      const results = await Promise.all([
        client
          .from("catalog_products")
          .select("*")
          .order("created_at", { ascending: false }),
        client
          .from("quote_requests")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(250),
        client.rpc("admin_dashboard", { p_days: Number($("period").value) }),
      ]);
      products = check(results[0]);
      quotes = check(results[1]);
      stats = check(results[2]);
    }
    render();
    await refreshFiles();
    notice("");
  } catch {
    notice(
      "Não foi possível carregar os dados. Verifique a conexão, as permissões e a instalação do banco.",
    );
  }
}
function render() {
  $("metrics").innerHTML = [
    ["Acessos", stats.visits],
    ["Modelos abertos", stats.views],
    ["Downloads iniciados", stats.downloads],
    ["Solicitações", stats.quotes],
  ]
    .map(
      ([label, value]) =>
        `<div class="metric"><span>${label}</span><strong>${Number(value).toLocaleString("pt-BR")}</strong></div>`,
    )
    .join("");
  const maximum = Math.max(1, ...stats.series.map((p) => Number(p.visits)));
  $("chart").innerHTML = stats.series
    .map(
      (p, i) =>
        `<div class="bar" style="height:${Math.max(1, (Number(p.visits) / maximum) * 170)}px" title="${escape(p.day)}: ${Number(p.visits)} acessos, ${Number(p.downloads)} downloads">${i % Math.max(1, Math.floor(stats.series.length / 7)) === 0 ? `<span>${escape(p.day.slice(5))}</span>` : ""}</div>`,
    )
    .join("");
  $("chart").setAttribute(
    "aria-label",
    `Acessos diários. Total: ${stats.visits}. Exporte CSV para detalhes.`,
  );
  $("top-downloads").innerHTML = stats.top.length
    ? `<div class="table-wrap"><table><thead><tr><th>Modelo</th><th>Formato</th><th>Total</th></tr></thead><tbody>${stats.top.map((p) => `<tr><td>${escape(products.find((product) => product.id === p.product)?.title || modelById(p.model)?.name || p.model || "Pacote de orçamento")}</td><td>${escape(p.format)}</td><td>${Number(p.total)}</td></tr>`).join("")}</tbody></table></div>`
    : "<p>Nenhum download registrado neste período.</p>";
  $("product-list").innerHTML = products.length
    ? products
        .map(
          (p) =>
            `<article class="card"><p class="eyebrow">${p.published ? "PUBLICADO" : "RASCUNHO"}</p><h3>${escape(p.title)}</h3><p>${escape(p.description)}</p><p class="muted">${escape(modelById(p.settings.model)?.name)} · ${escape(p.settings.width)} × ${escape(p.settings.depth)} × ${escape(p.settings.height)} mm</p><div class="actions"><button data-edit="${escape(p.id)}" class="secondary">Editar</button><button data-publish="${escape(p.id)}" class="secondary">${p.published ? "Ocultar" : "Publicar"}</button><button data-delete="${escape(p.id)}" class="secondary">Excluir</button></div></article>`,
        )
        .join("")
    : "<p>Nenhum produto criado no painel. Os modelos originais continuam no site.</p>";
  $("quote-list").innerHTML = quotes.length
    ? quotes
        .map(
          (q) =>
            `<article class="card"><p class="muted">${escape(new Date(q.created_at).toLocaleString("pt-BR"))}</p><h3>${escape(q.customer_name)}</h3><p>Contato: ${escape(q.contact)}</p><p>${escape(q.message)}</p><details><summary>Projeto solicitado</summary><pre class="quote-details">${escape(JSON.stringify(q.project, null, 2))}</pre></details><label>Situação<select data-quote="${escape(q.id)}">${[
              ["new", "Novo"],
              ["contacted", "Em atendimento"],
              ["quoted", "Orçamento enviado"],
              ["closed", "Concluído"],
            ]
              .map(
                ([value, label]) =>
                  `<option value="${value}" ${q.status === value ? "selected" : ""}>${label}</option>`,
              )
              .join("")}</select></label></article>`,
        )
        .join("")
    : '<div class="card">Nenhuma solicitação recebida.</div>';
  document
    .querySelectorAll("[data-edit]")
    .forEach(
      (e) =>
        (e.onclick = () => edit(products.find((p) => p.id === e.dataset.edit))),
    );
  document.querySelectorAll("[data-publish]").forEach(
    (e) =>
      (e.onclick = async () => {
        const p = products.find((p) => p.id === e.dataset.publish);
        await save({ ...p, published: !p.published });
      }),
  );
  document.querySelectorAll("[data-delete]").forEach(
    (e) =>
      (e.onclick = async () => {
        if (!confirm("Excluir este produto do painel?")) return;
        try {
          if (local) {
            const data = readLocal();
            data.products = data.products.filter(
              (p) => p.id !== e.dataset.delete,
            );
            writeLocal(data);
          } else
            check(
              await client
                .from("catalog_products")
                .delete()
                .eq("id", e.dataset.delete),
            );
          await load();
        } catch {
          notice("Não foi possível excluir.");
        }
      }),
  );
  document.querySelectorAll("[data-quote]").forEach(
    (e) =>
      (e.onchange = async () => {
        try {
          if (local) {
            const data = readLocal();
            data.quotes = data.quotes.map((q) =>
              q.id === e.dataset.quote ? { ...q, status: e.value } : q,
            );
            writeLocal(data);
          } else
            check(
              await client
                .from("quote_requests")
                .update({ status: e.value })
                .eq("id", e.dataset.quote),
            );
          notice("Situação atualizada.");
        } catch {
          notice("Não foi possível atualizar.");
        }
      }),
  );
}
async function save(p) {
  try {
    if (local) {
      const data = readLocal();
      const index = data.products.findIndex((v) => v.id === p.id);
      if (index < 0) data.products.unshift(p);
      else data.products[index] = p;
      writeLocal(data);
    } else check(await client.from("catalog_products").upsert(p));
    $("product-form").hidden = true;
    await load();
    notice(
      local
        ? "Salvo somente neste navegador. Abra o site aqui para testar."
        : "Produto salvo. Recarregue o site para ver a alteração.",
    );
  } catch {
    notice(
      "Não foi possível salvar o produto. Verifique os campos e as permissões.",
    );
  }
}
function fillDimensions() {
  const form = $("product-form");
  for (const k of ["width", "depth", "height"])
    form.elements[k].value = settings[k];
  form.elements.model.value = settings.model;
}
function edit(p) {
  const f = $("product-form");
  f.reset();
  settings = p ? readProject(p.settings) : defaults("open");
  f.elements.id.value = p?.id || "";
  f.elements.title.value = p?.title || "";
  f.elements.description.value = p?.description || "";
  f.elements.image.value = p?.image_url || "";
  f.elements.published.checked = p?.published || false;
  fillDimensions();
  f.hidden = false;
  f.scrollIntoView({ behavior: "smooth", block: "start" });
}
$("new-product").onclick = () => edit();
$("cancel-product").onclick = () => ($("product-form").hidden = true);
$("product-model").onchange = (e) => {
  settings = defaults(e.target.value);
  fillDimensions();
};
$("product-json").onchange = async (e) => {
  try {
    settings = readProject(await e.target.files[0].text());
    fillDimensions();
    if (!$("product-form").elements.title.value)
      $("product-form").elements.title.value = settings.name;
    notice("Configuração completa importada.");
  } catch {
    notice("Use um projeto .papeled.json válido.");
  }
};
$("product-form").onsubmit = async (e) => {
  e.preventDefault();
  try {
    const f = e.target;
    settings = readProject({
      ...settings,
      name: f.elements.title.value.trim(),
      width: Number(f.elements.width.value),
      depth: Number(f.elements.depth.value),
      height: Number(f.elements.height.value),
    });
    const image = f.elements.image.value.trim();
    if (image && !/^https:\/\//.test(image))
      throw Error("A imagem deve usar HTTPS.");
    await save({
      id: f.elements.id.value || crypto.randomUUID(),
      title: settings.name,
      description: f.elements.description.value.trim(),
      image_url: image || null,
      settings,
      published: f.elements.published.checked,
      created_at:
        products.find((p) => p.id === f.elements.id.value)?.created_at ||
        new Date().toISOString(),
    });
  } catch (error) {
    notice(error.message);
  }
};
async function enter() {
  if (!local) {
    check(await client.rpc("require_admin"));
  }
  $("access").hidden = true;
  $("workspace").hidden = false;
  $("mode-note").textContent = local
    ? "PRÉVIA LOCAL — sem login, dados só deste navegador. Nada aqui é publicado para os demais visitantes."
    : "Conectado ao estúdio. Dados protegidos por login e permissões do banco.";
  tab("overview");
  await load();
}
$("local-preview").onclick = async () => {
  localStorage.setItem("papeled-console-preview", "true");
  local = true;
  await enter();
};
$("login").onsubmit = async (e) => {
  e.preventDefault();
  const b = e.target.querySelector("button");
  b.disabled = true;
  try {
    check(
      await client.auth.signInWithPassword({
        email: e.target.elements.email.value,
        password: e.target.elements.password.value,
      }),
    );
    await enter();
    e.target.reset();
  } catch {
    notice(
      "Acesso não autorizado. Confira o e-mail, a senha e a permissão de administrador.",
    );
    await client.auth.signOut();
  } finally {
    b.disabled = false;
  }
};
$("logout").onclick = async () => {
  localStorage.removeItem("papeled-console-preview");
  if (client) await client.auth.signOut();
  location.reload();
};
$("period").onchange =
  $("refresh").onclick =
  $("refresh-quotes").onclick =
    load;
$("export-stats").onclick = () => {
  if (!stats) return;
  const rows = [
    ["dia_UTC", "acessos", "downloads"],
    ...stats.series.map((p) => [p.day, p.visits, p.downloads]),
  ];
  const link = document.createElement("a");
  link.href = URL.createObjectURL(
    new Blob(["\uFEFF" + rows.map((r) => r.join(";")).join("\r\n")], {
      type: "text/csv;charset=utf-8",
    }),
  );
  link.download = "estatisticas-papeled.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};
$("ask-assistant").onclick = async () => {
  const prompt = $("assistant-prompt").value.trim();
  if (!prompt) return;
  const status = $("assistant-status"),
    button = $("ask-assistant");
  $("assistant-result").textContent = "";
  if (local) {
    status.textContent =
      "A IA precisa da conexão Supabase e da função maker-assistant configurada com a chave no servidor. A prévia local não faz chamadas de IA.";
    return;
  }
  button.disabled = true;
  status.textContent = "Preparando sugestão…";
  try {
    const data = check(
      await client.functions.invoke("maker-assistant", { body: { prompt } }),
    );
    $("assistant-result").textContent = data.text;
    status.textContent = "Sugestão gerada. Revise antes de usar.";
  } catch {
    status.textContent =
      "Assistente indisponível. Verifique a função e a chave de IA no servidor.";
  } finally {
    button.disabled = false;
  }
};
try {
  client = await connection();
  if (client) {
    localStorage.removeItem("papeled-console-preview");
    $("connection-status").textContent =
      "Entre com sua conta de administrador.";
    $("login").hidden = false;
    const session = check(await client.auth.getSession());
    if (session.session) {
      try {
        await enter();
      } catch {
        await client.auth.signOut();
        notice("Conta sem permissão de administrador.");
      }
    }
  } else {
    $("connection-status").textContent = "Primeira configuração";
    $("setup").hidden = false;
    if (localMode()) {
      local = true;
      await enter();
    }
  }
} catch {
  $("connection-status").textContent =
    "Falha na configuração. Verifique platform-config.json e a conexão.";
}

async function refreshFiles() {
  try {
    downloadFiles = await listDownloads(client, local);
    $("download-list").innerHTML = downloadFiles.length
      ? downloadFiles
          .map(
            (file) =>
              `<article class="card"><h3>${escape(file.filename)}</h3><p>${escape(new Date(file.created_at).toLocaleString("pt-BR"))} · ${escape(file.format.toUpperCase())} · ${(Number(file.size_bytes) / 1024).toFixed(1)} KB</p><p class="muted">${escape(products.find((p) => p.id === file.product_id)?.title || modelById(file.model_id)?.name || file.model_id)}</p><div class="actions"><button data-download-file="${escape(file.id)}">Baixar cópia original</button><button class="secondary" data-delete-file="${escape(file.id)}">Excluir cópia</button></div></article>`,
          )
          .join("")
      : '<div class="card">Nenhuma cópia recebida. Os arquivos aparecerão depois que visitantes baixarem com a opção de guardar cópia habilitada.</div>';
    document.querySelectorAll("[data-download-file]").forEach(
      (button) =>
        (button.onclick = async () => {
          button.disabled = true;
          try {
            const file = await getDownload(
              client,
              local,
              downloadFiles.find((f) => f.id === button.dataset.downloadFile),
            );
            const url = URL.createObjectURL(file),
              link = document.createElement("a");
            link.href = url;
            link.download = file.name;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
            notice("Cópia verificada e preparada para download.");
          } catch (error) {
            notice(error.message);
          } finally {
            button.disabled = false;
          }
        }),
    );
    document.querySelectorAll("[data-delete-file]").forEach(
      (button) =>
        (button.onclick = async () => {
          if (!confirm("Excluir esta cópia do painel?")) return;
          try {
            await deleteDownload(
              client,
              local,
              downloadFiles.find((f) => f.id === button.dataset.deleteFile),
            );
            await refreshFiles();
            notice("Cópia excluída.");
          } catch {
            notice("Não foi possível excluir a cópia.");
          }
        }),
    );
  } catch {
    $("download-list").textContent =
      "O histórico de arquivos não está disponível. Verifique a instalação da migração 002 e do bucket privado.";
  }
}
$("refresh-files").onclick = refreshFiles;
