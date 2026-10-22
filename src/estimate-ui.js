import { initWorkReports } from "./work-reports.js";
import { initFinance } from "./finance-ui.js";
import { loadAllRows } from "./finance-data.js";
import { durationLabel } from "./simple-estimate.js";
import { renderEstimateKanban } from "./estimate-kanban.js";
import { materialFor } from "./estimate-materials.js";
import {
  DEFAULT_PRICING,
  DEFAULT_LAYOUT,
  newEstimate,
  newEstimateItem,
  calculateEstimate,
  validateEstimate,
  brl,
} from "./estimate-calculations.js";
import { modelById } from "./models.js";
const KEY = "papeled-issued-estimates-v1",
  PROFILE = "papeled-estimate-profile-v1";
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function initEstimates({ getState, navigate }) {
  const $ = (id) => document.getElementById(id),
    form = $("estimate-form");
  let quote = newEstimate(),
    records = [],
    profile = {},
    cloud = false,
    active = false,
    previewURL = null,
    previewVersion = 0,
    disposePreview = null,
    pdfBusy = false,
    cleanSnapshot = "",
    pendingTransition = null;
  const finance = initFinance({
    getState,
    getQuotes: () => records,
    isQuoteSourceReady: () => getState().local || cloud,
    openQuote: (id) => requestTransition(() => openQuote(id)),
  });
  $("finance-refresh").onclick = () => refresh();
  const workReports = initWorkReports({
    getQuotes: () => records,
    isQuoteSourceReady: () => getState().local || cloud,
    openQuote: (id) => requestTransition(() => openQuote(id)),
  });
  const message = (text) => {
    for (const id of [
      "estimate-status",
      "estimate-history-status",
      "production-status",
    ])
      if ($(id)) $(id).textContent = text;
  };
  const read = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  };
  const store = (key, value) =>
    localStorage.setItem(key, JSON.stringify(value));
  function sync() {
    $("estimate-format-note").hidden = quote.calculationVersion === 2;
    quote.paymentStatus ??= "pending";
    quote.paymentDate ??= "";
    if (quote.layout.footer === "Obrigado por criar com o Papeled Maker.")
      quote.layout.footer = DEFAULT_LAYOUT.footer;
    for (const key of [
      "number",
      "issuedOn",
      "validityDays",
      "customer",
      "contact",
      "customerId",
      "title",
      "status",
      "paymentStatus",
      "paymentDate",
      "delivery",
      "payment",
      "notes",
      "internalNotes",
      "setupMinutes",
      "setupPrice",
      "shipping",
      "discount",
      "adjustment",
      "adjustmentReason",
      "discountType",
    ])
      form.elements[key].value = quote[key];
    $("estimate-commercial").open = !!(
      quote.discount ||
      quote.shipping ||
      quote.setupMinutes ||
      quote.setupPrice ||
      quote.adjustment
    );
    renderItems();
    renderSummary();
    $("estimate-editor-title").textContent = `Orçamento ${quote.number}`;
  }
  function readForm() {
    for (const key of [
      "number",
      "issuedOn",
      "customer",
      "contact",
      "customerId",
      "title",
      "status",
      "paymentStatus",
      "paymentDate",
      "delivery",
      "payment",
      "notes",
      "internalNotes",
      "adjustmentReason",
      "discountType",
    ])
      quote[key] = form.elements[key].value;
    for (const key of [
      "validityDays",
      "setupMinutes",
      "setupPrice",
      "shipping",
      "discount",
      "adjustment",
    ])
      quote[key] =
        form.elements[key].value === ""
          ? NaN
          : Number(form.elements[key].value);
  }
  function materialFields(item) {
    const m = materialFor(item, quote.pricing),
      catalog = (profile.materials || []).filter(
        (entry) =>
          entry.process === item.process &&
          (item.process !== "laser" ||
            !entry.material.unit ||
            entry.material.unit === "chapa"),
      ),
      choices = [
        ...new Set([m.name, ...catalog.map((entry) => entry.material.name)]),
      ];
    return `<div class="estimate-material"><label>Material<select data-material-name>${choices.map((name) => `<option ${name === m.name ? "selected" : ""}>${esc(name)}</option>`).join("")}</select></label><p class="muted" data-material-summary>${esc(m.name)} · ${brl(m.price)}/${item.process === "laser" ? `chapa de ${m.width} × ${m.length} cm` : "kg"}${m.specification ? " · " + esc(m.specification) : ""}</p></div>`;
  }
  function serviceFields(item) {
    return `<fieldset class="estimate-services"><legend>Serviços adicionais</legend><div class="service-entry"><label>Serviço / recurso<select data-service-pick aria-label="Adicionar serviço ou recurso"><option value="">Selecione um cadastro</option>${(profile.services || []).map((s, i) => `<option value="${i}">${esc(s.name)} · ${brl(s.price)}/${s.unit}</option>`).join("")}</select></label><label>Quantidade<input data-new-service-quantity type="number" min="0" step="any" value="1"></label><button type="button" data-service-add>+ Adicionar</button></div>${(item.services || []).map((s, i) => `<div class="service-line"><span>${esc(s.name)} · ${brl(s.price)}/${s.unit}</span><label>Quantidade (${s.unit})<input data-service-quantity="${i}" type="number" min="0" step="any" value="${s.quantity}"></label><button type="button" class="secondary" data-service-remove="${i}">Remover</button></div>`).join("")}<p class="muted">${quote.calculationVersion === 2 ? "Quantidade total de cada serviço, independente da quantidade de peças." : "Orçamento anterior: valores e quantidades originais preservados."}</p></fieldset>`;
  }
  function simpleFields(item, i) {
    const materials = (profile.materials || []).filter(
      (m) => m.process === item.process,
    );
    const m = materialFor(item, quote.pricing),
      mode = item.materialMode || "none";
    const primary = (profile.services || [])
      .map((service, index) => ({ service, index }))
      .filter((x) => ["hora", "minuto"].includes(x.service.unit));
    return `<article class="card estimate-item" data-row="${item.id}"><div class="heading"><h3>Item ${i + 1}</h3><div><button type="button" class="secondary" data-copy="${i}">Duplicar</button><button type="button" class="secondary" data-remove="${i}">Remover</button></div></div>
      <label>1. Descrição<textarea data-item="description" maxlength="1200" rows="2">${esc(item.description)}</textarea></label>
      <div class="grid three"><label>2. Serviço<select data-primary-service><option value="">${item.process === "laser" ? "Corte / gravação a laser" : "Impressão 3D"}</option>${item.process === "laser" ? primary.map(({ service, index }) => `<option value="${index}" ${item.primaryService?.id === service.id ? "selected" : ""}>${esc(service.name)}</option>`).join("") : ""}</select></label>${itemField("quantity", "Quantidade de peças", item.quantity)}${item.process === "laser" ? itemField("minutes", "Tempo de laser por peça (min)", item.minutes) : itemField("hours", "Tempo de impressão por peça (horas)", item.hours)}</div>
      <p data-time-result class="muted"></p>
      <label>3. Material<select data-item="materialMode"><option value="none" ${mode === "none" ? "selected" : ""}>Sem material</option><option value="included" ${mode === "included" ? "selected" : ""}>Com material</option><option value="provided" ${mode === "provided" ? "selected" : ""}>Material fornecido pelo cliente</option></select></label>
      <div class="estimate-material" data-material-group ${mode !== "included" ? "hidden" : ""}><div class="grid"><label>Tipo de material<select data-material-name>${[...new Set([m.name, ...materials.map((x) => x.material.name)])].map((name) => `<option ${name === m.name ? "selected" : ""}>${esc(name)}</option>`).join("")}</select></label>${itemField("materialQuantity", `Quantidade total de material (${item.process === "print" ? "g" : m.unit || "chapa"})`, item.materialQuantity ?? 0)}</div><p class="muted" data-material-summary>${esc(m.name)} · ${brl(m.salePrice ?? m.price * (1 + (item.process === "laser" ? (quote.pricing.laserMaterialMarkup ?? quote.pricing.markupPercent) : (quote.pricing.printMarkup ?? quote.pricing.markupPercent)) / 100))}/${item.process === "print" ? "kg" : m.unit || "chapa"}</p></div>
      ${serviceFields(item)}<p data-item-result class="item-total"></p></article>`;
  }
  function renderItems() {
    $("estimate-items").innerHTML = quote.items
      .map((item, i) =>
        quote.calculationVersion === 2
          ? simpleFields(item, i)
          : `<article class="card estimate-item" data-row="${item.id}"><div class="heading"><h3>${i + 1}. ${item.process === "laser" ? "Corte e gravação a laser" : "Impressão 3D"}</h3><div><button type="button" class="secondary" data-copy="${i}">Duplicar</button><button type="button" class="secondary" data-remove="${i}">Remover</button></div></div><label>Descrição na proposta<textarea data-item="description" rows="2" maxlength="1200">${esc(item.description)}</textarea></label>${materialFields(item)}<div class="grid three">${itemField("quantity", "Quantidade de peças", item.quantity)}${item.process === "laser" ? itemField("minutes", "Tempo de máquina por peça (min)", item.minutes) + itemField("boards", "Recortes por peça (0 = só serviço)", item.boards) : itemField("grams", "Material por peça (g)", item.grams) + itemField("hours", "Tempo por peça (horas)", item.hours)}</div>${item.process === "laser" ? `<details class="item-extra" ${item.boards ? "open" : ""}><summary>Medidas do material consumido</summary><p class="muted">Informe a área de cada recorte, e não a área da chapa inteira. Recortes × área × custo/m² determina o material.</p><div class="grid three">${itemField("boardWidth", "Largura do recorte (cm)", item.boardWidth)}${itemField("boardLength", "Comprimento do recorte (cm)", item.boardLength)}${itemField("wastePercent", "Perdas de material (%)", item.wastePercent)}</div></details>` : `<input data-item="boardWidth" type="hidden" value="${item.boardWidth}"><details class="item-extra"><summary>Perdas de impressão</summary>${itemField("lossPercent", "Perda de filamento (%)", item.lossPercent)}</details>`}<label class="check"><input type="checkbox" data-item="materialProvided" ${item.materialProvided ? "checked" : ""}> Material fornecido pelo cliente</label><details class="item-extra" ${(item.services || []).length ? "open" : ""}><summary>Adicionar serviços e recursos</summary>${serviceFields(item)}</details><details class="item-extra"><summary>Ajustar preço e acabamento deste item</summary><div class="grid three"><label>Método de preço<select data-item="method">${[...(item.process === "laser" ? [["rate", "Tempo de máquina + material"]] : []), ["markup", "Custo + acréscimo"], ["margin", "Margem sobre a venda"]].map(([value, label]) => `<option value="${value}" ${item.method === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>${itemField("manualUnitPrice", "Preço unitário manual (R$; vazio = automático)", item.manualUnitPrice ?? "")}${itemField("handlingMinutes", "Trabalho manual por peça (min)", item.handlingMinutes)}${itemField("paintingCost", "Tinta / acabamento por peça (R$)", item.paintingCost)}${itemField("extras", "Embalagem / outros custos por peça (R$)", item.extras)}</div></details><p data-item-result class="item-total"></p></article>`,
      )
      .join("");
    $("estimate-items")
      .querySelectorAll("[data-row]")
      .forEach((row, index) => {
        const primary = row.querySelector("[data-primary-service]");
        if (primary)
          primary.onchange = () => {
            quote.items[index].primaryService =
              primary.value === ""
                ? null
                : structuredClone(profile.services[Number(primary.value)]);
            invalidate();
            renderSummary();
          };
        row.querySelector("[data-service-add]").onclick = () => {
          const value = row.querySelector("[data-service-pick]").value;
          if (value === "") return;
          quote.items[index].services ||= [];
          quote.items[index].services.push({
            ...structuredClone(profile.services[Number(value)]),
            quantity: Number(
              row.querySelector("[data-new-service-quantity]").value,
            ),
          });
          renderItems();
          invalidate();
          renderSummary();
        };
        row.querySelectorAll("[data-service-quantity]").forEach(
          (input) =>
            (input.oninput = () => {
              quote.items[index].services[
                Number(input.dataset.serviceQuantity)
              ].quantity = input.value === "" ? NaN : Number(input.value);
              invalidate();
              renderSummary();
            }),
        );
        row.querySelectorAll("[data-service-remove]").forEach(
          (button) =>
            (button.onclick = () => {
              quote.items[index].services.splice(
                Number(button.dataset.serviceRemove),
                1,
              );
              renderItems();
              invalidate();
              renderSummary();
            }),
        );
        row.querySelector("[data-material-name]").onchange = (e) => {
          const item = quote.items[index],
            name = e.target.value;
          const saved = (profile.materials || []).find(
            (x) => x.process === item.process && x.material.name === name,
          );
          item.material = saved
            ? structuredClone(saved.material)
            : { ...materialFor(item, quote.pricing), name, price: 0 };
          renderItems();
          invalidate();
          renderSummary();
        };
      });
    $("estimate-items")
      .querySelectorAll("[data-row]")
      .forEach((row, index) =>
        row.querySelectorAll("[data-item]").forEach((input) =>
          input.addEventListener("input", () => {
            const key = input.dataset.item;
            quote.items[index][key] =
              input.type === "checkbox"
                ? input.checked
                : key === "description" ||
                    key === "method" ||
                    key === "materialMode"
                  ? input.value
                  : input.value === ""
                    ? key === "manualUnitPrice"
                      ? null
                      : NaN
                    : Number(input.value);
            if (key === "materialMode") {
              row.querySelector("[data-material-group]").hidden =
                input.value !== "included";
              if (
                input.value === "included" &&
                !quote.items[index].materialQuantity
              ) {
                quote.items[index].materialQuantity = 1;
                row.querySelector('[data-item="materialQuantity"]').value = 1;
              }
            }
            if (key === "boards" && Number(input.value) > 0)
              row.querySelector(".item-extra").open = true;
            invalidate();
            renderSummary();
          }),
        ),
      );
    $("estimate-items")
      .querySelectorAll("[data-remove]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            if (quote.items.length === 1) {
              message("Mantenha ao menos um item.");
              return;
            }
            quote.items.splice(Number(b.dataset.remove), 1);
            renderItems();
            invalidate();
            renderSummary();
          }),
      );
    $("estimate-items")
      .querySelectorAll("[data-copy]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            if (quote.items.length >= 150) {
              message("Limite de 150 itens.");
              return;
            }
            quote.items.splice(Number(b.dataset.copy) + 1, 0, {
              ...structuredClone(quote.items[Number(b.dataset.copy)]),
              id: crypto.randomUUID(),
            });
            renderItems();
            invalidate();
            renderSummary();
          }),
      );
  }
  function itemField(key, label, value) {
    return `<label>${esc(label)}<input data-item="${key}" type="number" step="any" value="${esc(value)}"></label>`;
  }
  function invalidate() {
    previewVersion++;
    disposePreview?.();
    disposePreview = null;
    $("estimate-preview-pages").replaceChildren();
    $("estimate-preview-open").removeAttribute("href");
    if (previewURL) {
      URL.revokeObjectURL(previewURL);
      previewURL = null;
    }
    $("estimate-preview").hidden = true;
  }
  function renderSummary() {
    const processes = new Set(quote.items.map((item) => item.process));
    try {
      const result = calculateEstimate(quote);
      $("estimate-summary").innerHTML =
        quote.calculationVersion === 2
          ? `<div class="metrics"><div class="metric">Valor do material<strong>${brl(result.materialTotal)}</strong></div><div class="metric">Valor do serviço<strong>${brl(result.serviceTotal)}</strong></div><div class="metric">Total geral<strong>${brl(result.total)}</strong></div></div><p class="muted">Serviços adicionais: ${brl(result.additionalTotal)} · Desconto: ${brl(result.discount)} · Frete: ${brl(quote.shipping)}.</p>${result.warnings.map((w) => `<p class="estimate-warning">${esc(w)}</p>`).join("")}`
          : `<div class="metrics"><div class="metric">Subtotal<strong>${brl(result.subtotal)}</strong></div><div class="metric">Desconto<strong>${brl(result.discount)}</strong></div><div class="metric">Total ao cliente<strong>${brl(result.total)}</strong></div></div><details class="item-extra"><summary>Conferir custos e resultado interno</summary><p>Custo total: ${brl(result.cost)} · Resultado estimado após impostos: ${brl(result.profit)}.</p><p class="muted">${processes.has("laser") ? `Laser: custo interno ${brl(result.laser.hour)}/hora. ` : ""}Impostos inclusos: ${brl(result.tax)}. Frete é repasse.</p></details>${result.warnings.map((w) => `<p class="estimate-warning">${esc(w)}</p>`).join("")}`;
      try {
        validateEstimate(quote);
        store("papeled-estimate-draft-v1", quote);
      } catch {}
      result.items.forEach((item, i) => {
        const row =
          $("estimate-items").querySelectorAll("[data-item-result]")[i];
        if (row && quote.calculationVersion === 2) {
          row.textContent = `Serviço: ${brl(item.serviceAmount)} · Material: ${brl(item.materialAmount)} · Adicionais: ${brl(item.additionalAmount)} · Total: ${brl(item.subtotal)}`;
          const info = row
            .closest("[data-row]")
            .querySelector("[data-time-result]");
          if (info)
            info.textContent =
              item.process === "laser"
                ? `${item.minutes} min × ${item.quantity} = ${item.totalMinutes} minutos (${durationLabel(item.totalMinutes)}). ${item.ratePerMinute.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 6 })}/min.`
                : `${item.hours} h × ${item.quantity} peça(s).`;
        } else if (row)
          row.textContent = `${brl(item.unitPrice)} por peça · Total do item: ${brl(item.subtotal)}`;
      });
      $("estimate-save").disabled =
        $("estimate-pdf").disabled =
        $("estimate-preview-button").disabled =
          pdfBusy;
    } catch (error) {
      $("estimate-summary").textContent = error.message;
      $("estimate-save").disabled =
        $("estimate-pdf").disabled =
        $("estimate-preview-button").disabled =
          true;
    }
  }
  form.addEventListener("input", (e) => {
    if (e.target.closest("#estimate-items")) return;
    readForm();
    invalidate();
    renderSummary();
  });
  form.addEventListener("change", (e) => {
    if (e.target.type === "file" || e.target.closest("#estimate-items")) return;
    readForm();
    invalidate();
    renderSummary();
  });
  function start(process, source) {
    quote = newEstimate(profile);
    quote.calculationVersion = 2;
    quote.items = [
      {
        ...newEstimateItem(process),
        materialMode: "none",
        materialQuantity: 0,
        primaryService: null,
      },
    ];
    if (process === "laser" && profile.pricing?.markupPercent === undefined)
      quote.pricing.markupPercent = 100;
    if (source) {
      quote.customer = source.customer_name || "";
      quote.contact = source.contact || "";
      quote.notes = source.message || "";
      const p = source.project || source.settings;
      quote.customerProjectId =
        source.customerProjectId || p?.customerProjectId || null;
      if (p) {
        quote.title = p.name || source.title || quote.title;
        quote.items[0].description = `${p.name || source.title || "Projeto"}${p.width ? ` — ${p.width} × ${p.depth} × ${p.height} mm` : ""}`;
      }
    }
    invalidate();
    sync();
    cleanSnapshot = JSON.stringify(quote);
    $("estimate-editor").hidden = false;
    navigate("estimates");
    $("estimate-editor").scrollIntoView({ behavior: "smooth" });
  }
  $("show-estimate-board").onclick = () => navigate("production");
  function closeEditor() {
    invalidate();
    $("estimate-editor").hidden = true;
    localStorage.removeItem("papeled-estimate-draft-v1");
    cleanSnapshot = "";
    message("Edição fechada. Orçamentos salvos continuam no histórico.");
    $("new-laser-estimate").focus();
  }
  function requestTransition(action) {
    if (pdfBusy) {
      message("Aguarde a geração do PDF antes de sair.");
      return;
    }
    readForm();
    if (
      !$("estimate-editor").hidden &&
      JSON.stringify(quote) !== cleanSnapshot
    ) {
      pendingTransition = action;
      $("estimate-leave-status").textContent = "";
      $("estimate-leave-dialog").showModal();
    } else action();
  }
  $("estimate-close").onclick = () => requestTransition(closeEditor);
  $("estimate-new").onclick = () =>
    requestTransition(() => {
      closeEditor();
      $("estimate-new-dialog").showModal();
    });
  $("estimate-new-back").onclick = () => $("estimate-new-dialog").close();
  $("estimate-leave-back").onclick = () => {
    pendingTransition = null;
    $("estimate-leave-dialog").close();
  };
  $("estimate-leave-discard").onclick = () => {
    const action = pendingTransition;
    pendingTransition = null;
    $("estimate-leave-dialog").close();
    action?.();
  };
  $("estimate-leave-save").onclick = async () => {
    const button = $("estimate-leave-save");
    button.disabled = true;
    try {
      await save();
      const action = pendingTransition;
      pendingTransition = null;
      $("estimate-leave-dialog").close();
      action?.();
    } catch (error) {
      $("estimate-leave-status").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
  for (const [id, process] of [
    ["new-laser-estimate", "laser"],
    ["new-print-estimate", "print"],
    ["estimate-new-laser", "laser"],
    ["estimate-new-print", "print"],
  ])
    $(id).onclick = () => {
      $("estimate-new-dialog").close();
      requestTransition(() => start(process));
    };
  for (const [id, process] of [
    ["add-laser-item", "laser"],
    ["add-print-item", "print"],
  ])
    $(id).onclick = () => {
      if (quote.items.length >= 150) return;
      readForm();
      quote.items.push({
        ...newEstimateItem(process),
        ...(quote.calculationVersion === 2
          ? { materialMode: "none", materialQuantity: 0, primaryService: null }
          : {}),
      });
      renderItems();
      invalidate();
      renderSummary();
    };
  async function save() {
    readForm();
    validateEstimate(quote);
    const existing = records.find(
      (r) => r.number === quote.number && r.id !== quote.id,
    );
    if (existing) throw Error("Já existe outro orçamento com esse número.");
    quote.updatedAt = new Date().toISOString();
    if (cloud) {
      const result = await getState().client.from("issued_quotes").upsert({
        id: quote.id,
        quote_number: quote.number,
        data: quote,
        updated_at: quote.updatedAt,
      });
      if (result.error) {
        if (result.error.code === "23505")
          throw Error("Esse número já existe no banco.");
        throw Error(
          "Não foi possível salvar na nuvem. Exporte o JSON para guardar uma cópia e tente novamente.",
        );
      }
    } else {
      const all = read(KEY, []),
        i = all.findIndex((r) => r.id === quote.id);
      if (i < 0) all.unshift(structuredClone(quote));
      else all[i] = structuredClone(quote);
      store(KEY, all);
    }
    await refresh();
    cleanSnapshot = JSON.stringify(quote);
    message(
      cloud
        ? "Orçamento salvo no Supabase."
        : "Orçamento salvo somente neste navegador. Exporte o JSON para backup.",
    );
    return structuredClone(quote);
  }
  $("estimate-save").onclick = async () => {
    try {
      await save();
    } catch (e) {
      message(e.message);
    }
  };
  async function pdf(preview) {
    if (pdfBusy) return;
    const button = $(preview ? "estimate-preview-button" : "estimate-pdf"),
      label = button.textContent;
    try {
      readForm();
      validateEstimate(quote);
      pdfBusy = true;
      button.textContent = preview ? "Carregando prévia…" : "Gerando PDF…";
      button.setAttribute("aria-busy", "true");
      renderSummary();
      message(
        preview
          ? "Preparando prévia do orçamento…"
          : "Gerando PDF do orçamento…",
      );
      const requestedVersion = previewVersion;
      const snapshot = structuredClone(quote);
      if (!preview) await save();
      const { estimatePDF } = await import("./estimate-pdf.js");
      const file = await estimatePDF(snapshot);
      if (preview && requestedVersion !== previewVersion) return;
      if (preview) {
        invalidate();
        previewURL = URL.createObjectURL(
          new Blob([file.bytes], { type: "application/pdf" }),
        );
        const version = previewVersion;
        $("estimate-preview-open").href = previewURL;
        $("estimate-preview").hidden = false;
        $("estimate-preview-pages").textContent = "Carregando páginas…";
        $("estimate-preview").scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        message("Carregando a prévia do orçamento…");
        try {
          const { renderEstimatePreview } =
            await import("./estimate-preview.js");
          const dispose = await renderEstimatePreview(
            file.bytes,
            $("estimate-preview-pages"),
            () => version === previewVersion,
          );
          if (version !== previewVersion) {
            dispose();
            return;
          }
          disposePreview = dispose;
          message("Prévia atualizada. Custos internos não aparecem no PDF.");
        } catch (error) {
          if (version !== previewVersion) return;
          $("estimate-preview-pages").textContent =
            "Não foi possível exibir as páginas neste navegador. Use o link acima para abrir o PDF.";
          message("PDF gerado. Use ‘Abrir PDF em outra aba’ para visualizar.");
        }
      } else
        download(
          new Blob([file.bytes], { type: "application/pdf" }),
          file.name,
        );
    } catch (e) {
      message(e.message);
    } finally {
      ((pdfBusy = false), (cleanSnapshot = ""), (pendingTransition = null));
      const finance = initFinance({
        getState,
        getQuotes: () => records,
        openQuote: (id) => requestTransition(() => openQuote(id)),
      });
      $("finance-refresh").onclick = () => refresh();
      const workReports = initWorkReports({
        getQuotes: () => records,
        openQuote: (id) => requestTransition(() => openQuote(id)),
      });
      button.textContent = label;
      button.removeAttribute("aria-busy");
      renderSummary();
    }
  }
  $("estimate-pdf").onclick = () => pdf(false);
  $("estimate-preview-button").onclick = () => pdf(true);
  function download(blob, name) {
    const link = document.createElement("a"),
      url = URL.createObjectURL(blob);
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  $("estimate-export-json").onclick = () => {
    try {
      readForm();
      validateEstimate(quote);
      download(
        new Blob(
          [JSON.stringify({ type: "papeled-estimate", quote }, null, 2)],
          { type: "application/json" },
        ),
        quote.number + ".orcamento.json",
      );
    } catch (e) {
      message(e.message);
    }
  };
  $("estimate-import-json").onchange = async (e) => {
    try {
      const raw = JSON.parse(await e.target.files[0].text());
      if (raw.type !== "papeled-estimate")
        throw Error("Use um orçamento JSON exportado por este módulo.");
      validateEstimate(raw.quote);
      quote = {
        ...raw.quote,
        pricing: { ...DEFAULT_PRICING, ...raw.quote.pricing },
      };
      sync();
      $("estimate-editor").hidden = false;
      invalidate();
      message("Orçamento importado. Revise e salve.");
    } catch (error) {
      message(error.message);
    } finally {
      e.target.value = "";
    }
  };
  function renderHistory() {
    const term = $("estimate-history-search").value.toLocaleLowerCase("pt-BR");
    const visible = records
      .filter(
        (q) =>
          $("estimate-history-filter").value === "all" ||
          ($("estimate-history-filter").value === "archived"
            ? !!q.archivedAt
            : !q.archivedAt),
      )
      .filter((q) =>
        [q.number, q.customer, q.title]
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(term),
      );
    $("estimate-history-list").innerHTML =
      visible
        .map((q) => {
          let total;
          try {
            total = brl(calculateEstimate(q).total);
          } catch {
            total = "Revisar";
          }
          return `<article class="card history-row"><div><strong>${esc(q.number)}</strong><h3>${esc(q.customer || "Cliente não informado")}</h3><p class="muted">${esc(q.title)} · ${esc(q.issuedOn || "")}${q.archivedAt ? ` · Arquivado: ${q.status === "cancelled" ? "cancelado" : "concluído"}` : ""}</p></div><strong>${total}</strong><div class="actions"><button data-open-estimate="${esc(q.id)}">Abrir proposta</button><button class="secondary" data-clone-estimate="${esc(q.id)}">Duplicar</button>${q.archivedAt ? `<button class="secondary" data-restore-estimate="${esc(q.id)}">Restaurar no Kanban</button>` : ""}</div></article>`;
        })
        .join("") || '<div class="card">Nenhum orçamento encontrado.</div>';
    bindOpen();
    $("estimate-history-list")
      .querySelectorAll("[data-restore-estimate]")
      .forEach(
        (button) =>
          (button.onclick = async () => {
            try {
              await updateRecord(button.dataset.restoreEstimate, {
                archivedAt: null,
                archiveReason: null,
                status:
                  records.find((q) => q.id === button.dataset.restoreEstimate)
                    ?.archiveReason === "completed"
                    ? "completed"
                    : "draft",
              });
              message(
                "Orçamento restaurado no Kanban. Pagamentos preservados.",
              );
            } catch (e) {
              message(e.message);
            }
          }),
      );
  }
  $("estimate-history-search").oninput = renderHistory;
  $("estimate-history-filter").onchange = renderHistory;
  function openQuote(id, clone = false) {
    try {
      const source = records.find((q) => q.id === id);
      validateEstimate(source);
      quote = structuredClone(source);
      if (clone) {
        const fresh = newEstimate(profile);
        Object.assign(quote, {
          id: fresh.id,
          number: fresh.number,
          issuedOn: fresh.issuedOn,
          createdAt: fresh.createdAt,
          status: "draft",
          paymentStatus: "pending",
          paymentDate: "",
          archivedAt: null,
          archiveReason: null,
        });
      }
      invalidate();
      sync();
      cleanSnapshot = JSON.stringify(quote);
      $("estimate-editor").hidden = false;
      navigate("estimates");
      $("estimate-editor").scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      message(error.message);
    }
  }
  function bindOpen() {
    document
      .querySelectorAll(
        "#estimate-history [data-open-estimate],#estimate-history [data-clone-estimate],#estimate-history-list [data-open-estimate],#estimate-history-list [data-clone-estimate]",
      )
      .forEach(
        (button) =>
          (button.onclick = () =>
            requestTransition(() =>
              openQuote(
                button.dataset.openEstimate || button.dataset.cloneEstimate,
                !!button.dataset.cloneEstimate,
              ),
            )),
      );
  }
  async function updateRecord(id, changes) {
    const previous = records.find((row) => row.id === id),
      next = {
        ...structuredClone(previous),
        ...changes,
        updatedAt: new Date().toISOString(),
      };
    validateEstimate(next);
    if (cloud) {
      const result = await getState()
        .client.from("issued_quotes")
        .update({ data: next, updated_at: next.updatedAt })
        .eq("id", id)
        .select("id")
        .single();
      if (result.error)
        throw Error("Não foi possível atualizar no banco. Tente novamente.");
    } else {
      const rows = read(KEY, []);
      const index = rows.findIndex((row) => row.id === id);
      if (index < 0) throw Error("Orçamento não encontrado.");
      rows[index] = next;
      store(KEY, rows);
    }
    if (quote.id === id) {
      const wasClean = JSON.stringify(quote) === cleanSnapshot;
      Object.assign(quote, changes);
      for (const key of ["status", "paymentStatus", "paymentDate"])
        form.elements[key].value = quote[key] ?? "";
      if (wasClean) cleanSnapshot = JSON.stringify(quote);
      if (!$("estimate-editor").hidden)
        store("papeled-estimate-draft-v1", quote);
    }
    await refresh();
    message("Etapa e pagamento atualizados.");
  }
  async function refresh() {
    profile = read(PROFILE, {});
    const state = getState();
    cloud = false;
    if (!state.local && state.client) {
      try {
        const rows = await loadAllRows(
          state.client,
          "issued_quotes",
          "id,data",
        );
        records = rows
          .map((r) => r.data)
          .sort((a, b) =>
            (b.updatedAt || b.createdAt || "").localeCompare(
              a.updatedAt || a.createdAt || "",
            ),
          );
        cloud = true;
        const presets = await state.client
          .from("pricing_profiles")
          .select("data")
          .eq("id", "default")
          .maybeSingle();
        if (!presets.error && presets.data) profile = presets.data.data;
      } catch {
        records = read(KEY, []);
      }
    } else records = read(KEY, []);
    $("estimate-storage").textContent = cloud
      ? "Orçamentos conectados ao Supabase. Histórico completo."
      : "Armazenamento local neste navegador. Para sincronizar, instale a área de orçamentos no Supabase. Use JSON para backup.";
    renderEstimateKanban($("estimate-history"), records, updateRecord, message);
    renderHistory();
    await finance.refresh();
    workReports.render();
    $("production-summary").innerHTML = [
      [
        "Em execução",
        records.filter((q) => !q.archivedAt && q.status === "in_progress")
          .length,
      ],
      [
        "Aguardando entrega",
        records.filter((q) => !q.archivedAt && q.status === "completed").length,
      ],
      [
        "Pagamento pendente",
        records.filter((q) => !q.archivedAt && q.paymentStatus !== "paid")
          .length,
      ],
    ]
      .map(
        ([label, value]) =>
          `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`,
      )
      .join("");
    if (!active) {
      active = true;
      const draft = read("papeled-estimate-draft-v1", null);
      try {
        validateEstimate(draft);
        quote = draft;
        $("estimate-editor").hidden = false;
      } catch {
        quote = newEstimate(profile);
      }
      sync();
      const saved = records.find((r) => r.id === quote.id);
      if (saved) cleanSnapshot = JSON.stringify(saved);
    }
  }
  return {
    refresh,
    refreshCatalog: async () => {
      await refresh();
      renderItems();
      renderSummary();
    },
    fromRequest: (source) =>
      requestTransition(() =>
        start(
          modelById(source.project?.model || source.settings?.model)
            ?.category === "print"
            ? "print"
            : "laser",
          source,
        ),
      ),
  };
}
