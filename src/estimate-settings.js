import {
  DEFAULT_PRICING,
  DEFAULT_LAYOUT,
  laserOperating,
  newEstimate,
  validateEstimate,
  brl,
} from "./estimate-calculations.js";
const KEY = "papeled-estimate-profile-v1";
const fields = {
  laser: [
    ["laserSaleHour", "Preço de venda da máquina (R$/hora)"],
    ["laserCostHour", "Custo interno consolidado (R$/hora)"],
  ],
  print: [
    ["printerWatts", "Consumo da impressora (W)"],
    ["printEnergy", "Energia (R$/kWh)"],
    ["printerInvestment", "Valor da impressora (R$; 0 = sem depreciação)"],
    ["printerLifeHours", "Vida útil estimada (horas)"],
    ["printMaintenanceHour", "Reserva de manutenção (R$/hora)"],
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
  function hint() {
    const rate = Number(
        form.querySelector('[data-pricing="laserSaleHour"]').value,
      ),
      cost = Number(form.querySelector('[data-pricing="laserCostHour"]').value);
    $("laser-settings-example").textContent =
      `Exemplo: 30 minutos de máquina = ${brl(rate / 2)} de venda e ${brl(cost / 2)} de custo interno, antes do material e serviços. A tarifa já deve remunerar sua operação; não há preço universal de mercado.`;
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
      for (const entries of Object.values(fields))
        for (const [key] of entries)
          next.pricing[key] = Number(
            form.querySelector(`[data-pricing="${key}"]`).value,
          );
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
