import { renderEstimateKanban } from "./estimate-kanban.js";
import {
  MATERIAL_NAMES,
  materialFor,
  validateMaterial,
} from "./estimate-materials.js";
import {
  DEFAULT_PRICING,
  DEFAULT_LAYOUT,
  newEstimate,
  newEstimateItem,
  calculateEstimate,
  validateEstimate,
  brl,
  laserOperating,
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
const pricingFields = [
  ["laserInvestment", "Investimento laser (R$)"],
  ["tubePrice", "Troca / recarga do tubo (R$)"],
  ["tubeLifeHours", "Vida útil do tubo (horas)"],
  ["machineKw", "Consumo laser (kW)"],
  ["laserEnergy", "Energia laser (R$/kWh)"],
  ["operators", "Número de operadores"],
  ["operatorMonthly", "Custo mensal por operador (R$)"],
  ["workingDays", "Dias produtivos por mês"],
  ["workingHours", "Horas produtivas por dia"],
  ["depreciationMonths", "Depreciação laser (meses)"],
  ["overheadMonthly", "Custos fixos adicionais / mês (R$)"],
  ["laserMaintenanceHour", "Manutenção laser (R$/h)"],
  ["laserSaleHour", "Tarifa comercial laser (R$/h)"],
  ["sheetWidth", "Largura da chapa MDF (cm)"],
  ["sheetLength", "Comprimento da chapa MDF (cm)"],
  ["sheetPrice", "Preço da chapa MDF (R$)"],
  ["filamentKg", "Filamento (R$/kg)"],
  ["printerWatts", "Consumo impressora (W)"],
  ["printEnergy", "Energia impressão (R$/kWh)"],
  ["printerInvestment", "Investimento impressora (R$; 0 desativa)"],
  ["printerLifeHours", "Vida útil impressora (horas)"],
  ["printMaintenanceHour", "Manutenção impressora (R$/h)"],
  ["laborHour", "Acabamento / trabalho manual (R$/h)"],
  ["markupPercent", "Acréscimo sobre custo (%)"],
  ["marginPercent", "Margem desejada sobre venda (%)"],
  ["taxPercent", "Impostos já inclusos na venda (%)"],
];
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
    pdfBusy = false;
  const message = (text) => ($("estimate-status").textContent = text);
  const read = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  };
  const store = (key, value) =>
    localStorage.setItem(key, JSON.stringify(value));
  function field(key, label, value, type = "number", scope = "pricing") {
    return `<label>${esc(label)}<input data-${scope}="${key}" type="${type}" ${type === "number" ? 'step="any"' : ""} value="${esc(value)}"></label>`;
  }
  const pricingGroups = [
    [
      "laser",
      "Corte e gravação a laser",
      pricingFields.slice(0, 16),
      "Chapa MDF, tubo, máquina e tarifa por minuto. Estes custos são usados somente nos itens de laser.",
    ],
    [
      "print",
      "Impressão 3D",
      pricingFields.slice(16, 22),
      "Filamento em gramas, tempo de impressão em horas e consumo em watts. Estes custos são usados somente nos itens 3D.",
    ],
    [
      "common",
      "Regras comerciais e acabamento",
      pricingFields.slice(22),
      "Regras compartilhadas pelos itens deste orçamento: trabalho manual, acréscimo, margem e impostos.",
    ],
  ];
  $("estimate-pricing").innerHTML = pricingGroups
    .map(
      ([process, title, fields, note]) =>
        `<section data-pricing-process="${process}"><h4>${title}</h4><p class="muted">${note}</p><div class="grid three">${fields.map(([key, label]) => field(key, label, DEFAULT_PRICING[key])).join("")}</div></section>`,
    )
    .join("");
  $("estimate-layout-fields").innerHTML = [
    ["businessName", "Nome da empresa"],
    ["tagline", "Subtítulo"],
    ["title", "Título do documento"],
    ["phone", "Telefone / WhatsApp"],
    ["email", "E-mail"],
    ["businessId", "CPF / CNPJ da empresa"],
    ["address", "Endereço"],
    ["footer", "Rodapé"],
  ]
    .map(([key, label]) =>
      field(key, label, DEFAULT_LAYOUT[key], "text", "layout"),
    )
    .join("");
  function sync() {
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
    for (const [key] of pricingFields)
      form.querySelector(`[data-pricing="${key}"]`).value = quote.pricing[key];
    form
      .querySelectorAll("[data-layout]")
      .forEach((input) => (input.value = quote.layout[input.dataset.layout]));
    form.elements.template.value = quote.layout.template;
    form.elements.accent.value = quote.layout.accent;
    form.elements.fontSize.value = quote.layout.fontSize;
    form.elements.showTechnical.checked = quote.layout.showTechnical;
    form.elements.showPayment.checked = quote.layout.showPayment;
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
    form
      .querySelectorAll("[data-pricing]")
      .forEach(
        (input) =>
          (quote.pricing[input.dataset.pricing] =
            input.value === "" ? NaN : Number(input.value)),
      );
    form
      .querySelectorAll("[data-layout]")
      .forEach((input) => (quote.layout[input.dataset.layout] = input.value));
    quote.layout.template = form.elements.template.value;
    quote.layout.accent = form.elements.accent.value;
    quote.layout.fontSize = Number(form.elements.fontSize.value);
    quote.layout.showTechnical = form.elements.showTechnical.checked;
    quote.layout.showPayment = form.elements.showPayment.checked;
  }
  function materialFields(item) {
    const m = materialFor(item, quote.pricing);
    const choices = [
      ...new Set([
        ...MATERIAL_NAMES[item.process],
        m.name,
        ...(profile.materials || [])
          .filter((x) => x.process === item.process)
          .map((x) => x.material.name),
      ]),
    ];
    return `<fieldset><legend>Material deste item</legend><div class="grid three"><label>Tipo de material<select data-material-name>${choices.map((n) => `<option ${n === m.name ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label><label>Nome / especificação<input data-material="name" value="${esc(m.name)}" maxlength="100"></label><label>${item.process === "laser" ? "Preço da chapa (R$)" : "Preço por kg (R$)"}<input data-material="price" type="number" min="0" step="0.01" value="${m.price}"></label>${item.process === "laser" ? `<label>Largura da chapa (cm)<input data-material="width" type="number" min="0.1" step="0.1" value="${m.width}"></label><label>Comprimento da chapa (cm)<input data-material="length" type="number" min="0.1" step="0.1" value="${m.length}"></label>` : ""}</div><p class="muted">O preço pertence somente a este material. Confirme o valor de compra; materiais novos não têm preço presumido.</p></fieldset>`;
  }
  function serviceFields(item) {
    return `<fieldset><legend>Serviços e recursos por unidade deste item</legend><div class="actions"><select data-service-pick aria-label="Adicionar serviço ou recurso"><option value="">Selecione um cadastro</option>${(profile.services || []).map((s, i) => `<option value="${i}">${esc(s.name)} · ${brl(s.price)}/${s.unit}</option>`).join("")}</select><button type="button" data-service-add>Adicionar serviço/recurso</button></div>${(item.services || []).map((s, i) => `<div class="grid three"><span>${esc(s.name)} · ${brl(s.price)}/${s.unit}</span><label>Quantidade (${s.unit})<input data-service-quantity="${i}" type="number" min="0" step="any" value="${s.quantity}"></label><button type="button" data-service-remove="${i}">Remover</button></div>`).join("")}<p class="muted">Os serviços são multiplicados pela quantidade do produto. Ajuste o tempo ou a quantidade de cada serviço.</p></fieldset>`;
  }
  function renderItems() {
    $("estimate-items").innerHTML = quote.items
      .map(
        (item, i) =>
          `<article class="card estimate-item" data-row="${item.id}"><div class="heading"><h3>Item ${i + 1} · ${item.process === "laser" ? "Laser" : "Impressão 3D"}</h3><div><button type="button" class="secondary" data-copy="${i}">Duplicar</button><button type="button" class="secondary" data-remove="${i}">Remover</button></div></div>${materialFields(item)}${serviceFields(item)}<label>Descrição para o cliente<textarea data-item="description" rows="2" maxlength="1200">${esc(item.description)}</textarea></label><div class="grid three">${itemField("quantity", "Quantidade", item.quantity)}<label>Precificação<select data-item="method">${[...(item.process === "laser" ? [["rate", "Tarifa de máquina + material"]] : []), ["markup", "Custo + acréscimo (%)"], ["margin", "Margem sobre venda (%)"]].map(([v, label]) => `<option value="${v}" ${item.method === v ? "selected" : ""}>${label}</option>`).join("")}</select></label>${itemField("manualUnitPrice", "Preço unitário manual (R$; vazio = automático)", item.manualUnitPrice ?? "")}</div><div class="grid three">${item.process === "laser" ? itemField("minutes", "Máquina: minutos por unidade", item.minutes) + itemField("boardWidth", "Largura do recorte MDF (cm)", item.boardWidth) + itemField("boardLength", "Comprimento do recorte MDF (cm)", item.boardLength) + itemField("boards", "Placas por unidade (0 = só serviço)", item.boards) + itemField("wastePercent", "Perda de material MDF (%)", item.wastePercent) : itemField("grams", "Material do fatiador (g por unidade)", item.grams) + itemField("hours", "Impressão (horas por unidade; 2,5 = 2h30)", item.hours) + itemField("lossPercent", "Perda de filamento (%)", item.lossPercent)}${itemField("handlingMinutes", "Trabalho manual (min por unidade)", item.handlingMinutes)}${itemField("paintingCost", "Tinta / pintura (R$ por unidade)", item.paintingCost)}${itemField("extras", "Embalagem e outros custos (R$ por unidade)", item.extras)}</div><label class="check"><input type="checkbox" data-item="materialProvided" ${item.materialProvided ? "checked" : ""}> Material fornecido pelo cliente (não cobrar material)</label><p class="muted" data-item-result></p></article>`,
      )
      .join("");
    $("estimate-items")
      .querySelectorAll("[data-row]")
      .forEach((row, index) => {
        row.querySelector("[data-service-add]").onclick = () => {
          const value = row.querySelector("[data-service-pick]").value;
          if (value === "") return;
          quote.items[index].services ||= [];
          quote.items[index].services.push({
            ...structuredClone(profile.services[Number(value)]),
            quantity: 1,
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
        row.querySelectorAll("[data-material]").forEach(
          (input) =>
            (input.oninput = () => {
              const item = quote.items[index];
              item.material = { ...materialFor(item, quote.pricing) };
              item.material[input.dataset.material] =
                input.dataset.material === "name"
                  ? input.value
                  : input.value === ""
                    ? NaN
                    : Number(input.value);
              invalidate();
              renderSummary();
            }),
        );
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
                : key === "description" || key === "method"
                  ? input.value
                  : input.value === ""
                    ? key === "manualUnitPrice"
                      ? null
                      : NaN
                    : Number(input.value);
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
              ...quote.items[Number(b.dataset.copy)],
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
    $("estimate-pricing")
      .querySelectorAll("[data-pricing-process]")
      .forEach((section) => {
        section.hidden =
          section.dataset.pricingProcess !== "common" &&
          !processes.has(section.dataset.pricingProcess);
      });
    form
      .querySelectorAll("[data-laser-help]")
      .forEach((element) => (element.hidden = !processes.has("laser")));
    try {
      const result = calculateEstimate(quote);
      $("estimate-summary").innerHTML =
        `<div class="metrics"><div class="metric">Custo interno<strong>${brl(result.cost)}</strong></div><div class="metric">Subtotal<strong>${brl(result.subtotal)}</strong></div><div class="metric">Total ao cliente<strong>${brl(result.total)}</strong></div><div class="metric">Resultado após impostos<strong>${brl(result.profit)}</strong></div></div><p class="muted">${processes.has("laser") ? `Laser: custo operacional ${brl(result.laser.hour)}/h (${brl(result.laser.minute)}/min) · MDF: ${brl(result.materialM2)}/m² · ` : ""}${processes.has("print") ? `3D: filamento ${brl(quote.pricing.filamentKg)}/kg · energia ${brl(quote.pricing.printEnergy)}/kWh · ` : ""}Impostos inclusos estimados: ${brl(result.tax)}. Frete é repasse e não integra a base de impostos.</p>${result.warnings.map((w) => `<p class="estimate-warning">${esc(w)}</p>`).join("")}`;
      try {
        validateEstimate(quote);
        store("papeled-estimate-draft-v1", quote);
      } catch {}
      result.items.forEach((item, i) => {
        const row =
          $("estimate-items").querySelectorAll("[data-item-result]")[i];
        if (row)
          row.textContent = `Custo/un.: ${brl(item.unitCost)} · Sugerido/un.: ${brl(item.suggested)} · Venda/un.: ${brl(item.unitPrice)} · Subtotal: ${brl(item.subtotal)}`;
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
    quote.items = [newEstimateItem(process)];
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
    sync();
    $("estimate-editor").hidden = false;
    navigate("estimates");
    $("estimate-editor").scrollIntoView({ behavior: "smooth" });
  }
  $("show-estimate-board").onclick = () => {
    const board = $("estimate-history").closest("details");
    board.open = true;
    board.scrollIntoView({ behavior: "smooth" });
  };
  $("new-laser-estimate").onclick = () => start("laser");
  $("new-print-estimate").onclick = () => start("print");
  for (const [id, process] of [
    ["add-laser-item", "laser"],
    ["add-print-item", "print"],
  ])
    $(id).onclick = () => {
      if (quote.items.length >= 150) return;
      readForm();
      quote.items.push(newEstimateItem(process));
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
  $("estimate-save-profile").onclick = async () => {
    try {
      readForm();
      validateEstimate(quote);
      profile = {
        pricing: structuredClone(quote.pricing),
        layout: structuredClone(quote.layout),
        services: structuredClone(profile.services || []),
        materials: [
          ...new Map(
            [
              ...(profile.materials || []),
              ...quote.items.map((item) => ({
                process: item.process,
                material: structuredClone(
                  validateMaterial(
                    materialFor(item, quote.pricing),
                    item.process,
                  ),
                ),
              })),
            ].map((entry) => [
              entry.process + ":" + entry.material.name,
              entry,
            ]),
          ).values(),
        ],
      };
      store(PROFILE, profile);
      if (cloud) {
        const result = await getState().client.from("pricing_profiles").upsert({
          id: "default",
          data: profile,
          updated_at: new Date().toISOString(),
        });
        if (result.error)
          throw Error("Padrões salvos neste navegador, mas não na nuvem.");
      }
      message(
        "Padrões salvos para os próximos orçamentos. Os anteriores permanecem iguais.",
      );
    } catch (e) {
      message(e.message);
    }
  };
  $("estimate-logo").onchange = async (e) => {
    try {
      const file = e.target.files[0];
      if (!file) return;
      if (
        !["image/png", "image/jpeg"].includes(file.type) ||
        file.size > 2 * 1024 * 1024
      )
        throw Error("Use uma logo PNG/JPG de até 2 MB.");
      const url = URL.createObjectURL(file);
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        const canvas = document.createElement("canvas"),
          scale = Math.min(1, 240 / Math.max(img.width, img.height));
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas
          .getContext("2d")
          .drawImage(img, 0, 0, canvas.width, canvas.height);
        quote.layout.logoData = canvas.toDataURL("image/png");
      } finally {
        URL.revokeObjectURL(url);
      }
      invalidate();
      message("Logo personalizada aplicada ao orçamento.");
    } catch (e) {
      message(e.message);
    } finally {
      e.target.value = "";
    }
  };
  $("estimate-default-logo").onclick = () => {
    quote.layout.logoData = null;
    invalidate();
    message("Logo original do Papeled Maker restaurada.");
  };
  async function refresh() {
    profile = read(PROFILE, {});
    const state = getState();
    cloud = false;
    if (!state.local && state.client) {
      try {
        const result = await state.client
          .from("issued_quotes")
          .select("data")
          .order("updated_at", { ascending: false })
          .limit(250);
        if (result.error) throw result.error;
        records = result.data.map((r) => r.data);
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
      ? "Orçamentos conectados ao Supabase. Histórico: 250 mais recentes."
      : "Armazenamento local neste navegador. Para sincronizar, instale a área de orçamentos no Supabase. Use JSON para backup.";
    renderEstimateKanban(
      $("estimate-history"),
      records,
      async (id, changes) => {
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
            throw Error(
              "Não foi possível atualizar no banco. Tente novamente.",
            );
        } else {
          const rows = read(KEY, []);
          const index = rows.findIndex((row) => row.id === id);
          if (index < 0) throw Error("Orçamento não encontrado.");
          rows[index] = next;
          store(KEY, rows);
        }
        if (quote.id === id) {
          Object.assign(quote, changes);
          for (const key of ["status", "paymentStatus", "paymentDate"])
            form.elements[key].value = quote[key] ?? "";
          store("papeled-estimate-draft-v1", quote);
        }
        await refresh();
        message("Etapa e pagamento atualizados.");
      },
      message,
    );
    $("estimate-history")
      .querySelectorAll("[data-open-estimate],[data-clone-estimate]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            try {
              const source = records.find(
                (q) =>
                  q.id === (b.dataset.openEstimate || b.dataset.cloneEstimate),
              );
              validateEstimate(source);
              quote = structuredClone(source);
              if (b.dataset.cloneEstimate) {
                const fresh = newEstimate(profile);
                quote.id = fresh.id;
                quote.number = fresh.number;
                quote.issuedOn = fresh.issuedOn;
                quote.createdAt = fresh.createdAt;
                quote.status = "draft";
                quote.paymentStatus = "pending";
                quote.paymentDate = "";
              }
              sync();
              invalidate();
              $("estimate-editor").hidden = false;
              $("estimate-editor").scrollIntoView({ behavior: "smooth" });
            } catch (e) {
              message(e.message);
            }
          }),
      );
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
      start(
        modelById(source.project?.model || source.settings?.model)?.category ===
          "print"
          ? "print"
          : "laser",
        source,
      ),
  };
}
