import { companyLinks } from "./company-links.js";
import { calculateSimpleItem } from "./simple-estimate.js";
import { validateService } from "./resource-catalog.js";
import { materialFor, validateMaterial } from "./estimate-materials.js";
export const money = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export const brl = (n) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const DEFAULT_PRICING = {
  laserInvestment: 18000,
  tubePrice: 2800,
  tubeLifeHours: 6400,
  lensPrice: 0,
  lensLifeHours: 2000,
  mirrorPrice: 0,
  mirrorLifeHours: 2000,
  laserUtilization: 100,
  machineKw: 1.5,
  laserEnergy: 0.95,
  operators: 1,
  operatorMonthly: 500,
  workingDays: 20,
  workingHours: 8,
  depreciationMonths: 60,
  overheadMonthly: 0,
  laserMaintenanceHour: 0,
  laserSaleHour: 70,
  sheetWidth: 180,
  sheetLength: 275,
  sheetPrice: 85,
  filamentKg: 120,
  printerWatts: 400,
  printEnergy: 1.191,
  printerInvestment: 0,
  printerLifeHours: 8000,
  printMaintenanceHour: 0,
  printConsumablesHour: 0,
  printOperatorHour: 0,
  printOverheadMonthly: 0,
  printProductiveHours: 160,
  laborHour: 20,
  markupPercent: 150,
  marginPercent: 30,
  taxPercent: 0,
};
export const DEFAULT_LAYOUT = {
  template: "classic",
  accent: "#684b43",
  fontSize: 10,
  title: "Orçamento",
  businessName: "Papeled Maker",
  tagline: "Espaço maker online",
  phone: "(61) 99243-0051",
  email: "papeledmaker@gmail.com",
  instagram: "@papeledmaker",
  whatsapp: "61992430051",
  institutionalWebsite: "https://www.papeled.com.br/",
  makerWebsite: "https://papeledmaker.vercel.app",
  businessId: "",
  address: "",
  footer: "Obrigado por criar com a Papeled Maker.",
  showTechnical: true,
  showPayment: true,
  logoData: null,
};
export function newEstimateItem(process = "laser") {
  return {
    id: crypto.randomUUID(),
    process,
    description:
      process === "laser" ? "Corte e gravação a laser" : "Impressão 3D",
    quantity: 1,
    method: process === "laser" ? "rate" : "markup",
    minutes: 0,
    boardWidth: 60,
    boardLength: 40,
    boards: 0,
    wastePercent: 0,
    grams: 0,
    hours: 0,
    lossPercent: 0,
    handlingMinutes: 0,
    paintingCost: 0,
    extras: 0,
    materialProvided: false,
    manualUnitPrice: null,
    material: null,
  };
}
export function newEstimate(profile = {}) {
  return {
    version: 1,
    id: crypto.randomUUID(),
    number: `PM-${localDate().replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
    issuedOn: localDate(),
    validityDays: 7,
    customer: "",
    contact: "",
    customerId: "",
    customerProjectId: null,
    title: "Projeto personalizado",
    status: "draft",
    paymentStatus: "pending",
    paymentDate: "",
    delivery: "Prazo a combinar após aprovação.",
    payment: "Condições de pagamento a combinar.",
    notes: "",
    internalNotes: "",
    setupMinutes: 0,
    setupPrice: 0,
    shipping: 0,
    discountType: "amount",
    discount: 0,
    adjustment: 0,
    adjustmentReason: "",
    pricing: { ...DEFAULT_PRICING, ...profile.pricing },
    layout: { ...DEFAULT_LAYOUT, ...profile.layout },
    items: [newEstimateItem("laser")],
    createdAt: new Date().toISOString(),
  };
}
function number(n, label, { min = 0, max = 1e9 } = {}) {
  if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max)
    throw Error(`${label}: informe um valor entre ${min} e ${max}.`);
  return n;
}
export function laserOperating(pricing) {
  const p = { ...DEFAULT_PRICING, ...pricing };
  for (const k of Object.keys(DEFAULT_PRICING)) number(p[k], k);
  number(p.workingDays, "Dias trabalhados", { min: 1, max: 31 });
  number(p.workingHours, "Horas diárias", { min: 0.1, max: 24 });
  number(p.tubeLifeHours, "Vida útil do tubo", { min: 1 });
  number(p.depreciationMonths, "Meses de depreciação", { min: 1 });
  number(p.laserUtilization, "Ocupação produtiva laser (%)", {
    min: 0.1,
    max: 100,
  });
  number(p.lensLifeHours, "Vida útil das lentes", { min: 1 });
  number(p.mirrorLifeHours, "Vida útil dos espelhos", { min: 1 });
  const productiveHours =
    (p.workingDays * p.workingHours * p.laserUtilization) / 100;
  const tube = p.tubePrice / p.tubeLifeHours,
    lenses = p.lensPrice / p.lensLifeHours,
    mirrors = p.mirrorPrice / p.mirrorLifeHours,
    energy = p.machineKw * p.laserEnergy,
    labor = (p.operators * p.operatorMonthly) / productiveHours,
    depreciation = p.laserInvestment / p.depreciationMonths / productiveHours,
    overhead = p.overheadMonthly / productiveHours,
    maintenance = p.laserMaintenanceHour;
  const computed =
    tube +
    lenses +
    mirrors +
    energy +
    labor +
    depreciation +
    overhead +
    maintenance;
  const hour =
    p.laserCostMode === "detailed" ? computed : (p.laserCostHour ?? computed);
  number(hour, "Custo interno laser por hora");
  return {
    tube,
    lenses,
    mirrors,
    computed,
    productiveHours,
    energy,
    labor,
    depreciation,
    overhead,
    maintenance,
    hour,
    minute: hour / 60,
  };
}
export function printOperating(pricing) {
  const p = { ...DEFAULT_PRICING, ...pricing };
  for (const key of [
    "printerWatts",
    "printEnergy",
    "printerInvestment",
    "printerLifeHours",
    "printMaintenanceHour",
    "printConsumablesHour",
    "printOperatorHour",
    "printOverheadMonthly",
    "printProductiveHours",
  ])
    number(p[key], key);
  number(p.printerLifeHours, "Vida útil da impressora", { min: 1 });
  number(p.printProductiveHours, "Horas produtivas 3D por mês", { min: 0.1 });
  const energy = (p.printerWatts / 1000) * p.printEnergy;
  const depreciation = p.printerInvestment / p.printerLifeHours;
  const maintenance = p.printMaintenanceHour;
  const consumables = p.printConsumablesHour;
  const labor = p.printOperatorHour;
  const overhead = p.printOverheadMonthly / p.printProductiveHours;
  const machine = depreciation + maintenance + consumables + labor + overhead;
  return {
    energy,
    depreciation,
    maintenance,
    consumables,
    labor,
    overhead,
    machine,
    hour: machine + energy,
  };
}
export function calculateEstimate(quote) {
  if (
    !quote ||
    quote.version !== 1 ||
    !Array.isArray(quote.items) ||
    quote.items.length < 1 ||
    quote.items.length > 150
  )
    throw Error("Inclua de 1 a 150 itens.");
  const p = { ...DEFAULT_PRICING, ...quote.pricing },
    laser = laserOperating(p),
    printer = printOperating(p);
  number(p.sheetWidth, "Largura da chapa", { min: 0.1 });
  number(p.sheetLength, "Comprimento da chapa", { min: 0.1 });
  number(p.printerLifeHours, "Vida útil da impressora", { min: 1 });
  number(p.taxPercent, "Impostos", { max: 99.99 });
  number(p.markupPercent, "Acréscimo", { max: 10000 });
  number(p.marginPercent, "Margem", { max: 99.99 });
  if (p.laserMaterialMarkup !== undefined)
    number(p.laserMaterialMarkup, "Acréscimo material laser", { max: 10000 });
  if (p.printMarkup !== undefined)
    number(p.printMarkup, "Acréscimo impressão 3D", { max: 10000 });
  if (p.printMarginPercent !== undefined)
    number(p.printMarginPercent, "Margem 3D", { max: 99.99 });
  if (
    p.printPricingMethod !== undefined &&
    !["markup", "margin"].includes(p.printPricingMethod)
  )
    throw Error("Método de preço 3D inválido.");
  if (
    p.printPricingMethod === "margin" &&
    (p.printMarginPercent ?? p.marginPercent) + p.taxPercent >= 100
  )
    throw Error("Margem 3D + impostos devem ser menores que 100%.");
  const sheetM2 = (p.sheetWidth * p.sheetLength) / 10000,
    materialM2 = p.sheetPrice / sheetM2;
  const items = quote.items.map((item, index) => {
    const label = `Item ${index + 1}`;
    if (
      !["laser", "print"].includes(item.process) ||
      !["rate", "markup", "margin"].includes(item.method)
    )
      throw Error(`${label}: processo ou precificação inválidos.`);
    if (
      typeof item.description !== "string" ||
      !item.description.trim() ||
      item.description.length > 1200
    )
      throw Error(`${label}: preencha a descrição (até 1.200 caracteres).`);
    number(item.quantity, `${label}, quantidade`, { min: 1, max: 100000 });
    if (!Number.isInteger(item.quantity))
      throw Error(`${label}: a quantidade deve ser inteira.`);
    for (const key of [
      "minutes",
      "boardWidth",
      "boardLength",
      "boards",
      "grams",
      "hours",
      "handlingMinutes",
      "paintingCost",
      "extras",
    ])
      number(item[key], `${label}, ${key}`);
    number(item.wastePercent, `${label}, perda MDF`, { max: 1000 });
    number(item.lossPercent, `${label}, perda filamento`, { max: 1000 });
    if (item.process === "print" && item.method === "rate")
      throw Error(`${label}: impressão 3D usa acréscimo ou margem.`);
    if (
      item.printInputMode != null &&
      !["piece", "batch"].includes(item.printInputMode)
    )
      throw Error("Escolha peso e tempo por peça ou por lote.");
    if (
      item.materialSelectionRequired &&
      item.materialMode === "included" &&
      !item.material
    )
      throw Error("Cadastre e selecione um material para este projeto.");
    if (quote.calculationVersion === 2)
      return calculateSimpleItem(item, p, laser, {
        money,
        number,
        validateMaterial,
        materialFor,
        validateService,
        printer,
      });
    const selectedMaterial = validateMaterial(
      materialFor(item, p),
      item.process,
    );
    if (
      item.material &&
      !item.materialProvided &&
      selectedMaterial.price === 0 &&
      (item.process === "laser" ? item.boards > 0 : item.grams > 0)
    )
      throw Error(`${label}: informe o preço do material selecionado.`);
    const itemMaterialM2 =
      item.process === "laser"
        ? selectedMaterial.price /
          ((selectedMaterial.width * selectedMaterial.length) / 10000)
        : 0;
    const material = item.materialProvided
      ? 0
      : item.process === "laser"
        ? ((item.boardWidth * item.boardLength) / 10000) *
          item.boards *
          (1 + item.wastePercent / 100) *
          itemMaterialM2
        : (item.grams / 1000) *
          selectedMaterial.price *
          (1 + item.lossPercent / 100);
    const machine =
      item.process === "laser"
        ? (item.minutes / 60) * laser.hour
        : item.hours * printer.machine;
    const energy =
      item.process === "print"
        ? ((item.hours * p.printerWatts) / 1000) * p.printEnergy
        : 0;
    const services = item.services || [];
    if (!Array.isArray(services) || services.length > 30)
      throw Error(`${label}: lista de serviços inválida.`);
    let serviceCost = 0,
      servicePrice = 0;
    for (const entry of services) {
      validateService(entry);
      number(entry.quantity, "Quantidade de serviço", { max: 100000 });
      serviceCost += entry.cost * entry.quantity;
      servicePrice += entry.price * entry.quantity;
    }
    const handling = (item.handlingMinutes / 60) * p.laborHour,
      unitCost =
        material +
        machine +
        energy +
        handling +
        item.paintingCost +
        item.extras +
        serviceCost;
    let suggested;
    const markup =
      item.process === "laser"
        ? (p.laserMaterialMarkup ?? p.markupPercent)
        : (p.printMarkup ?? p.markupPercent);
    if (item.method === "rate")
      suggested =
        (item.minutes / 60) * p.laserSaleHour +
        (material + handling + item.paintingCost + item.extras) *
          (1 + markup / 100);
    else if (item.method === "markup")
      suggested = (unitCost - serviceCost) * (1 + markup / 100);
    else {
      if (p.marginPercent + p.taxPercent >= 100)
        throw Error("Margem + impostos devem ser menores que 100%.");
      suggested =
        (unitCost - serviceCost) / (1 - (p.marginPercent + p.taxPercent) / 100);
    }
    suggested += servicePrice;
    if (item.manualUnitPrice !== null && item.manualUnitPrice !== undefined)
      number(item.manualUnitPrice, `${label}, preço manual`);
    const unitPrice = money(item.manualUnitPrice ?? suggested),
      subtotal = money(unitPrice * item.quantity),
      totalCost = unitCost * item.quantity;
    return {
      ...item,
      unitPrice,
      suggested: money(suggested),
      subtotal,
      unitCost,
      totalCost,
      costs: {
        material,
        machine,
        energy,
        handling,
        painting: item.paintingCost,
        extras: item.extras,
      },
      materialName: selectedMaterial.name,
      technical:
        selectedMaterial.name +
        " · " +
        (item.process === "laser"
          ? `${item.minutes} min/un. · Recorte ${item.boardWidth} × ${item.boardLength} cm × ${item.boards} placa(s)/un.`
          : `${item.grams} g/un. · ${item.hours} h/un.`) +
        (services.length
          ? " · " +
            services
              .map((s) => `${s.name}: ${s.quantity} ${s.unit}/un.`)
              .join("; ")
          : ""),
    };
  });
  for (const key of ["setupMinutes", "setupPrice", "shipping", "discount"])
    number(quote[key], key);
  number(quote.adjustment, "Ajuste comercial", { min: -1e9 });
  if (!["amount", "percent"].includes(quote.discountType))
    throw Error("Tipo de desconto inválido.");
  if (quote.discountType === "percent")
    number(quote.discount, "Desconto percentual", { max: 100 });
  const itemSubtotal = money(
      items.reduce((sum, item) => sum + item.subtotal, 0),
    ),
    subtotal = money(itemSubtotal + quote.setupPrice),
    discount = money(
      quote.discountType === "percent"
        ? (subtotal * quote.discount) / 100
        : quote.discount,
    );
  if (discount > subtotal)
    throw Error("O desconto não pode superar o subtotal.");
  const taxable = money(subtotal - discount + quote.adjustment);
  if (taxable < 0) throw Error("O ajuste deixa o orçamento negativo.");
  const total = money(taxable + quote.shipping),
    tax = money((taxable * p.taxPercent) / 100),
    cost = money(
      items.reduce((sum, item) => sum + item.totalCost, 0) +
        (quote.setupMinutes / 60) * p.laborHour +
        quote.shipping,
    ),
    profit = money(total - tax - cost);
  // Allocate the actual taxable sale and included tax, preserving cent totals after discounts/adjustments.
  let cumulative = 0,
    allocatedSale = 0,
    allocatedTax = 0;
  for (const item of items) {
    cumulative += subtotal ? item.subtotal : 1;
    const denominator = subtotal || items.length;
    const saleToHere = money((taxable * cumulative) / denominator);
    const taxToHere = money((tax * cumulative) / denominator);
    item.saleAfterAdjustments = money(saleToHere - allocatedSale);
    item.includedTax = money(taxToHere - allocatedTax);
    item.netRevenue = money(item.saleAfterAdjustments - item.includedTax);
    item.estimatedProfit = money(item.netRevenue - item.totalCost);
    allocatedSale = saleToHere;
    allocatedTax = taxToHere;
  }
  const setupTax = money(tax - allocatedTax);
  if (total > 1e9) throw Error("O total excede o limite permitido.");
  return {
    items,
    laser,
    sheetM2,
    materialM2,
    itemSubtotal,
    materialTotal: money(
      items.reduce(
        (sum, item) =>
          sum + (item.materialAmount ?? item.costs.material * item.quantity),
        0,
      ),
    ),
    serviceTotal: money(
      items.reduce(
        (sum, item) =>
          sum +
          (item.serviceAmount ??
            item.subtotal - item.costs.material * item.quantity),
        0,
      ),
    ),
    additionalTotal: money(
      items.reduce((sum, item) => sum + (item.additionalAmount ?? 0), 0),
    ),
    invoiceRows:
      quote.calculationVersion === 2
        ? items.flatMap((item) => item.invoiceRows)
        : null,
    subtotal,
    discount,
    taxable,
    total,
    tax,
    setupTax,
    cost,
    profit,
    margin: taxable ? (profit / taxable) * 100 : 0,
    warnings: [
      ...(profit < 0
        ? ["O preço final está abaixo do custo calculado, após impostos."]
        : []),
      ...(items.some(
        (i) => i.manualUnitPrice !== null && i.manualUnitPrice < i.suggested,
      )
        ? ["Há preço manual inferior ao preço sugerido."]
        : []),
    ],
  };
}
export function validateEstimate(q) {
  if (
    q?.calculationVersion !== undefined &&
    ![1, 2].includes(q.calculationVersion)
  )
    throw Error("Versão de cálculo inválida.");
  calculateEstimate(q);
  if (typeof q.id !== "string" || !/^[a-f0-9-]{36}$/i.test(q.id))
    throw Error("Identificador de orçamento inválido.");
  for (const [key, max] of [
    ["number", 60],
    ["customer", 180],
    ["contact", 180],
    ["customerId", 40],
    ["title", 180],
    ["delivery", 1500],
    ["payment", 1500],
    ["notes", 6000],
    ["internalNotes", 6000],
    ["adjustmentReason", 1000],
  ])
    if (typeof q[key] !== "string" || q[key].length > max)
      throw Error(`Campo ${key} inválido.`);
  if (!q.number.trim()) throw Error("Informe o número do orçamento.");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(q.issuedOn) ||
    Number.isNaN(Date.parse(q.issuedOn + "T12:00:00Z")) ||
    new Date(q.issuedOn + "T12:00:00Z").toISOString().slice(0, 10) !==
      q.issuedOn
  )
    throw Error("Data inválida.");
  number(q.validityDays, "Validade", { max: 3650 });
  if (!Number.isInteger(q.validityDays))
    throw Error("Validade deve ser um número inteiro de dias.");
  if (
    ![
      "draft",
      "sent",
      "approved",
      "rejected",
      "cancelled",
      "in_progress",
      "completed",
      "delivered",
    ].includes(q.status)
  )
    throw Error("Situação inválida.");
  if (!["pending", "paid"].includes(q.paymentStatus ?? "pending"))
    throw Error("Situação do pagamento inválida.");
  if (q.paymentDate) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(q.paymentDate) ||
      Number.isNaN(Date.parse(q.paymentDate + "T12:00:00Z")) ||
      new Date(q.paymentDate + "T12:00:00Z").toISOString().slice(0, 10) !==
        q.paymentDate
    )
      throw Error("Data do pagamento inválida.");
  }
  if (q.paymentStatus === "paid" && !q.paymentDate)
    throw Error("Informe a data do pagamento realizado.");
  const l = q.layout;
  if (
    !l ||
    !["classic", "modern", "compact"].includes(l.template) ||
    !/^#[a-f\d]{6}$/i.test(l.accent)
  )
    throw Error("Layout inválido.");
  number(l.fontSize, "Fonte", { min: 9, max: 13 });
  for (const [key, max] of [
    ["title", 80],
    ["businessName", 120],
    ["tagline", 180],
    ["phone", 100],
    ["email", 150],
    ["businessId", 80],
    ["address", 300],
    ["footer", 500],
  ])
    if (typeof l[key] !== "string" || l[key].length > max)
      throw Error(`Layout: ${key} inválido.`);
  companyLinks(l);
  if (
    l.logoData !== null &&
    (!/^data:image\/(png|jpeg);base64,/.test(l.logoData) ||
      l.logoData.length > 400000)
  )
    throw Error("Logo inválida ou muito grande.");
  return q;
}
