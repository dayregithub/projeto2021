import {
  archiveFolder,
  chooseArchiveFolder,
  forgetArchiveFolder,
  authorizeArchiveFolder,
  archiveFiles,
  writeArchive,
  archiveZip,
} from "./estimate-archive.js";
import { customerContacts } from "./customer-contacts.js";
import { quoteFingerprint } from "./quote-edit-state.js";
import { costSummaryHTML } from "./estimate-cost-summary.js";
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
    const contacts = customerContacts(quote);
    quote.customerPhone = contacts.phone;
    quote.customerEmail = contacts.email;
    $("estimate-format-note").hidden =
      quote.calculationVersion === 2 &&
      !quote.items.some(
        (item) => item.process === "print" && !item.printInputMode,
      );
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
      "customerPhone",
      "customerEmail",
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
    const phone = form.elements.customerPhone.value.trim(),
      email = form.elements.customerEmail.value.trim();
    if (
      phone !== (quote.customerPhone || "") ||
      email !== (quote.customerEmail || "")
    )
      form.elements.contact.value = [phone, email].filter(Boolean).join(" | ");

    for (const key of [
      "number",
      "issuedOn",
      "customer",
      "contact",
      "customerPhone",
      "customerEmail",
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
  function materialChoices(item) {
    const current = materialFor(item, quote.pricing);
    const catalog = (profile.materials || []).filter(
      (entry) => entry.process === item.process,
    );
    const names = [...new Set(catalog.map((entry) => entry.material.name))];
    const missing = item.materialSelectionRequired && !item.material;
    const saved =
      item.material || (!item.materialSelectionRequired ? current : null);
    if (saved && !names.includes(saved.name)) names.unshift(saved.name);
    return names.length
      ? (missing
          ? '<option value="" selected>Selecione um material cadastrado</option>'
          : "") +
          names
            .map(
              (name) =>
                `<option ${!missing && name === current.name ? "selected" : ""} value="${esc(name)}">${esc(name)}${!catalog.some((entry) => entry.material.name === name) ? " · salvo neste orçamento" : ""}</option>`,
            )
            .join("")
      : '<option value="">Nenhum material cadastrado</option>';
  }
  function newItem(process) {
    const entry = (profile.materials || []).find((m) => m.process === process);
    return {
      ...newEstimateItem(process),
      materialMode: process === "print" ? "included" : "none",
      materialQuantity: 0,
      primaryService: null,
      material: entry ? structuredClone(entry.material) : null,
      materialSelectionRequired: true,
      ...(process === "print" ? { printInputMode: "piece" } : {}),
    };
  }
  function materialFields(item) {
    const m = materialFor(item, quote.pricing);
    return `<div class="estimate-material"><label>Material<select data-material-name>${materialChoices(item)}</select></label><p class="muted" data-material-summary>${esc(m.name)} · ${brl(m.price)}/${item.process === "laser" ? `chapa de ${m.width} × ${m.length} cm` : "kg"}${m.specification ? " · " + esc(m.specification) : ""}</p></div>`;
  }
  function serviceFields(item) {
    return `<fieldset class="estimate-services"><legend>Serviços adicionais</legend><div class="service-entry"><label>Serviço / recurso<select data-service-pick aria-label="Adicionar serviço ou recurso"><option value="">Selecione um cadastro</option>${(profile.services || []).map((s, i) => `<option value="${i}">${esc(s.name)} · ${brl(s.price)}/${s.unit}</option>`).join("")}</select></label><label>Quantidade<input data-new-service-quantity type="number" min="0" step="any" value="1"></label><button type="button" data-service-add>+ Adicionar</button></div>${(item.services || []).map((s, i) => `<div class="service-line"><span>${esc(s.name)} · ${brl(s.price)}/${s.unit}</span><label>Quantidade (${s.unit})<input data-service-quantity="${i}" type="number" min="0" step="any" value="${s.quantity}"></label><button type="button" class="secondary" data-service-remove="${i}">Remover</button></div>`).join("")}<p class="muted">${quote.calculationVersion === 2 ? "Quantidade total de cada serviço, independente da quantidade de peças." : "Orçamento anterior: valores e quantidades originais preservados."}</p></fieldset>`;
  }
  function printFields(item, i) {
    const m = materialFor(item, quote.pricing),
      perPiece = item.printInputMode === "piece",
      missing = item.materialSelectionRequired && !item.material;
    const unit = perPiece ? "por peça" : "do lote completo";
    return `<article class="card estimate-item print-estimate-item" data-row="${item.id}"><div class="heading"><h3>Item ${i + 1} · Impressão 3D</h3><div><button type="button" class="secondary" data-copy="${i}">Duplicar</button><button type="button" class="secondary" data-remove="${i}">Remover</button></div></div>
      <label>Descrição do projeto<textarea data-item="description" maxlength="1200" rows="2">${esc(item.description)}</textarea></label>
      <div class="grid"><label>Medidas do fatiador<select data-item="printInputMode"><option value="piece" ${perPiece ? "selected" : ""}>Peso e tempo por peça</option><option value="batch" ${!perPiece ? "selected" : ""}>Peso e tempo do lote completo</option></select></label>${itemField("quantity", "Quantidade de peças", item.quantity)}</div>
      <div class="estimate-material" data-material-group><div class="grid"><label>Filamento / material<select data-material-name>${materialChoices(item)}</select></label><label>Preço de compra do filamento (R$/kg)<input type="number" min="0" step="any" data-material-cost ${missing ? "disabled" : ""} value="${missing ? "" : m.price}"></label></div><p class="muted" data-material-summary>${missing ? "Cadastre o filamento em Materiais e serviços e selecione-o nesta proposta." : esc(m.name) + " · " + esc(m.specification || "Preço usado neste projeto; não altera o cadastro do material.")}</p></div>
      <div class="grid">${itemField("grams", `Peso ${unit} (g)`, item.grams)}${itemField("hours", `Duração ${unit} (horas)`, item.hours)}</div>
      <p data-time-result class="muted">Inclua suportes e purga no peso informado pelo fatiador.</p>
      <label>Fornecimento do filamento<select data-item="materialMode"><option value="included" ${item.materialMode === "included" ? "selected" : ""}>Filamento da Papeled Maker</option><option value="provided" ${item.materialMode === "provided" ? "selected" : ""}>Filamento do cliente · sem cobrança do material</option><option value="none" ${item.materialMode === "none" ? "selected" : ""}>Somente serviço · sem cobrança do material</option></select></label>
      <details class="item-extra"><summary>Pintura, acabamento e ajustes deste projeto</summary><div class="grid">${itemField("handlingMinutes", `Trabalho manual ${unit} (min)`, item.handlingMinutes)}${itemField("paintingCost", `Tinta / pintura ${unit} (R$ de custo)`, item.paintingCost)}${itemField("extras", `Embalagem / outros ${unit} (R$ de custo)`, item.extras)}${itemField("lossPercent", "Material extra para perdas (%)", item.lossPercent)}</div><p class="muted">Campos opcionais. Não repita a mesma pintura ou acabamento nos serviços adicionais.</p></details>
      <details class="item-extra" ${(item.services || []).length ? "open" : ""}><summary>Serviços adicionais cadastrados</summary>${serviceFields(item)}</details>
      <p data-item-result class="item-total"></p></article>`;
  }
  function simpleFields(item, i) {
    if (
      item.process === "print" &&
      ["piece", "batch"].includes(item.printInputMode)
    )
      return printFields(item, i);
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
      <div class="estimate-material" data-material-group ${mode !== "included" ? "hidden" : ""}><div class="grid"><label>Tipo de material<select data-material-name>${materialChoices(item)}</select></label>${itemField("materialQuantity", `Quantidade total de material (${item.process === "print" ? "g" : m.unit || "chapa"})`, item.materialQuantity ?? 0)}</div><p class="muted" data-material-summary>${esc(m.name)} · ${brl(m.salePrice ?? m.price * (1 + (item.process === "laser" ? (quote.pricing.laserMaterialMarkup ?? quote.pricing.markupPercent) : (quote.pricing.printMarkup ?? quote.pricing.markupPercent)) / 100))}/${item.process === "print" ? "kg" : m.unit || "chapa"}</p></div>
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
      .forEach((row) =>
        row.insertAdjacentHTML(
          "beforeend",
          '<details class="item-extra"><summary>Conferir custos calculados deste projeto</summary><div data-print-cost-result data-project-cost-result></div></details>',
        ),
      );
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
        const costInput = row.querySelector("[data-material-cost]");
        if (costInput)
          costInput.oninput = () => {
            const item = quote.items[index];
            item.material = {
              ...materialFor(item, quote.pricing),
              price: costInput.value === "" ? NaN : Number(costInput.value),
            };
            invalidate();
            renderSummary();
          };
        row.querySelector("[data-material-name]").onchange = (e) => {
          const item = quote.items[index],
            name = e.target.value;
          if (!name) return;
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
                    key === "materialMode" ||
                    key === "printInputMode"
                  ? input.value
                  : input.value === ""
                    ? key === "manualUnitPrice"
                      ? null
                      : NaN
                    : Number(input.value);
            if (key === "printInputMode") renderItems();
            if (key === "materialMode" && !quote.items[index].printInputMode) {
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
          row.textContent = item.printInputMode
            ? `Preço sugerido: ${brl(item.subtotal)} · ${brl(item.unitPrice)}/peça · ${brl(item.pricePerGram)}/g`
            : `Serviço: ${brl(item.serviceAmount)} · Material: ${brl(item.materialAmount)} · Adicionais: ${brl(item.additionalAmount)} · Total: ${brl(item.subtotal)}`;
          const info = row
            .closest("[data-row]")
            .querySelector("[data-time-result]");
          if (info)
            info.textContent =
              item.process === "laser"
                ? `${item.minutes} min × ${item.quantity} = ${item.totalMinutes} minutos (${durationLabel(item.totalMinutes)}). ${item.ratePerMinute.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 6 })}/min.`
                : item.printInputMode
                  ? `${item.totalGrams.toLocaleString("pt-BR")} g · ${item.totalHours.toLocaleString("pt-BR")} h no lote de ${item.quantity} peça(s).`
                  : `${item.hours} h × ${item.quantity} peça(s).`;
        } else if (row)
          row.textContent = `${brl(item.unitPrice)} por peça · Total do item: ${brl(item.subtotal)}`;
        if (row)
          row
            .closest("[data-row]")
            .querySelector("[data-project-cost-result]").innerHTML =
            costSummaryHTML(item, quote, result);
      });
      $("estimate-summary").insertAdjacentHTML(
        "beforeend",
        `<details class="item-extra"><summary>Impostos e resultado geral</summary><dl class="machine-cost-breakdown"><div><dt>Venda total</dt><dd>${brl(result.total)}</dd></div><div><dt>Base tributável após descontos e ajustes</dt><dd>${brl(result.taxable)}</dd></div><div><dt>Impostos inclusos (${quote.pricing.taxPercent.toLocaleString("pt-BR")}%)</dt><dd>${brl(result.tax)}</dd></div><div><dt>Custo total · inclui preparação e frete</dt><dd>${brl(result.cost)}</dd></div><div class="machine-cost-total"><dt>Resultado após impostos</dt><dd>${brl(result.profit)}</dd></div></dl><p class="muted">Imposto já incluído no preço de venda. Frete tratado como repasse fora da base tributável.</p></details>`,
      );
      const currentTax =
        profile.pricing?.taxPercent ?? DEFAULT_PRICING.taxPercent;
      if (currentTax !== quote.pricing.taxPercent) {
        $("estimate-summary").insertAdjacentHTML(
          "beforeend",
          `<p class="muted">Esta proposta usa imposto de ${quote.pricing.taxPercent.toLocaleString("pt-BR")}%. O cadastro atual está em ${currentTax.toLocaleString("pt-BR")}%.</p><button type="button" class="secondary" data-refresh-quote-tax>Aplicar imposto atual do cadastro (${currentTax.toLocaleString("pt-BR")}%)</button><p class="muted">Aplicar a taxa recalcula o resultado e pode alterar o preço no método de margem. Salve a proposta para registrar a alteração.</p>`,
        );
        $("estimate-summary").querySelector(
          "[data-refresh-quote-tax]",
        ).onclick = () => {
          quote.pricing.taxPercent = currentTax;
          invalidate();
          renderSummary();
        };
      }
      $("estimate-save").disabled =
        $("estimate-pdf").disabled =
        $("estimate-preview-button").disabled =
          pdfBusy;
    } catch (error) {
      $("estimate-summary").textContent = error.message;
      $("estimate-items")
        .querySelectorAll("[data-print-cost-result]")
        .forEach((node) => node.replaceChildren());
      $("estimate-items")
        .querySelectorAll("[data-item-result]")
        .forEach(
          (node) =>
            (node.textContent =
              "Preencha os dados válidos para calcular este orçamento."),
        );
      $("estimate-save").disabled =
        $("estimate-pdf").disabled =
        $("estimate-preview-button").disabled =
          true;
    }
  }
  form.addEventListener("input", (e) => {
    if (e.target.closest("#estimate-items")) return;
    if (
      e.target.name === "status" &&
      e.target.value === "cancelled" &&
      quote.status !== "cancelled"
    ) {
      e.target.value = quote.status;
      showRecordOperation("cancel", quote.id, true);
      return;
    }
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
    quote.items = [newItem(process)];
    if (process === "laser" && profile.pricing?.markupPercent === undefined)
      quote.pricing.markupPercent = 100;
    if (source) {
      quote.customer = source.customer_name || "";
      quote.contact = source.contact || "";
      quote.customerPhone = source.phone || source.customer_phone || "";
      quote.customerEmail = source.email || source.customer_email || "";
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
    cleanSnapshot = quoteFingerprint(quote);
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
  function isDirty() {
    if ($("estimate-editor").hidden) return false;
    readForm();
    return quoteFingerprint(quote) !== cleanSnapshot;
  }
  window.addEventListener("beforeunload", (event) => {
    if (isDirty()) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  function requestTransition(action) {
    if (pdfBusy) {
      message("Aguarde a geração do PDF antes de sair.");
      return;
    }
    if (isDirty()) {
      pendingTransition = action;
      $("estimate-leave-status").textContent = "";
      $("estimate-leave-dialog").showModal();
    } else action();
  }
  $("estimate-close").onclick = () => requestTransition(closeEditor);
  const folderStatus = $("archive-folder-status");
  const foldersSupported = typeof window.showDirectoryPicker === "function";
  async function showFolder() {
    try {
      const folder = await archiveFolder();
      folderStatus.textContent = foldersSupported
        ? folder
          ? `Pasta selecionada: ${folder.name}. Você pode trocá-la aqui.`
          : "Nenhuma pasta selecionada. Escolha uma para arquivar diretamente no computador."
        : "Este navegador usa download ZIP. Para salvar diretamente em uma pasta, use Chrome ou Edge no computador.";
    } catch {
      folderStatus.textContent =
        "Não foi possível recuperar a pasta. Escolha-a novamente; se o navegador bloquear o armazenamento, use outro perfil.";
    }
  }
  $("archive-folder-choose").disabled = !foldersSupported;
  $("archive-folder-choose").onclick = async () => {
    try {
      await chooseArchiveFolder();
      await showFolder();
    } catch (error) {
      if (error.name !== "AbortError")
        folderStatus.textContent = `Não foi possível selecionar a pasta: ${error.message}`;
    }
  };
  $("archive-folder-forget").onclick = async () => {
    try {
      await forgetArchiveFolder();
      await showFolder();
    } catch (error) {
      folderStatus.textContent = error.message;
    }
  };
  showFolder();
  $("estimate-archive").onclick = async () => {
    if (pdfBusy) return;
    const button = $("estimate-archive");
    button.disabled = true;
    pdfBusy = true;
    try {
      // Ask for permission before saving/generating, while the click is active.
      const folder = foldersSupported ? await authorizeArchiveFolder() : null;
      message("Salvando e preparando arquivos do orçamento…");
      const snapshot = await save();
      const { estimatePDF } = await import("./estimate-pdf.js");
      const archive = archiveFiles(snapshot, await estimatePDF(snapshot));
      if (folder) await writeArchive(folder, archive);
      else
        download(
          new Blob([archiveZip(archive)], { type: "application/zip" }),
          `${archive.folder}.zip`,
        );
      closeEditor();
      message(
        folder
          ? `Orçamento salvo e arquivado em ${folder.name}/${archive.folder}. PDF e cópia editável atualizados.`
          : "Orçamento salvo. Download ZIP solicitado; confirme o download e extraia a pasta para arquivar no computador.",
      );
    } catch (error) {
      message(
        `Arquivamento não concluído: ${error.message} O orçamento permanece aberto; se o salvamento já terminou, ele está no histórico. Tente novamente.`,
      );
    } finally {
      pdfBusy = false;
      button.disabled = false;
      renderSummary();
    }
  };

  $("estimate-new").onclick = () => {
    const process =
      !$("estimate-editor").hidden &&
      quote.items.every((item) => item.process === quote.items[0].process)
        ? quote.items[0].process
        : null;
    requestTransition(() => {
      if (process) start(process);
      else {
        closeEditor();
        $("estimate-new-dialog").showModal();
      }
    });
  };
  $("estimate-new-back").onclick = () => $("estimate-new-dialog").close();
  $("estimate-leave-dialog").addEventListener("cancel", () => {
    pendingTransition = null;
  });
  $("estimate-leave-back").onclick = () => {
    pendingTransition = null;
    $("estimate-leave-dialog").close();
  };
  $("estimate-leave-discard").onclick = () => {
    const action = pendingTransition;
    pendingTransition = null;
    $("estimate-leave-dialog").close();
    const saved = records.find((row) => row.id === quote.id);
    if (saved) {
      quote = structuredClone(saved);
      sync();
      cleanSnapshot = quoteFingerprint(quote);
    } else closeEditor();
    localStorage.removeItem("papeled-estimate-draft-v1");
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
      quote.items.push(
        quote.calculationVersion === 2
          ? newItem(process)
          : newEstimateItem(process),
      );
      renderItems();
      invalidate();
      renderSummary();
    };
  async function save() {
    if (getState().client && !getState().local && !cloud)
      throw Error(
        "Não foi possível conectar aos orçamentos no banco. Atualize a conexão antes de salvar.",
      );
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
    readForm();
    cleanSnapshot = quoteFingerprint(quote);
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
      pdfBusy = false;
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
  let recordOperation = null,
    recordBusy = false;
  function showRecordOperation(type, id, editor = false) {
    if (recordBusy || pdfBusy) return;
    const target = editor ? quote : records.find((row) => row.id === id);
    if (!target) return;
    recordOperation = { type, id: target.id, editor };
    const saved = records.some((row) => row.id === target.id);
    $("estimate-record-title").textContent =
      type === "delete"
        ? "Excluir orçamento definitivamente?"
        : "Cancelar orçamento?";
    $("estimate-record-description").textContent =
      `${target.number} · ${target.customer || "Cliente não informado"} · ${target.title}. ` +
      (type === "delete"
        ? saved
          ? "O registro será removido do banco, histórico, Kanban e relatórios; seus valores deixarão de compor o financeiro. Esta ação não pode ser desfeita."
          : "Este rascunho ainda não foi salvo no histórico e será descartado."
        : "Será salvo com status Cancelado e arquivado. Dados e pagamentos já registrados serão preservados no sistema e no banco.");
    $("estimate-record-confirm").textContent =
      type === "delete"
        ? "Sim, excluir definitivamente"
        : "Sim, confirmar cancelamento";
    $("estimate-record-status").textContent = "";
    $("estimate-record-dialog").showModal();
  }
  function bindRecordActions(root) {
    root
      .querySelectorAll("[data-cancel-record]")
      .forEach(
        (button) =>
          (button.onclick = () =>
            showRecordOperation("cancel", button.dataset.cancelRecord)),
      );
    root
      .querySelectorAll("[data-delete-record]")
      .forEach(
        (button) =>
          (button.onclick = () =>
            showRecordOperation("delete", button.dataset.deleteRecord)),
      );
  }
  $("estimate-cancel").onclick = () =>
    showRecordOperation("cancel", quote.id, true);
  $("estimate-delete").onclick = () =>
    showRecordOperation("delete", quote.id, true);
  $("estimate-record-back").onclick = () => {
    recordOperation = null;
    $("estimate-record-dialog").close();
  };
  $("estimate-record-dialog").addEventListener("cancel", (event) => {
    if (recordBusy) event.preventDefault();
  });
  $("estimate-record-confirm").onclick = async () => {
    const operation = recordOperation;
    if (!operation || recordBusy) return;
    recordBusy = true;
    $("estimate-record-confirm").disabled = true;
    $("estimate-record-back").disabled = true;
    try {
      if (getState().client && !getState().local && !cloud)
        throw Error(
          "Não foi possível conectar ao banco. Atualize a conexão e tente novamente.",
        );
      if (operation.type === "cancel") {
        const changes = {
          status: "cancelled",
          archivedAt: new Date().toISOString(),
          archiveReason: "cancelled",
        };
        if (operation.editor) {
          readForm();
          const previous = {
            status: quote.status,
            archivedAt: quote.archivedAt,
            archiveReason: quote.archiveReason,
          };
          Object.assign(quote, changes);
          form.elements.status.value = quote.status;
          try {
            await save();
          } catch (error) {
            Object.assign(quote, previous);
            form.elements.status.value = quote.status;
            throw error;
          }
        } else await updateRecord(operation.id, changes);
      } else {
        if (records.some((row) => row.id === operation.id) && cloud) {
          const result = await getState()
            .client.from("issued_quotes")
            .delete()
            .eq("id", operation.id)
            .select("id")
            .single();
          if (result.error)
            throw Error(
              "Não foi possível excluir do banco. O registro foi mantido; tente novamente.",
            );
        }
        store(
          KEY,
          read(KEY, []).filter((row) => row.id !== operation.id),
        );
        if (read("papeled-estimate-draft-v1", null)?.id === operation.id)
          localStorage.removeItem("papeled-estimate-draft-v1");
        await refresh();
      }
      if (quote.id === operation.id) {
        closeEditor();
        if (operation.type === "delete") {
          quote = newEstimate(profile);
          form.reset();
          $("estimate-items").replaceChildren();
          $("estimate-summary").replaceChildren();
          $("estimate-editor-title").textContent = "";
        }
      }
      recordOperation = null;
      $("estimate-record-dialog").close();
      navigate("estimate-history");
      message(
        operation.type === "cancel"
          ? "Orçamento cancelado e salvo. Dados e pagamentos preservados."
          : "Orçamento excluído. Histórico, produção, relatórios e financeiro atualizados.",
      );
    } catch (error) {
      $("estimate-record-status").textContent = error.message;
    } finally {
      recordBusy = false;
      $("estimate-record-confirm").disabled = false;
      $("estimate-record-back").disabled = false;
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
          return `<article class="card history-row"><div><strong>${esc(q.number)}</strong><h3>${esc(q.customer || "Cliente não informado")}</h3><p class="muted">${esc(q.title)} · ${esc(q.issuedOn || "")}${q.archivedAt ? ` · Arquivado: ${q.status === "cancelled" ? "cancelado" : "concluído"}` : ""}</p></div><strong>${total}</strong><div class="actions"><button data-open-estimate="${esc(q.id)}">Abrir proposta</button><button class="secondary" data-clone-estimate="${esc(q.id)}">Duplicar</button><button class="secondary" data-cancel-record="${esc(q.id)}">Cancelar orçamento</button><button class="secondary danger" data-delete-record="${esc(q.id)}">Excluir orçamento</button>${q.archivedAt ? `<button class="secondary" data-restore-estimate="${esc(q.id)}">Restaurar no Kanban</button>` : ""}</div></article>`;
        })
        .join("") || '<div class="card">Nenhum orçamento encontrado.</div>';
    bindOpen();
    bindRecordActions($("estimate-history-list"));
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
      cleanSnapshot = quoteFingerprint(quote);
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
      const wasClean = quoteFingerprint(quote) === cleanSnapshot;
      Object.assign(quote, changes);
      for (const key of ["status", "paymentStatus", "paymentDate"])
        form.elements[key].value = quote[key] ?? "";
      if (wasClean) cleanSnapshot = quoteFingerprint(quote);
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
    renderEstimateKanban(
      $("estimate-history"),
      records,
      updateRecord,
      message,
      (id) => showRecordOperation("cancel", id),
    );
    bindRecordActions($("estimate-history"));
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
      if (saved) {
        const contacts = customerContacts(saved);
        cleanSnapshot = quoteFingerprint({
          ...saved,
          customerPhone: contacts.phone,
          customerEmail: contacts.email,
        });
      }
    }
  }
  return {
    refresh,
    leaveForNavigation: (action) => requestTransition(action),
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
