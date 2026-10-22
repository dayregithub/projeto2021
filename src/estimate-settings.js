import {
  DEFAULT_PRICING,
  DEFAULT_LAYOUT,
  laserOperating,
  printOperating,
  newEstimate,
  validateEstimate,
  brl,
} from "./estimate-calculations.js";
const KEY = "papeled-estimate-profile-v1";
const fields = {
  laser: [
    ["laserSaleHour", "Preço de venda da máquina (R$/hora)"],
    ["laserCostHour", "Custo interno adotado (R$/hora)"],
    ["laserInvestment", "Valor da máquina sem tubo (R$)"],
    ["depreciationMonths", "Prazo de depreciação (meses)"],
    ["workingDays", "Dias de trabalho por mês"],
    ["workingHours", "Horas disponíveis por dia"],
    ["laserUtilization", "Ocupação produtiva da máquina (%)"],
    ["machineKw", "Potência média total: laser, chiller e exaustor (kW)"],
    ["laserEnergy", "Tarifa de energia (R$/kWh)"],
    ["tubePrice", "Custo de reposição do tubo (R$)"],
    ["tubeLifeHours", "Vida útil estimada do tubo (horas)"],
    ["lensPrice", "Custo de reposição das lentes (R$)"],
    ["lensLifeHours", "Vida útil estimada das lentes (horas)"],
    ["mirrorPrice", "Custo de reposição dos espelhos (R$)"],
    ["mirrorLifeHours", "Vida útil estimada dos espelhos (horas)"],
    ["operators", "Operadores equivalentes dedicados à máquina"],
    ["operatorMonthly", "Custo mensal por operador, com encargos (R$)"],
    ["overheadMonthly", "Despesas fixas mensais atribuídas ao laser (R$)"],
    ["laserMaintenanceHour", "Outras manutenções e insumos (R$/hora)"],
  ],
  print: [
    ["printerWatts", "Consumo da impressora (W)"],
    ["printEnergy", "Energia (R$/kWh)"],
    ["printerInvestment", "Valor da impressora (R$; 0 = sem depreciação)"],
    ["printerLifeHours", "Vida útil estimada (horas)"],
    ["printMaintenanceHour", "Reserva de manutenção (R$/hora)"],
    [
      "printConsumablesHour",
      "Bicos, mesa e outros consumíveis, sem filamento (R$/hora)",
    ],
    ["printOperatorHour", "Operador durante impressão (R$/hora de máquina)"],
    [
      "printOverheadMonthly",
      "Despesas fixas mensais atribuídas à impressora (R$)",
    ],
    ["printProductiveHours", "Horas produtivas da impressora por mês"],
  ],
  commercial: [
    ["laborHour", "Trabalho manual / acabamento (R$/hora)"],
    ["laserMaterialMarkup", "Acréscimo sobre material laser (%)"],
    ["printMarkup", "Acréscimo sobre impressão 3D (%)"],
    ["marginPercent", "Margem no método de margem (%)"],
    ["taxPercent", "Impostos inclusos na venda (%)"],
  ],
};
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function initEstimateSettings({ getState, onSaved }) {
  const $ = (id) => document.getElementById(id),
    form = $("estimate-settings-form");
  let current = {
    pricing: { ...DEFAULT_PRICING },
    layout: { ...DEFAULT_LAYOUT },
  };
  const message = (s) => ($("estimate-settings-status").textContent = s);
  for (const [group, entries] of Object.entries(fields))
    $(`estimate-${group}-settings`).innerHTML = entries
      .map(
        ([key, label]) =>
          `<label>${label}<input data-pricing="${key}" type="number" step="any" min="0" required></label>`,
      )
      .join("");
  const layoutFields = [
    ["businessName", "Nome da empresa"],
    ["tagline", "Subtítulo"],
    ["title", "Título do documento"],
    ["phone", "Telefone / WhatsApp"],
    ["email", "E-mail"],
    ["businessId", "CPF / CNPJ"],
    ["address", "Endereço"],
    ["footer", "Rodapé"],
  ];
  $("estimate-layout-fields").innerHTML = layoutFields
    .map(
      ([key, label]) =>
        `<label>${label}<input data-layout="${key}" maxlength="${key === "footer" ? 500 : 150}"></label>`,
    )
    .join("");
  function readPricing() {
    const pricing = { ...current.pricing };
    for (const entries of Object.values(fields))
      for (const [key] of entries)
        pricing[key] = Number(
          form.querySelector(`[data-pricing="${key}"]`).value,
        );
    pricing.laserCostMode = form.elements.laserCostMode.value;
    return pricing;
  }
  const breakdown = (entries, total) =>
    `<dl class="machine-cost-breakdown">${entries.map(([label, value]) => `<div><dt>${label}</dt><dd>${brl(value)}/h</dd></div>`).join("")}<div class="machine-cost-total"><dt>Custo base por hora</dt><dd>${brl(total)}</dd></div><div><dt>Custo por minuto</dt><dd>${brl(total / 60)}</dd></div></dl>`;
  function hint() {
    const input = form.querySelector('[data-pricing="laserCostHour"]');
    input.readOnly = form.elements.laserCostMode.value === "detailed";
    try {
      const p = readPricing(),
        laser = laserOperating(p),
        printer = printOperating(p);
      if (input.readOnly) input.value = String(laser.computed);
      $("laser-cost-breakdown").innerHTML = breakdown(
        [
          ["Energia", laser.energy],
          ["Tubo", laser.tube],
          ["Lentes", laser.lenses],
          ["Espelhos", laser.mirrors],
          ["Depreciação", laser.depreciation],
          ["Operador", laser.labor],
          ["Despesas fixas", laser.overhead],
          ["Outras manutenções e insumos", laser.maintenance],
        ],
        laser.computed,
      );
      $("print-cost-breakdown").innerHTML = breakdown(
        [
          ["Energia", printer.energy],
          ["Depreciação", printer.depreciation],
          ["Manutenção", printer.maintenance],
          ["Consumíveis", printer.consumables],
          ["Operador", printer.labor],
          ["Despesas fixas", printer.overhead],
        ],
        printer.hour,
      );
      $("laser-settings-example").textContent =
        `${laser.productiveHours.toLocaleString("pt-BR")} horas produtivas/mês. Custo adotado: ${brl(laser.hour)}/h. Venda: ${brl(p.laserSaleHour)}/h (${brl(p.laserSaleHour / 60)}/min). ${p.laserSaleHour < laser.hour ? "Atenção: a tarifa de venda está abaixo do custo interno." : "A tarifa de venda é definida por você e deve cobrir custos, impostos e lucro."}`;
    } catch (error) {
      $("laser-settings-example").textContent = error.message;
      $("laser-cost-breakdown").textContent =
        "Revise os valores e as vidas úteis para calcular.";
      $("print-cost-breakdown").textContent =
        "Revise os valores para calcular.";
    }
  }
  form.oninput = hint;
  async function refresh() {
    try {
      const local = JSON.parse(localStorage.getItem(KEY) || "{}"),
        state = getState();
      let stored = local;
      if (state.client && !state.local) {
        const result = await state.client
          .from("pricing_profiles")
          .select("data")
          .eq("id", "default")
          .maybeSingle();
        if (result.error) throw result.error;
        if (result.data) stored = result.data.data;
      }
      current = {
        ...stored,
        pricing: { ...DEFAULT_PRICING, ...stored.pricing },
        layout: { ...DEFAULT_LAYOUT, ...stored.layout },
      };
      current.pricing.laserCostMode ??=
        stored.pricing?.laserCostHour != null ? "manual" : "detailed";
      form.elements.laserCostMode.value = current.pricing.laserCostMode;
      current.pricing.laserCostHour ??= laserOperating(current.pricing).hour;
      current.pricing.laserMaterialMarkup ??=
        stored.pricing?.markupPercent ?? 100;
      current.pricing.printMarkup ??= stored.pricing?.markupPercent ?? 150;
      for (const entries of Object.values(fields))
        for (const [key] of entries)
          form.querySelector(`[data-pricing="${key}"]`).value =
            current.pricing[key];
      for (const [key] of layoutFields)
        form.querySelector(`[data-layout="${key}"]`).value =
          current.layout[key];
      for (const key of ["template", "accent", "fontSize"])
        form.elements[key].value = current.layout[key];
      for (const key of ["showTechnical", "showPayment"])
        form.elements[key].checked = current.layout[key];
      hint();
      message(
        state.local
          ? "Prévia local: configurações deste navegador."
          : "Configurações carregadas. Orçamentos existentes mantêm seus valores.",
      );
    } catch {
      message(
        "Não foi possível carregar as configurações do banco. Confira a conexão e tente novamente.",
      );
    }
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    const button = $("estimate-save-profile");
    button.disabled = true;
    try {
      const next = structuredClone(current);
      next.pricing = readPricing();
      if (next.pricing.laserCostMode === "detailed")
        next.pricing.laserCostHour = laserOperating(next.pricing).computed;
      for (const [key] of layoutFields)
        next.layout[key] = form.querySelector(`[data-layout="${key}"]`).value;
      for (const key of ["template", "accent"])
        next.layout[key] = form.elements[key].value;
      next.layout.fontSize = Number(form.elements.fontSize.value);
      for (const key of ["showTechnical", "showPayment"])
        next.layout[key] = form.elements[key].checked;
      validateEstimate(newEstimate(next));
      const { client, local } = getState();
      let data = {
        ...JSON.parse(localStorage.getItem(KEY) || "{}"),
        pricing: next.pricing,
        layout: next.layout,
      };
      if (client && !local) {
        const latest = await client
          .from("pricing_profiles")
          .select("data")
          .eq("id", "default")
          .maybeSingle();
        if (latest.error)
          throw Error("Não foi possível ler as configurações do banco.");
        data = {
          ...(latest.data?.data || {}),
          pricing: next.pricing,
          layout: next.layout,
        };
        const result = await client.from("pricing_profiles").upsert({
          id: "default",
          data,
          updated_at: new Date().toISOString(),
        });
        if (result.error)
          throw Error("Não foi possível salvar no banco. Tente novamente.");
      }
      localStorage.setItem(KEY, JSON.stringify(data));
      current = data;
      await onSaved();
      message(
        "Configurações salvas. Serão usadas nos novos orçamentos; os anteriores não foram alterados.",
      );
    } catch (error) {
      message(error.message);
    } finally {
      button.disabled = false;
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
        throw Error("Use PNG/JPG de até 2 MB.");
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
        current.layout.logoData = canvas.toDataURL("image/png");
      } finally {
        URL.revokeObjectURL(url);
      }
      message(
        "Logo selecionada. Clique em Salvar configurações para aplicar aos novos orçamentos.",
      );
    } catch (error) {
      message(error.message);
    } finally {
      e.target.value = "";
    }
  };
  $("estimate-default-logo").onclick = () => {
    current.layout.logoData = null;
    message("Logo padrão selecionada. Salve as configurações para confirmar.");
  };
  return { refresh };
}
